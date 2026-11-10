import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { attachWebSocket } from '../src/websocket/server.js';
import { createQueue } from '../src/lib/queue.js';

test('actual WebSocket handshake, snapshot ordering, history and safe error responses', { timeout: 10000 }, async (t) => {
  const server = createServer();
  const queue = createQueue();
  const sockets = attachWebSocket(server, { queue, origins: ['http://localhost:5173'], dashboard: {
    snapshot: async (deviceCode) => ({ device: { deviceCode }, latest: null }),
    history: async () => ({ items: [] }),
  } });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await sockets.close(); await new Promise((resolve) => server.close(resolve)); });
  const url = `ws://127.0.0.1:${server.address().port}/ws`;
  const forbidden = new WebSocket(url, { origin: 'http://untrusted.example' });
  await new Promise((resolve, reject) => { forbidden.on('unexpected-response', (_r, response) => { try { assert.equal(response.statusCode, 403); } catch (e) { reject(e); } response.resume(); forbidden.terminate(); resolve(); }); forbidden.on('error', () => {}); });
  const client = new WebSocket(url, { origin: 'http://localhost:5173' });
  await once(client, 'open');
  const messages = [];
  client.on('message', (b) => messages.push(JSON.parse(b)));
  let next = once(client, 'message');
  client.send(JSON.stringify({ type: 'dashboard.get', requestId: 's1', payload: { deviceCode: 'DOC-ROOM-01' } }));
  await next;
  await queue.run(() => sockets.broadcast('reading.created', { deviceCode: 'DOC-ROOM-01', reading: { id: 1 } }));
  while (messages.length < 2) await once(client, 'message');
  assert.deepEqual(messages.slice(0, 2).map((m) => m.type), ['dashboard.snapshot', 'reading.created']);
  next = once(client, 'message');
  client.send(JSON.stringify({ type: 'readings.get', requestId: 'h1', payload: { deviceCode: 'DOC-ROOM-01' } }));
  const [history] = await next;
  assert.equal(JSON.parse(history).requestId, 'h1');
  next = once(client, 'message'); client.send('{');
  assert.equal(JSON.parse((await next)[0]).error.code, 'INVALID_REQUEST');
  client.close(); await once(client, 'close');
});
