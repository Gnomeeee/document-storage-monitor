export const defaultRules = { warningMs: 1800000, criticalMs: 900000, humidityClearMs: 600000, waterClearMs: 10000, gapMs: 180000 };
// Reconstruct qualification from persisted observations: restart-safe; silence never clears an incident.
function streakMs(readings, predicate, gapMs) {
  const last = readings.at(-1);
  if (!last || !predicate(last)) return -1;
  let start = +new Date(last.receivedAt);
  for (let i = readings.length - 2; i >= 0; i--) {
    const time = +new Date(readings[i].receivedAt);
    if (start - time > gapMs || !predicate(readings[i])) break;
    start = time;
  }
  return +new Date(last.receivedAt) - start;
}
export function planAlerts(readings, openAlerts, rules = defaultRules) {
  const latest = readings.at(-1);
  if (!latest) return [];
  const changes = [];
  const humidity = openAlerts.find((a) => a.type === 'HUMIDITY');
  const water = openAlerts.find((a) => a.type === 'WATER');
  const qualifies = (predicate, ms) => streakMs(readings, predicate, rules.gapMs) >= ms;
  const critical = qualifies((r) => r.humidityPercent >= 65, rules.criticalMs);
  const warning = qualifies((r) => r.humidityPercent >= 60, rules.warningMs);
  if (critical || warning) {
    const severity = critical ? 'CRITICAL' : 'WARNING';
    if (!humidity) changes.push({ action: 'open', type: 'HUMIDITY', severity, message: 'Sustained high humidity.' });
    else if (critical && humidity.severity !== 'CRITICAL') changes.push({ action: 'escalate', id: humidity.id, severity: 'CRITICAL', message: 'Humidity escalated to critical.' });
  } else if (humidity && qualifies((r) => r.humidityPercent < 58, rules.humidityClearMs)) changes.push({ action: 'clear', id: humidity.id });
  if (latest.waterDetected && !water) changes.push({ action: 'open', type: 'WATER', severity: 'CRITICAL', message: 'Water detected at the probe.' });
  if (!latest.waterDetected && water && qualifies((r) => !r.waterDetected, rules.waterClearMs)) changes.push({ action: 'clear', id: water.id });
  return changes;
}
export async function applyAlertChanges(tx, deviceId, readings, openAlerts, rules) {
  const changed = [];
  const now = readings.at(-1).receivedAt;
  for (const change of planAlerts(readings, openAlerts, rules)) {
    if (change.action === 'open') changed.push(await tx.alert.create({ data: { deviceId, type: change.type, severity: change.severity, message: change.message, startedAt: now } }));
    else changed.push(await tx.alert.update({ where: { id: change.id }, data: change.action === 'clear' ? { status: 'CLEARED', clearedAt: now } : { severity: change.severity, message: change.message } }));
  }
  return changed;
}
