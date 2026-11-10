import { createServer } from "node:http";
import { createApp } from "./app.js";
import { createQueue } from "./lib/queue.js";
import { createReadingService } from "./services/readings.service.js";
import { createDashboardService } from "./services/dashboard.service.js";
import { attachWebSocket } from "./websocket/server.js";
import { connectMqtt } from "./mqtt/client.js";
import { alertRules } from "./config/env.js";

export async function startBackend({ prisma, env, logger = console }) {
  await prisma.$connect();

  await prisma.device.count();
  const queue = createQueue();
  const readings = createReadingService(prisma, { rules: alertRules(env) });
  const dashboard = createDashboardService(prisma, {
    staleMs: env.STALE_AFTER_MS,
    offlineMs: env.OFFLINE_AFTER_MS,
  });
  const mqttState = {};
  const server = createServer(createApp({ prisma, mqttState }));
  const sockets = attachWebSocket(server, {
    dashboard,
    queue,
    origins: env.origins,
    maxConnections: env.MAX_CONNECTIONS,
  });
  let mqtt;
  try {
    mqtt = connectMqtt({
      env,
      queue,
      readings,
      dashboard,
      broadcast: (type, payload) =>
        sockets.broadcast(
          type,
          type === "dashboard.snapshot"
            ? { ...payload, deviceCode: payload.device.deviceCode }
            : payload,
        ),
      logger,
    });

    for (const key of Object.keys(mqtt.state))
      Object.defineProperty(mqttState, key, { get: () => mqtt.state[key] });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(env.PORT, env.HOST, () => {
        server.off("error", reject);
        resolve();
      });
    });
  } catch (error) {
    if (mqtt) await mqtt.close();
    await sockets.close();
    throw error;
  }
  const lastStatus = new Map();
  let ticking = false;
  const timer = setInterval(() => {
    if (ticking) return;
    ticking = true;
    queue
      .run(async () => {
        for (const status of await dashboard.statuses()) {
          if (lastStatus.get(status.deviceCode) !== status.connectivity) {
            lastStatus.set(status.deviceCode, status.connectivity);
            sockets.broadcast("device.status", status);
          }
        }
      })
      .catch(() => logger.warn("Freshness check unavailable."))
      .finally(() => {
        ticking = false;
      });
  }, env.STATUS_INTERVAL_MS);
  timer.unref();
  return {
    server,
    mqtt,
    queue,
    async close() {
      clearInterval(timer);
      await mqtt.close();
      await sockets.close();
      await new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      });
      await queue.drain();
      await prisma.$disconnect();
    },
  };
}
