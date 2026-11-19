import { AppError } from "../utils/errors.js";
import { defaultRules } from "../config/monitoring.js";

export function freshness(
  receivedAt,
  now,
  staleMs = defaultRules.staleMs,
  offlineMs = defaultRules.offlineMs,
) {
  if (!receivedAt) return "NO_DATA";

  const age = new Date(now).getTime() - new Date(receivedAt).getTime();

  if (age > offlineMs) return "OFFLINE";
  if (age > staleMs) return "STALE";
  return "ONLINE";
}

function getRisk(latest, alerts) {
  if (alerts.some((alert) => alert.severity === "CRITICAL")) return "CRITICAL";
  if (alerts.length > 0) return "WARNING";
  return latest ? "NORMAL" : null;
}

export function createDashboardService(
  prisma,
  { rules = defaultRules, clock = () => new Date() } = {},
) {
  async function findDevice(database, deviceCode) {
    const device = await database.device.findUnique({ where: { deviceCode } });

    if (!device) {
      throw new AppError("UNKNOWN_DEVICE", "Device is not registered.");
    }

    return device;
  }

  async function snapshot(deviceCode) {
    return prisma.$transaction(
      async (transaction) => {
        const device = await findDevice(transaction, deviceCode);
        const latest = await transaction.sensorReading.findFirst({
          where: { deviceId: device.id },
          orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
        });
        const activeAlerts = await transaction.alert.findMany({
          where: { deviceId: device.id, status: "OPEN" },
          orderBy: { id: "asc" },
        });

        return {
          deviceCode,
          device,
          latest,
          activeAlerts,
          monitoringRules: rules,
          environmentalRisk: getRisk(latest, activeAlerts),
          connectivity: freshness(
            latest?.receivedAt,
            clock(),
            rules.staleMs,
            rules.offlineMs,
          ),
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }

  async function history(kind, { deviceCode, from, to, limit }) {
    const device = await findDevice(prisma, deviceCode);
    const model = kind === "readings" ? prisma.sensorReading : prisma.alert;
    const dateField = kind === "readings" ? "receivedAt" : "startedAt";
    const period = {};

    if (from) period.gte = new Date(from);
    if (to) period.lte = new Date(to);

    const items = await model.findMany({
      where: { deviceId: device.id, [dateField]: period },
      orderBy: [{ [dateField]: "desc" }, { id: "desc" }],
      take: limit,
    });

    return { deviceCode, items };
  }

  async function statuses() {
    const devices = await prisma.device.findMany({
      select: {
        deviceCode: true,
        readings: {
          take: 1,
          orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
          select: { receivedAt: true },
        },
      },
    });

    return devices.map((device) => {
      const receivedAt = device.readings[0]?.receivedAt ?? null;

      return {
        deviceCode: device.deviceCode,
        receivedAt,
        connectivity: freshness(receivedAt, clock(), rules.staleMs, rules.offlineMs),
      };
    });
  }

  return { snapshot, history, statuses };
}
