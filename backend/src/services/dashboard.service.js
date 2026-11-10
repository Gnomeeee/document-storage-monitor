import { AppError } from '../lib/errors.js';
export function freshness(receivedAt, now, staleMs = 180000, offlineMs = 300000) {
  if (!receivedAt) return 'NO_DATA';
  const age = +now - +new Date(receivedAt);
  return age > offlineMs ? 'OFFLINE' : age > staleMs ? 'STALE' : 'ONLINE';
}
export function createDashboardService(prisma, { staleMs = 180000, offlineMs = 300000, clock = () => new Date() } = {}) {
  async function findDevice(db, deviceCode) {
    const device = await db.device.findUnique({ where: { deviceCode } });
    if (!device) throw new AppError('UNKNOWN_DEVICE', 'Device is not registered.');
    return device;
  }
  return {
    async snapshot(deviceCode) {
      return prisma.$transaction(async (tx) => {
        const device = await findDevice(tx, deviceCode);
        const latest = await tx.sensorReading.findFirst({ where: { deviceId: device.id }, orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }] });
        const activeAlerts = await tx.alert.findMany({ where: { deviceId: device.id, status: 'OPEN' }, orderBy: { id: 'asc' } });
        return { device, latest, activeAlerts, environmentalRisk: activeAlerts.some((a) => a.severity === 'CRITICAL') ? 'CRITICAL' : activeAlerts.length ? 'WARNING' : latest ? 'NORMAL' : null, connectivity: freshness(latest?.receivedAt, clock(), staleMs, offlineMs) };
      }, { isolationLevel: 'RepeatableRead' });
    },
    async history(kind, { deviceCode, from, to, limit }) {
      const device = await findDevice(prisma, deviceCode);
      const timeField = kind === 'readings' ? 'receivedAt' : 'startedAt';
      const filter = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };
      const items = await prisma[kind === 'readings' ? 'sensorReading' : 'alert'].findMany({ where: { deviceId: device.id, [timeField]: filter }, orderBy: [{ [timeField]: 'desc' }, { id: 'desc' }], take: limit });
      return { deviceCode, items };
    },
    async statuses() {
      const devices = await prisma.device.findMany({ select: { deviceCode: true, readings: { take: 1, orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }], select: { receivedAt: true } } } });
      return devices.map((d) => ({ deviceCode: d.deviceCode, receivedAt: d.readings[0]?.receivedAt ?? null, connectivity: freshness(d.readings[0]?.receivedAt, clock(), staleMs, offlineMs) }));
    },
  };
}
