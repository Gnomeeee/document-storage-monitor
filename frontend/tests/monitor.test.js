import test from "node:test";
import assert from "node:assert/strict";
import { createMonitorClient, mergeRecords } from "../src/services/monitor.service.js";
import { csvText } from "../src/utils/csv.js";

function fixture(options = {}) {
  const sockets = [];
  class FakeSocket {
    readyState = 0;
    sent = [];
    constructor() {
      sockets.push(this);
    }
    send(text) {
      this.sent.push(JSON.parse(text));
    }
    open() {
      this.readyState = 1;
      this.onopen?.();
    }
    receive(message) {
      this.onmessage?.({ data: JSON.stringify(message) });
    }
    close() {
      this.readyState = 3;
      this.onclose?.();
    }
  }
  const client = createMonitorClient({
    url: "ws://test/ws",
    deviceCode: "DOC-ROOM-01",
    WebSocketImpl: FakeSocket,
    heartbeatMs: 100000,
    ...options,
  });
  client.start();
  return {
    client,
    sockets,
    open: () => {
      sockets.at(-1).open();
      return sockets.at(-1);
    },
  };
}
const snapshot = {
  device: { deviceCode: "DOC-ROOM-01" },
  latest: null,
  activeAlerts: [],
  environmentalRisk: null,
  connectivity: "NO_DATA",
};
function respond(socket, type, payload) {
  const request = socket.sent.findLast((r) => r.type === type);
  socket.receive({
    type:
      type === "dashboard.get" ? "dashboard.snapshot" : type.replace(".get", ".result"),
    requestId: request.requestId,
    payload,
  });
}
const sampledAt = new Date().toISOString();
const row = (id) => ({ id, receivedAt: sampledAt, humidityPercent: 50 });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("empty snapshot stays unknown, malformed messages are ignored, history loads after subscription", (t) => {
  const { client, open } = fixture();
  t.after(client.stop);
  const socket = open();
  assert.equal(client.getSnapshot().snapshot, null);
  socket.receive(null);
  respond(socket, "dashboard.get", snapshot);
  assert.equal(client.getSnapshot().snapshot.environmentalRisk, null);
  assert.deepEqual(
    socket.sent.map((r) => r.type),
    ["dashboard.get", "readings.get", "alerts.get"],
  );
});

test("live readings survive a history response and repeated IDs are deduplicated", (t) => {
  const { client, open } = fixture();
  t.after(client.stop);
  const socket = open();
  respond(socket, "dashboard.get", snapshot);
  const live = row(2);
  socket.receive({
    type: "reading.created",
    payload: { deviceCode: "DOC-ROOM-01", reading: live },
  });
  respond(socket, "readings.get", { deviceCode: "DOC-ROOM-01", items: [row(1)] });
  socket.receive({
    type: "reading.created",
    payload: { deviceCode: "DOC-ROOM-01", reading: live },
  });
  assert.deepEqual(
    client.getSnapshot().readings.map((r) => r.id),
    [2, 1],
  );
});

test("changing time windows ignores late old requests and other devices", (t) => {
  const { client, open } = fixture();
  t.after(client.stop);
  const socket = open();
  respond(socket, "dashboard.get", snapshot);
  const oldId = socket.sent.find((r) => r.type === "readings.get").requestId;
  client.setRange(1);
  socket.receive({
    type: "readings.result",
    requestId: oldId,
    payload: { deviceCode: "DOC-ROOM-01", items: [row(1)] },
  });
  socket.receive({
    type: "reading.created",
    payload: { deviceCode: "OTHER", reading: row(2) },
  });
  assert.deepEqual(client.getSnapshot().readings, []);
  assert.equal(client.getSnapshot().rangeHours, 1);
});

test("alert clearance received during history load wins over the old open record", (t) => {
  const { client, open } = fixture();
  t.after(client.stop);
  const socket = open();
  respond(socket, "dashboard.get", snapshot);
  const alert = { id: 1, startedAt: new Date().toISOString(), status: "OPEN" };
  socket.receive({
    type: "alert.changed",
    payload: { deviceCode: "DOC-ROOM-01", alert: { ...alert, status: "CLEARED" } },
  });
  respond(socket, "alerts.get", { deviceCode: "DOC-ROOM-01", items: [alert] });
  assert.equal(client.getSnapshot().alerts[0].status, "CLEARED");
});

test("disconnect preserves last known snapshot and reconnect fetches fresh state", async (t) => {
  const { client, open, sockets } = fixture({ retryBaseMs: 5 });
  t.after(client.stop);
  const first = open();
  respond(first, "dashboard.get", snapshot);
  first.close();
  assert.equal(client.getSnapshot().connection, "disconnected");
  assert.equal(client.getSnapshot().snapshot.connectivity, "NO_DATA");
  await wait(20);
  assert.equal(sockets.length, 2);
  const second = open();
  assert.equal(second.sent[0].type, "dashboard.get");
  respond(second, "dashboard.get", {
    ...snapshot,
    connectivity: "ONLINE",
    latest: row(5),
  });
  first.receive({ type: "dashboard.snapshot", payload: snapshot });
  assert.equal(client.getSnapshot().snapshot.latest.id, 5);
});

test("request timeout releases loading and closes the unresponsive socket", async (t) => {
  const { client, open } = fixture({ timeoutMs: 10, retryBaseMs: 1000 });
  t.after(client.stop);
  const socket = open();
  await wait(30);
  assert.equal(socket.readyState, 3);
  assert.equal(client.getSnapshot().loading, false);
  assert.match(client.getSnapshot().error, /not responding/);
});

test("merge is bounded and CSV safely quotes multiline/formula cells", () => {
  const records = Array.from({ length: 510 }, (_, id) => row(id));
  assert.equal(mergeRecords([], records, "receivedAt").length, 500);
  const csv = csvText([["=formula", 'a"b', "line\nbreak"]]);
  assert.equal(csv, '"\'=formula","a""b","line\nbreak"');
});
