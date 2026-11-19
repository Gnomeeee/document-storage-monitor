import express from "express";
import { createHealthRouter } from "./routes/health.routes.js";
import { responseHeaders, notFound, errorHandler } from "./middleware/http.js";

export function createApp({ prisma, mqttState }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(responseHeaders);
  app.use("/api/v1/health", createHealthRouter({ prisma, mqttState }));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
