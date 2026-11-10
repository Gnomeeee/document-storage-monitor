import { loadEnv } from "./config/env.js";
import { createPrisma } from "./config/prisma.js";
import { startBackend } from "./runtime.js";
let prisma;
try {
  const env = loadEnv();
  prisma = createPrisma(env.DATABASE_URL);
  const backend = await startBackend({ prisma, env });
  console.log(
    `DSMS backend listening on ${env.HOST}:${env.PORT}; WebSocket path /ws`,
  );
  let stopping = false;
  async function stop() {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => process.exit(1), 20000);
    deadline.unref();
    await backend.close();
    clearTimeout(deadline);
  }
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () =>
      stop().catch(() => {
        process.exitCode = 1;
      }),
    );
} catch (error) {
  // Configuration errors contain field names only; database/network errors may contain secrets.
  console.error(
    error.message?.startsWith("Invalid configuration") ||
      error.message?.startsWith("ALLOWED_ORIGINS") ||
      error.message?.startsWith("OFFLINE_AFTER_MS")
      ? error.message
      : "Backend startup failed. Check configuration, database access, generated client and migrations.",
  );
  if (prisma) await prisma.$disconnect().catch(() => {});
  process.exitCode = 1;
}
