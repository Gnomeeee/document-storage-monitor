import express from "express";

async function databaseIsAvailable(prisma) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export function createApp({ prisma, mqttState }) {
  const app = express();
  app.disable("x-powered-by");

  app.use((_request, response, next) => {
    response.set("Cache-Control", "no-store");
    response.set("X-Content-Type-Options", "nosniff");
    next();
  });

  const health = express.Router();
  health.get("/", async (_request, response) => {
    const databaseReady = await databaseIsAvailable(prisma);
    const mqttReady = mqttState.connected && mqttState.subscribed;
    const healthy = databaseReady && mqttReady;

    response.status(healthy ? 200 : 503).json({
      status: healthy ? "ok" : "degraded",
      dependencies: {
        database: databaseReady ? "up" : "down",
        mqtt: mqttReady ? "up" : "down",
      },
      ingestion: {
        accepted: mqttState.accepted ?? 0,
        duplicates: mqttState.duplicates ?? 0,
        rejected: mqttState.rejected ?? 0,
      },
    });
  });
  app.use("/api/v1/health", health);

  app.use((_request, response) => {
    response.status(404).json({
      error: { code: "NOT_FOUND", message: "Use /ws for dashboard communication." },
    });
  });

  // Express identifies error handlers by their four parameters.
  app.use((error, _request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }

    response.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "The request could not be completed." },
    });
  });

  return app;
}
