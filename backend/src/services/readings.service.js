import { AppError } from "../utils/errors.js";
import { applyAlertChanges } from "./alerts.service.js";
import { defaultRules } from "../config/monitoring.js";

export function createReadingService(
  prisma,
  { rules = defaultRules, clock = () => new Date() } = {},
) {
  async function ingest(payload) {
    return prisma.$transaction(async (transaction) => {
      const values = {
        temperatureC: payload.temperatureC,
        humidityPercent: payload.humidityPercent,
        waterDetected: payload.waterDetected,
      };

      // Lock this device so concurrent readings cannot open duplicate alerts.
      const devices =
        await transaction.$queryRaw`SELECT "id", "isActive" FROM "Device" WHERE "deviceCode" = ${payload.deviceId} FOR UPDATE`;
      const device = devices[0];
      if (!device) throw new AppError("UNKNOWN_DEVICE", "Device is not registered.");
      if (!device.isActive) {
        throw new AppError("INACTIVE_DEVICE", "Device is disabled.");
      }

      if (payload.readingUid) {
        const existing = await transaction.sensorReading.findUnique({
          where: {
            deviceId_readingUid: {
              deviceId: device.id,
              readingUid: payload.readingUid,
            },
          },
        });
        if (existing) {
          if (Object.keys(values).some((key) => existing[key] !== values[key])) {
            throw new AppError(
              "CONFLICTING_DUPLICATE",
              "Measurement identifier was reused with different values.",
            );
          }
          return { duplicate: true, reading: existing, alerts: [] };
        }
      }

      const now = clock();
      const reading = await transaction.sensorReading.create({
        data: {
          deviceId: device.id,
          readingUid: payload.readingUid ?? null,
          ...values,
          receivedAt: now,
        },
      });

      // Load enough history to check both opening and closing rules.
      const lookback =
        Math.max(
          rules.warningMs,
          rules.criticalMs,
          rules.humidityClearMs,
          rules.waterClearMs,
        ) + rules.gapMs;
      const recent = await transaction.sensorReading.findMany({
        where: {
          deviceId: device.id,
          receivedAt: { gte: new Date(now.getTime() - lookback), lte: now },
        },
        orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
        take: 10000,
      });
      const openAlerts = await transaction.alert.findMany({
        where: { deviceId: device.id, status: "OPEN" },
      });
      const alerts = await applyAlertChanges(
        transaction,
        device.id,
        recent.reverse(),
        openAlerts,
        rules,
      );
      return { duplicate: false, reading, alerts };
    });
  }

  return { ingest };
}
