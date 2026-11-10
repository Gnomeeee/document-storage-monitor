import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReading, parseRequest } from '../src/validators/messages.js';
import { loadEnv } from '../src/config/env.js';
import { createQueue } from '../src/lib/queue.js';
const topic = 'dsms/DOC-ROOM-01/readings';
const valid = { deviceId: 'DOC-ROOM-01', temperatureC: 28.5, humidityPercent: 50, waterDetected: false, readingUid: 'sample-1' };
const bytes = (v) => Buffer.from(JSON.stringify(v));
test('MQTT accepts valid input and rejects malformed, retained and spoofed readings', () => {
  assert.deepEqual(parseReading(topic, bytes(valid)), valid);
  for (const change of [{ humidityPercent: 101 }, { humidityPercent: null }, { temperatureC: -21 }, { waterDetected: 'false' }, { readingUid: '' }, { deviceId: 'OTHER' }, { extra: true }]) assert.throws(() => parseReading(topic, bytes({ ...valid, ...change })));
  assert.throws(() => parseReading(topic, Buffer.from('{')));
  assert.throws(() => parseReading(topic, bytes(valid), true));
  assert.throws(() => parseReading(topic, Buffer.alloc(4097)));
});
test('WebSocket validates bounded filters and correlations', () => {
  const request = { type: 'readings.get', requestId: 'r1', payload: { deviceCode: 'DOC-ROOM-01' } };
  assert.equal(parseRequest(bytes(request)).payload.limit, 100);
  for (const payload of [{ ...request.payload, limit: 501 }, { ...request.payload, from: '2026-11-11T00:00:00Z', to: '2026-11-10T00:00:00Z' }]) assert.throws(() => parseRequest(bytes({ ...request, payload })));
  assert.throws(() => parseRequest(bytes({ ...request, type: 'device.command' })));
});
test('configuration validates fields without exposing credentials', () => {
  const input = { DATABASE_URL: 'postgresql://user:secret@localhost/db', MQTT_USERNAME: 'backend', MQTT_PASSWORD: 'secret' };
  assert.equal(loadEnv(input).PORT, 3000);
  assert.throws(() => loadEnv({ ...input, DATABASE_URL: 'SECRET_INVALID_VALUE' }), (e) => e.message.includes('DATABASE_URL') && !e.message.includes('SECRET_INVALID_VALUE'));
  assert.throws(() => loadEnv({ ...input, OFFLINE_AFTER_MS: '1' }));
  assert.throws(() => loadEnv({ ...input, ALLOWED_ORIGINS: '*' }));
});
test('serialized queue preserves ordering after failure and bounds pending work', async () => {
  const queue = createQueue(2);
  const order = [];
  const first = queue.run(async () => { order.push(1); throw new Error('test'); });
  const second = queue.run(async () => { order.push(2); });
  await assert.rejects(queue.run(async () => {}), { code: 'BUSY' });
  await assert.rejects(first);
  await second;
  assert.deepEqual(order, [1, 2]);
});
