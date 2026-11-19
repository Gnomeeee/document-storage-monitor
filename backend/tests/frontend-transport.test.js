import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { WebSocket } from "ws";
import { attachWebSocket } from "../src/websocket.js";
import { createQueue } from "../src/utils/queue.js";
import { createMonitorClient } from "../../frontend/src/services/monitor.service.js";

async function waitFor(check) {
  const deadline = Date.now() + 5000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error("Frontend transport timed out");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
test(
  "frontend client subscribes, receives live events, changes filters and recovers over real WebSocket",
  { timeout: 15000 },
  async (t) => {
    const server = createServer();
    const queue = createQueue();
    const code = "DOC-ROOM-01";
    let snapshot = {
      device: { deviceCode: code },
      latest: null,
      activeAlerts: [],
      environmentalRisk: null,
      connectivity: "NO_DATA",
    };
    const historyCalls = [];
    const sockets = attachWebSocket(server, {
      queue,
      origins: ["http://localhost:5173"],
      dashboard: {
        snapshot: async () => snapshot,
        history: async (kind, payload) => {
          historyCalls.push({ kind, ...payload });
          return { deviceCode: code, items: [] };
        },
      },
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const connections = [];
    class BrowserSocket extends WebSocket {
      constructor(url) {
        super(url, { origin: "http://localhost:5173" });
        connections.push(this);
      }
    }
    const client = createMonitorClient({
      url: `ws://127.0.0.1:${server.address().port}/ws`,
      deviceCode: code,
      WebSocketImpl: BrowserSocket,
      retryBaseMs: 10,
    });
    t.after(async () => {
      client.stop();
      await sockets.close();
      await new Promise((resolve) => server.close(resolve));
    });
    client.start();
    await waitFor(
      () =>
        client.getSnapshot().snapshot &&
        historyCalls.length === 2 &&
        !client.getSnapshot().historyLoading,
    );
    assert.equal(client.getSnapshot().snapshot.environmentalRisk, null);
    const reading = {
      id: 10,
      receivedAt: new Date().toISOString(),
      humidityPercent: 68,
      temperatureC: 29,
      waterDetected: true,
    };
    const alert = {
      id: 20,
      type: "WATER",
      severity: "CRITICAL",
      status: "OPEN",
      startedAt: reading.receivedAt,
    };
    snapshot = {
      ...snapshot,
      latest: reading,
      activeAlerts: [alert],
      environmentalRisk: "CRITICAL",
      connectivity: "ONLINE",
    };
    await queue.run(() => {
      sockets.broadcast("reading.created", { deviceCode: code, reading });
      sockets.broadcast("alert.changed", { deviceCode: code, alert });
      sockets.broadcast("dashboard.snapshot", { deviceCode: code, ...snapshot });
    });
    await waitFor(() => client.getSnapshot().snapshot.environmentalRisk === "CRITICAL");
    assert.equal(client.getSnapshot().readings[0].id, 10);
    assert.equal(client.getSnapshot().alerts[0].id, 20);
    sockets.broadcast("device.status", {
      deviceCode: code,
      receivedAt: reading.receivedAt,
      connectivity: "OFFLINE",
    });
    await waitFor(() => client.getSnapshot().snapshot.connectivity === "OFFLINE");
    assert.equal(client.getSnapshot().snapshot.environmentalRisk, "CRITICAL");
    client.setRange(168);
    await waitFor(() => historyCalls.length === 4);
    assert.ok(Date.now() - Date.parse(historyCalls.at(-1).from) >= 167 * 3600000);
    connections[0].terminate();
    await waitFor(
      () =>
        connections.length === 2 &&
        client.getSnapshot().connection === "connected" &&
        historyCalls.length === 6,
    );
    assert.equal(client.getSnapshot().snapshot.latest.id, 10);
  },
);
