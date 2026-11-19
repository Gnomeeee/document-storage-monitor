import { loadEnv } from "./config/env.js";
import { createPrisma } from "./config/prisma.js";
import { startServer } from "./startServer.js";
import { ConfigError } from "./utils/errors.js";

let prisma;

try {
  const env = loadEnv();
  prisma = createPrisma(env.DATABASE_URL);
  const backend = await startServer({ prisma, env });

  console.log(`Backend listening on ${env.HOST}:${env.PORT}`);

  let stopping = false;

  async function shutdown() {
    if (stopping) return;
    stopping = true;

    const deadline = setTimeout(() => process.exit(1), 20000);
    deadline.unref();

    try {
      await backend.close();
      clearTimeout(deadline);
    } catch {
      console.error("Backend shutdown failed.");
      process.exitCode = 1;
    }
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
} catch (error) {
  console.error(
    error instanceof ConfigError
      ? error.message
      : "Backend startup failed. Check database access, configuration and migrations.",
  );

  if (prisma) await prisma.$disconnect().catch(() => {});
  process.exitCode = 1;
}
