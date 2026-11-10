import "dotenv/config";
import { createPrisma } from "../src/config/prisma.js";
let prisma;
try {
  prisma = createPrisma(process.env.DATABASE_URL);
  await prisma.device.upsert({
    where: { deviceCode: "DOC-ROOM-01" },
    update: {},
    create: {
      deviceCode: "DOC-ROOM-01",
      name: "Records Room Monitor",
      location: "Records Room",
    },
  });
  console.log("DOC-ROOM-01 registered (existing settings preserved).");
} catch {
  console.error(
    "Device registration failed. Check database configuration and migrations.",
  );
  process.exitCode = 1;
} finally {
  if (prisma) await prisma.$disconnect();
}
