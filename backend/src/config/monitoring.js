export const defaultRules = {
  humidityWarningPercent: 60,
  humidityCriticalPercent: 65,
  humidityClearBelowPercent: 58,
  warningMs: 30 * 60 * 1000,
  criticalMs: 15 * 60 * 1000,
  humidityClearMs: 10 * 60 * 1000,
  waterClearMs: 10 * 1000,
  gapMs: 3 * 60 * 1000,
  staleMs: 3 * 60 * 1000,
  offlineMs: 5 * 60 * 1000,
};

export function getMonitoringRules(env) {
  return {
    ...defaultRules,
    warningMs: env.WARNING_AFTER_MS,
    criticalMs: env.CRITICAL_AFTER_MS,
    humidityClearMs: env.HUMIDITY_CLEAR_AFTER_MS,
    waterClearMs: env.WATER_CLEAR_AFTER_MS,
    gapMs: env.GAP_AFTER_MS,
    staleMs: env.STALE_AFTER_MS,
    offlineMs: env.OFFLINE_AFTER_MS,
  };
}
