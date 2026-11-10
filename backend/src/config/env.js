import { config } from "dotenv";
import { z } from "zod";
config({ quiet: true });
const positive = (fallback) =>
  z.coerce.number().int().positive().default(fallback);
const schema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .refine((v) => /^postgres(ql)?:/.test(v)),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default("127.0.0.1"),
  CLIENT_URL: z.string().default("http://localhost:5173"),
  ALLOWED_ORIGINS: z.string().optional(),
  MQTT_URL: z
    .string()
    .url()
    .refine((v) => /^mqtts?:/.test(v))
    .default("mqtt://127.0.0.1:1883"),
  MQTT_USERNAME: z.string().min(1),
  MQTT_PASSWORD: z.string().min(1),
  MQTT_CLIENT_ID: z.string().min(1).default("dsms-backend"),
  MQTT_CA_FILE: z.string().optional(),
  STATUS_INTERVAL_MS: positive(5000),
  STALE_AFTER_MS: positive(180000),
  OFFLINE_AFTER_MS: positive(300000),
  WARNING_AFTER_MS: positive(1800000),
  CRITICAL_AFTER_MS: positive(900000),
  HUMIDITY_CLEAR_AFTER_MS: positive(600000),
  WATER_CLEAR_AFTER_MS: positive(10000),
  GAP_AFTER_MS: positive(180000),
  MAX_CONNECTIONS: positive(30),
});
export function loadEnv(source = process.env) {
  const parsed = schema.safeParse(source);
  if (!parsed.success)
    throw new Error(
      `Invalid configuration fields: ${[...new Set(parsed.error.issues.map((i) => i.path[0]))].join(", ")}`,
    );
  const env = parsed.data;
  env.origins = (env.ALLOWED_ORIGINS ?? env.CLIENT_URL)
    .split(",")
    .map((s) => s.trim());
  if (
    env.origins.some((v) => {
      try {
        return new URL(v).origin !== v;
      } catch {
        return true;
      }
    })
  )
    throw new Error(
      "ALLOWED_ORIGINS must contain exact origins without paths or trailing slashes.",
    );
  if (env.OFFLINE_AFTER_MS <= env.STALE_AFTER_MS)
    throw new Error("OFFLINE_AFTER_MS must exceed STALE_AFTER_MS.");
  return env;
}
export function alertRules(env) {
  return {
    warningMs: env.WARNING_AFTER_MS,
    criticalMs: env.CRITICAL_AFTER_MS,
    humidityClearMs: env.HUMIDITY_CLEAR_AFTER_MS,
    waterClearMs: env.WATER_CLEAR_AFTER_MS,
    gapMs: env.GAP_AFTER_MS,
  };
}
