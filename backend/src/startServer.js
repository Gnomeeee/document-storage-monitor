import { createServer } from "node:http";
import { createApp } from "./app.js";
import { createQueue } from "./utils/queue.js";
import { getMonitoringRules } from "./config/monitoring.js";
import { createReadingService } from "./services/readings.service.js";
import { createDashboardService } from "./services/dashboard.service.js";
import { attachWebSocket } from "./websocket.js";
import { connectMqtt, createMqttState } from "./mqtt.js";

export async function startServer({ prisma, env, logger = console }) {
  await prisma.$connect();
  await prisma.device.count();

  const rules = getMonitoringRules(env);
  const queue = createQueue();
  const readings = createReadingService(prisma, { rules });
  const dashboard = createDashboardService(prisma, { rules });
  const mqttState = createMqttState();
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
      state: mqttState,
      queue,
      readings,
      dashboard,
      broadcast: sockets.broadcast,
      logger,
    });

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
  let checkingStatus = false;

  async function checkDeviceStatus() {
    if (checkingStatus) return;
    checkingStatus = true;

    try {
      await queue.run(async () => {
        const statuses = await dashboard.statuses();

        for (const status of statuses) {
          if (lastStatus.get(status.deviceCode) === status.connectivity) continue;
          lastStatus.set(status.deviceCode, status.connectivity);
          sockets.broadcast("device.status", status);
        }
      });
    } catch {
      logger.warn("Device status check failed.");
    } finally {
      checkingStatus = false;
    }
  }

  const statusTimer = setInterval(checkDeviceStatus, env.STATUS_INTERVAL_MS);
  statusTimer.unref();

  async function close() {
    clearInterval(statusTimer);
    await mqtt.close();
    await sockets.close();
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
    await queue.drain();
    await prisma.$disconnect();
  }

  return { server, mqtt, queue, close };
}
