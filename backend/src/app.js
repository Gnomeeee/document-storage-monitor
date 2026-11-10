import express from "express";
export function createApp({ prisma, mqttState }) {
  const app = express();
  app.disable("x-powered-by");
  app.get("/api/v1/health", async (_req, res) => {
    let database = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      database = true;
    } catch {
      /* Do not leak SQL or credentials. */
    }
    const broker = mqttState.connected && mqttState.subscribed;
    res
      .set("Cache-Control", "no-store")
      .status(database && broker ? 200 : 503)
      .json({
        status: database && broker ? "ok" : "degraded",
        dependencies: {
          database: database ? "up" : "down",
          mqtt: broker ? "up" : "down",
        },
        ingestion: {
          accepted: mqttState.accepted,
          duplicates: mqttState.duplicates,
          rejected: mqttState.rejected,
        },
      });
  });
  app.use((_req, res) =>
    res
      .status(404)
      .json({
        error: {
          code: "NOT_FOUND",
          message: "Use /ws for dashboard communication.",
        },
      }),
  );
  return app;
}
