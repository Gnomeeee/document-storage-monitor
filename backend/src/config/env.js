import { config } from "dotenv";
import { z } from "zod";
import { defaultRules } from "./monitoring.js";
import { ConfigError } from "../utils/errors.js";

config({ quiet: true });

function positiveNumber(fallback) {
  return z.coerce.number().int().positive().max(2147483647).default(fallback);
}

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .refine((value) => /^postgres(ql)?:/.test(value)),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().min(1).default("127.0.0.1"),
  CLIENT_URL: z.string().default("http://localhost:5173"),
  ALLOWED_ORIGINS: z.string().optional(),
  MQTT_URL: z
    .string()
    .url()
    .refine((value) => /^mqtts?:/.test(value))
    .default("mqtt://127.0.0.1:1883"),
  MQTT_USERNAME: z.string().min(1),
  MQTT_PASSWORD: z.string().min(1),
  MQTT_CLIENT_ID: z.string().min(1).default("dsms-backend"),
  MQTT_CA_FILE: z.string().optional(),
  STATUS_INTERVAL_MS: positiveNumber(5000),
  STALE_AFTER_MS: positiveNumber(defaultRules.staleMs),
  OFFLINE_AFTER_MS: positiveNumber(defaultRules.offlineMs),
  WARNING_AFTER_MS: positiveNumber(defaultRules.warningMs),
  CRITICAL_AFTER_MS: positiveNumber(defaultRules.criticalMs),
  HUMIDITY_CLEAR_AFTER_MS: positiveNumber(defaultRules.humidityClearMs),
  WATER_CLEAR_AFTER_MS: positiveNumber(defaultRules.waterClearMs),
  GAP_AFTER_MS: positiveNumber(defaultRules.gapMs),
  MAX_CONNECTIONS: positiveNumber(30),
});

function isValidOrigin(origin) {
  try {
    const url = new URL(origin);
    return ["http:", "https:"].includes(url.protocol) && url.origin === origin;
  } catch {
    return false;
  }
}

export function loadEnv(source = process.env) {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path[0]);
    throw new ConfigError(
      `Invalid configuration fields: ${[...new Set(fields)].join(", ")}`,
    );
  }

  const env = result.data;
  env.origins = (env.ALLOWED_ORIGINS ?? env.CLIENT_URL)
    .split(",")
    .map((origin) => origin.trim());

  if (!env.origins.every(isValidOrigin)) {
    throw new ConfigError(
      "ALLOWED_ORIGINS must contain HTTP(S) origins without paths or trailing slashes.",
    );
  }

  if (env.OFFLINE_AFTER_MS <= env.STALE_AFTER_MS) {
    throw new ConfigError("OFFLINE_AFTER_MS must exceed STALE_AFTER_MS.");
  }

  return env;
}
