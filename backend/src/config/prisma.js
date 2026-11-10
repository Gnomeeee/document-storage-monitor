import { PrismaClient } from "../generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
export function createPrisma(databaseUrl) {
  const url = new URL(databaseUrl);
  const schema = url.searchParams.get("schema") ?? "public";
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema))
    throw new Error("Invalid database schema identifier.");
  url.searchParams.delete("schema");
  const adapter = new PrismaPg(
    {
      connectionString: url.toString(),
      options: `-c search_path=${schema}`,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      statement_timeout: 10000,
    },
    { schema },
  );
  return new PrismaClient({
    adapter,
    transactionOptions: { maxWait: 5000, timeout: 15000 },
  });
}
