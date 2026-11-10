import test from 'node:test';
import { config } from 'dotenv';
config({ quiet: true });
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Pool } from 'pg';
import { Aedes } from 'aedes';
import mqtt from 'mqtt';
import { WebSocket } from 'ws';
import { createPrisma } from '../../src/config/prisma.js';
import { createReadingService } from '../../src/services/readings.service.js';
import { parseReading } from '../../src/validators/messages.js';
import { startBackend } from '../../src/runtime.js';

const waitFor = async (check) => { const deadline = Date.now() + 8000; while (!(await check())) { if (Date.now() > deadline) throw new Error('Timed out waiting for integration result.'); await new Promise((r) => setTimeout(r, 20)); } };
test('PostgreSQL + authenticated MQTT + WebSocket complete flow', { skip: !process.env.TEST_DATABASE_URL, timeout: 60000 }, async (t) => {
  const schema = `dsms_test_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(process.env.TEST_DATABASE_URL); url.searchParams.delete('schema');
  const admin = new Pool({ connectionString: url.toString(), connectionTimeoutMillis: 5000 });
  let prisma, backend, broker, tcp, publisher, browser, created = false;
  t.after(async () => {
    if (publisher) await publisher.endAsync(true);
    if (browser) browser.terminate();
    if (backend) await backend.close();
    else if (prisma) await prisma.$disconnect();
    if (broker) await new Promise((r) => broker.close(r));
    if (tcp) await new Promise((r) => tcp.close(r));
    // Only the isolated schema created by this test is removed, never public tables.
    if (created && /^dsms_test_[a-f0-9]{32}$/.test(schema)) await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.end();
  });
  try { await admin.query(`CREATE SCHEMA "${schema}"`); created = true; }
  catch (error) { throw new Error(`Test database unavailable or schema creation denied (${error.code ?? 'unknown'}).`); }
  const setup = await admin.connect();
  try {
    await setup.query(`SET search_path TO "${schema}"`);
    for (const entry of readdirSync('prisma/migrations', { withFileTypes: true }).filter((e) => e.isDirectory()).sort((a,b) => a.name.localeCompare(b.name))) await setup.query(readFileSync(`prisma/migrations/${entry.name}/migration.sql`, 'utf8'));
  } finally { setup.release(); }
  url.searchParams.set('schema', schema); prisma = createPrisma(url.toString());
  await prisma.device.create({ data: { deviceCode: 'DOC-ROOM-01', name: 'Integration device', location: 'Test only' } });
  let time = 0;
  const readings = createReadingService(prisma, { clock: () => new Date(time) });
  const body = (id, wet = false, humidityPercent = 50) => ({ deviceId: 'DOC-ROOM-01', readingUid: id, temperatureC: 28.5, humidityPercent, waterDetected: wet });
  const wet = await readings.ingest(body('wet-1', true));
  assert.equal(wet.alerts[0].type, 'WATER');
  const duplicate = await readings.ingest(body('wet-1', true));
  assert.equal(duplicate.duplicate, true);
  assert.equal(+duplicate.reading.receivedAt, 0);
  await assert.rejects(readings.ingest(body('wet-1', false)), { code: 'CONFLICTING_DUPLICATE' });
  time = 1000; await readings.ingest(body('dry-1'));
  time = 11000; const clear = await readings.ingest(body('dry-2'));
  assert.equal(clear.alerts[0].status, 'CLEARED');
  time = 12000;
  const simultaneous = await Promise.all([readings.ingest(body('same')), readings.ingest(body('same'))]);
  assert.equal(simultaneous.filter((r) => r.duplicate).length, 1);
  const device = await prisma.device.findUnique({ where: { deviceCode: 'DOC-ROOM-01' } });
  await assert.rejects(prisma.sensorReading.create({ data: { deviceId: device.id, temperatureC: 20, humidityPercent: 140, waterDetected: false } }));
  await assert.rejects(prisma.alert.create({ data: { deviceId: device.id, type: 'WATER', severity: 'CRITICAL', message: 'invalid', status: 'CLEARED' } }));
  await assert.rejects(prisma.sensorReading.create({ data: { deviceId: device.id, temperatureC: Number.NaN, humidityPercent: 50, waterDetected: false } }));
  await assert.rejects(prisma.device.delete({ where: { id: device.id } }));
  const open = await prisma.alert.create({ data: { deviceId: device.id, type: 'HUMIDITY', severity: 'WARNING', message: 'test' } });
  await assert.rejects(prisma.alert.create({ data: { deviceId: device.id, type: 'HUMIDITY', severity: 'WARNING', message: 'duplicate' } }));
  await prisma.alert.update({ where: { id: open.id }, data: { status: 'CLEARED', clearedAt: new Date() } });
  await prisma.device.update({ where: { id: device.id }, data: { isActive: false } });
  await assert.rejects(readings.ingest(body('inactive')), { code: 'INACTIVE_DEVICE' });
  await prisma.device.update({ where: { id: device.id }, data: { isActive: true } });
  await assert.rejects(readings.ingest({ ...body('unknown'), deviceId: 'UNKNOWN' }), { code: 'UNKNOWN_DEVICE' });

  broker = await Aedes.createBroker();
  broker.authenticate = (client, username, password, cb) => { client.role = username; cb(null, ['dsms_backend', 'DOC-ROOM-01'].includes(username) && password?.toString() === 'test-only'); };
  broker.authorizePublish = (client, packet, cb) => cb(client?.role === 'DOC-ROOM-01' && packet.topic === 'dsms/DOC-ROOM-01/readings' ? null : new Error('Forbidden'));
  broker.authorizeSubscribe = (client, sub, cb) => cb(null, client?.role === 'dsms_backend' && sub.topic === 'dsms/+/readings' ? sub : null);
  tcp = createServer(broker.handle); await new Promise((r) => tcp.listen(0, '127.0.0.1', r));
  const brokerUrl = `mqtt://127.0.0.1:${tcp.address().port}`;
  await assert.rejects(mqtt.connectAsync(brokerUrl, { username: 'DOC-ROOM-01', password: 'incorrect', reconnectPeriod: 0, connectTimeout: 1000 }));
  const env = { HOST: '127.0.0.1', PORT: 0, origins: ['http://localhost:5173'], MQTT_URL: brokerUrl, MQTT_USERNAME: 'dsms_backend', MQTT_PASSWORD: 'test-only', MQTT_CLIENT_ID: 'test-backend', STATUS_INTERVAL_MS: 50, STALE_AFTER_MS: 200, OFFLINE_AFTER_MS: 400, WARNING_AFTER_MS: 1800000, CRITICAL_AFTER_MS: 900000, HUMIDITY_CLEAR_AFTER_MS: 600000, WATER_CLEAR_AFTER_MS: 10000, GAP_AFTER_MS: 180000, MAX_CONNECTIONS: 5 };
  backend = await startBackend({ prisma, env, logger: { warn() {} } });
  await waitFor(() => backend.mqtt.state.subscribed);
  const port = backend.server.address().port;
  browser = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin: 'http://localhost:5173' }); await once(browser, 'open');
  const events = []; browser.on('message', (b) => events.push(JSON.parse(b)));
  browser.send(JSON.stringify({ type: 'dashboard.get', requestId: 'snapshot', payload: { deviceCode: 'DOC-ROOM-01' } }));
  await waitFor(() => events.some((e) => e.requestId === 'snapshot'));
  publisher = await mqtt.connectAsync(brokerUrl, { username: 'DOC-ROOM-01', password: 'test-only', reconnectPeriod: 0 });
  await publisher.publishAsync('dsms/DOC-ROOM-01/readings', JSON.stringify(body('mqtt-reading', true)), { qos: 1, retain: false });
  await waitFor(() => events.some((e) => e.type === 'reading.created'));
  assert.ok(await prisma.sensorReading.findUnique({ where: { deviceId_readingUid: { deviceId: device.id, readingUid: 'mqtt-reading' } } }));
  await waitFor(() => events.some((e) => e.type === 'alert.changed'));
  await publisher.publishAsync('dsms/DOC-ROOM-01/readings', JSON.stringify(body('mqtt-reading', true)), { qos: 1 });
  await waitFor(() => backend.mqtt.state.duplicates === 1);
  assert.equal(events.filter((e) => e.type === 'reading.created').length, 1);
  await publisher.publishAsync('dsms/DOC-ROOM-01/readings', '{bad', { qos: 1 });
  await waitFor(() => backend.mqtt.state.rejected === 1);
  browser.send(JSON.stringify({ type: 'readings.get', requestId: 'history', payload: { deviceCode: 'DOC-ROOM-01', limit: 1 } }));
  await waitFor(() => events.some((e) => e.requestId === 'history'));
  assert.equal(events.find((e) => e.requestId === 'history').payload.items[0].readingUid, 'mqtt-reading');
  const receivedAt = events.find((e) => e.type === 'reading.created').payload.reading.receivedAt;
  await waitFor(() => events.some((e) => e.type === 'device.status' && e.payload.connectivity === 'OFFLINE' && e.payload.receivedAt === receivedAt));
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/v1/health`)).status, 200);
  browser.close(); await once(browser, 'close');
  browser = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin: 'http://localhost:5173' }); await once(browser, 'open');
  const recovered = once(browser, 'message');
  browser.send(JSON.stringify({ type: 'dashboard.get', requestId: 'reconnect', payload: { deviceCode: 'DOC-ROOM-01' } }));
  const snapshot = JSON.parse((await recovered)[0]);
  assert.equal(snapshot.payload.latest.readingUid, 'mqtt-reading');
  assert.equal(snapshot.payload.environmentalRisk, 'CRITICAL');
  assert.equal(snapshot.payload.connectivity, 'OFFLINE');
  await promisify(execFile)(process.execPath, ['scripts/simulate-device.js', 'warning'], {
    env: { ...process.env, MQTT_URL: brokerUrl, SIM_MQTT_USERNAME: 'DOC-ROOM-01', SIM_MQTT_PASSWORD: 'test-only', SIM_DEVICE_CODE: 'DOC-ROOM-01', SIM_READING_UID: 'cli-simulator', MQTT_CA_FILE: '' },
    timeout: 15000,
  });
  await waitFor(async () => !!await prisma.sensorReading.findUnique({ where: { deviceId_readingUid: { deviceId: device.id, readingUid: 'cli-simulator' } } }));
  const simulated = await prisma.sensorReading.findUnique({ where: { deviceId_readingUid: { deviceId: device.id, readingUid: 'cli-simulator' } } });
  assert.equal(simulated.humidityPercent, 62);
  assert.equal(simulated.waterDetected, false);
  await backend.mqtt.close();
  await waitFor(() => !backend.mqtt.state.connected);
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/v1/health`)).status, 503);
  // All broadcast values originated from actual test PostgreSQL writes, not an in-memory fake.
  assert.equal(parseReading('dsms/DOC-ROOM-01/readings', Buffer.from(JSON.stringify(body('valid')))).deviceId, 'DOC-ROOM-01');
});
