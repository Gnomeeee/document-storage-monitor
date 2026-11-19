import { defaultRules } from "../config/monitoring.js";

function getContinuousDuration(readings, matchesCondition, maxGap) {
  const latest = readings.at(-1);
  if (!latest || !matchesCondition(latest)) return -1;

  const latestTime = new Date(latest.receivedAt).getTime();
  let startTime = latestTime;

  for (let index = readings.length - 2; index >= 0; index--) {
    const reading = readings[index];
    const readingTime = new Date(reading.receivedAt).getTime();

    if (startTime - readingTime > maxGap || !matchesCondition(reading)) break;
    startTime = readingTime;
  }

  return latestTime - startTime;
}

export function planAlerts(readings, openAlerts, rules = defaultRules) {
  const latest = readings.at(-1);
  if (!latest) return [];

  const changes = [];
  const humidityAlert = openAlerts.find((alert) => alert.type === "HUMIDITY");
  const waterAlert = openAlerts.find((alert) => alert.type === "WATER");

  function qualifies(condition, duration) {
    return getContinuousDuration(readings, condition, rules.gapMs) >= duration;
  }

  const criticalHumidity = qualifies(
    (reading) => reading.humidityPercent >= defaultRules.humidityCriticalPercent,
    rules.criticalMs,
  );
  const warningHumidity = qualifies(
    (reading) => reading.humidityPercent >= defaultRules.humidityWarningPercent,
    rules.warningMs,
  );
  const humidityRecovered = qualifies(
    (reading) => reading.humidityPercent < defaultRules.humidityClearBelowPercent,
    rules.humidityClearMs,
  );

  if (criticalHumidity || warningHumidity) {
    if (!humidityAlert) {
      changes.push({
        action: "open",
        type: "HUMIDITY",
        severity: criticalHumidity ? "CRITICAL" : "WARNING",
        message: "Sustained high humidity.",
      });
    } else if (criticalHumidity && humidityAlert.severity !== "CRITICAL") {
      changes.push({
        action: "escalate",
        id: humidityAlert.id,
        severity: "CRITICAL",
        message: "Humidity escalated to critical.",
      });
    }
  } else if (humidityAlert && humidityRecovered) {
    changes.push({ action: "clear", id: humidityAlert.id });
  }

  if (latest.waterDetected && !waterAlert) {
    changes.push({
      action: "open",
      type: "WATER",
      severity: "CRITICAL",
      message: "Water detected at the probe.",
    });
  }

  const waterRecovered = qualifies(
    (reading) => !reading.waterDetected,
    rules.waterClearMs,
  );

  if (waterAlert && waterRecovered) {
    changes.push({ action: "clear", id: waterAlert.id });
  }

  return changes;
}

export async function applyAlertChanges(
  transaction,
  deviceId,
  readings,
  openAlerts,
  rules,
) {
  const savedAlerts = [];
  const now = readings.at(-1).receivedAt;
  const changes = planAlerts(readings, openAlerts, rules);

  for (const change of changes) {
    let alert;

    if (change.action === "open") {
      alert = await transaction.alert.create({
        data: {
          deviceId,
          type: change.type,
          severity: change.severity,
          message: change.message,
          startedAt: now,
        },
      });
    } else {
      const data =
        change.action === "clear"
          ? { status: "CLEARED", clearedAt: now }
          : { severity: change.severity, message: change.message };

      alert = await transaction.alert.update({ where: { id: change.id }, data });
    }

    savedAlerts.push(alert);
  }

  return savedAlerts;
}
