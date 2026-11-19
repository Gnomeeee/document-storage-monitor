export function createHealthController({ prisma, mqttState }) {
  return async (_req, res) => {
    let database = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      database = true;
    } catch {
      /* Never expose database errors or credentials. */
    }
    const broker = Boolean(mqttState.connected && mqttState.subscribed);
    res.status(database && broker ? 200 : 503).json({
      status: database && broker ? "ok" : "degraded",
      dependencies: { database: database ? "up" : "down", mqtt: broker ? "up" : "down" },
      ingestion: {
        accepted: mqttState.accepted ?? 0,
        duplicates: mqttState.duplicates ?? 0,
        rejected: mqttState.rejected ?? 0,
      },
    });
  };
}
