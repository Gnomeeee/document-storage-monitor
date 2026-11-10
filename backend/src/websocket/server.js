import { WebSocketServer, WebSocket } from 'ws';
import { parseRequest } from '../validators/messages.js';
import { publicError } from '../lib/errors.js';

export function attachWebSocket(server, { dashboard, queue, origins, maxConnections = 30 }) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8192, perMessageDeflate: false });
  function send(ws, message) {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 1024 * 1024) { ws.close(1013, 'Client too slow'); return; }
    ws.send(JSON.stringify(message));
  }
  const upgrade = (req, socket, head) => {
    socket.on('error', () => {});
    const fail = (status) => socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
    if (req.url !== '/ws') return fail('404 Not Found');
    if (!origins.includes(req.headers.origin)) return fail('403 Forbidden');
    if (wss.clients.size >= maxConnections) return fail('503 Service Unavailable');
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
  };
  server.on('upgrade', upgrade);
  wss.on('connection', (ws) => {
    ws.alive = true;
    ws.deviceCode = null;
    let windowStart = Date.now(), messages = 0, pending = 0;
    ws.on('error', () => {});
    ws.on('pong', () => { ws.alive = true; });
    ws.on('message', (bytes, binary) => {
      if (Date.now() - windowStart > 60000) { windowStart = Date.now(); messages = 0; }
      if (++messages > 60 || pending >= 5) { ws.close(1008, 'Request limit exceeded'); return; }
      let request;
      try {
        if (binary) throw new Error('Binary requests unsupported');
        request = parseRequest(bytes);
      } catch (error) { send(ws, { type: 'error', requestId: error.requestId ?? null, error: binary ? { code: 'INVALID_REQUEST', message: 'Use JSON text messages.' } : publicError(error) }); return; }
      pending++;
      queue.run(async () => {
        if (ws.readyState !== WebSocket.OPEN) return;
        if (request.type === 'dashboard.get') {
          const snapshot = await dashboard.snapshot(request.payload.deviceCode);
          ws.deviceCode = request.payload.deviceCode;
          // Queue also owns ingestion + its broadcast: snapshot cannot arrive after a newer live event.
          send(ws, { type: 'dashboard.snapshot', requestId: request.requestId, payload: snapshot });
        } else {
          const kind = request.type === 'readings.get' ? 'readings' : 'alerts';
          const data = await dashboard.history(kind, request.payload);
          send(ws, { type: `${kind}.result`, requestId: request.requestId, payload: data });
        }
      }).catch((error) => send(ws, { type: 'error', requestId: request.requestId, error: publicError(error) })).finally(() => { pending--; });
    });
  });
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.alive) { ws.terminate(); continue; }
      ws.alive = false;
      ws.ping();
    }
  }, 30000);
  heartbeat.unref();
  return {
    broadcast(type, payload) {
      for (const ws of wss.clients) if (ws.deviceCode === payload.deviceCode) send(ws, { type, payload });
    },
    async close() {
      clearInterval(heartbeat);
      server.off('upgrade', upgrade);
      for (const ws of wss.clients) ws.terminate();
      await new Promise((resolve) => wss.close(resolve));
    },
  };
}
