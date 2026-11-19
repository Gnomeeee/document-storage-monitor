import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createApp } from "../src/app.js";

test("health reports dependency failures safely and unknown routes return JSON", async (t) => {
  let databaseAvailable = true;
  const mqttState = { connected: true, subscribed: true };
  const prisma = {
    $queryRaw: async () => {
      if (!databaseAvailable) throw new Error("secret-db-password");
    },
  };
  const server = createServer(createApp({ prisma, mqttState }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      }),
  );
  const base = `http://127.0.0.1:${server.address().port}`;
  let response = await fetch(`${base}/api/v1/health`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-powered-by"), null);
  mqttState.subscribed = false;
  response = await fetch(`${base}/api/v1/health`);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).dependencies.mqtt, "down");
  databaseAvailable = false;
  response = await fetch(`${base}/api/v1/health`);
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /secret-db-password/);
  response = await fetch(`${base}/missing`);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, "NOT_FOUND");
});
