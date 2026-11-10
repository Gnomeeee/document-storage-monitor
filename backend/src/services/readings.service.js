import { AppError } from "../lib/errors.js";
import { applyAlertChanges, defaultRules } from "./alerts.service.js";

export function createReadingService(
  prisma,
  { rules = defaultRules, clock = () => new Date() } = {},
) {
  return {
    async ingest(payload) {
      return prisma.$transaction(async (tx) => {
        const devices =
          await tx.$queryRaw`SELECT "id", "isActive" FROM "Device" WHERE "deviceCode" = ${payload.deviceId} FOR UPDATE`;
        const device = devices[0];
        if (!device)
          throw new AppError("UNKNOWN_DEVICE", "Device is not registered.");
        if (!device.isActive)
          throw new AppError("INACTIVE_DEVICE", "Device is disabled.");
        if (payload.readingUid) {
          const existing = await tx.sensorReading.findUnique({
            where: {
              deviceId_readingUid: {
                deviceId: device.id,
                readingUid: payload.readingUid,
              },
            },
          });
          if (existing) {
            if (
              ["temperatureC", "humidityPercent", "waterDetected"].some(
                (key) => existing[key] !== payload[key],
              )
            )
              throw new AppError(
                "CONFLICTING_DUPLICATE",
                "Measurement identifier was reused with different values.",
              );
            return { duplicate: true, reading: existing, alerts: [] };
          }
        }
        const now = clock();
        const reading = await tx.sensorReading.create({
          data: {
            deviceId: device.id,
            readingUid: payload.readingUid ?? null,
            temperatureC: payload.temperatureC,
            humidityPercent: payload.humidityPercent,
            waterDetected: payload.waterDetected,
            receivedAt: now,
          },
        });
        const lookback =
          Math.max(
            rules.warningMs,
            rules.criticalMs,
            rules.humidityClearMs,
            rules.waterClearMs,
          ) + rules.gapMs;
        const recent = await tx.sensorReading.findMany({
          where: {
            deviceId: device.id,
            receivedAt: { gte: new Date(+now - lookback), lte: now },
          },
          orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
          take: 10000,
        });
        const openAlerts = await tx.alert.findMany({
          where: { deviceId: device.id, status: "OPEN" },
        });
        const alerts = await applyAlertChanges(
          tx,
          device.id,
          recent.reverse(),
          openAlerts,
          rules,
        );
        return { duplicate: false, reading, alerts };
      });
    },
  };
}
