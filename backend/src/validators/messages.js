import { z } from 'zod';
import { AppError } from '../lib/errors.js';
export const deviceCode = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);
export const readingSchema = z.object({
  deviceId: deviceCode, readingUid: z.string().min(1).max(64).optional(),
  temperatureC: z.number().finite().min(-20).max(80), humidityPercent: z.number().finite().min(0).max(100), waterDetected: z.boolean(),
}).strict();
export function parseReading(topic, bytes, retained = false) {
  if (retained) throw new AppError('RETAINED_READING', 'Retained telemetry is not accepted.');
  if (bytes.length > 4096) throw new AppError('INVALID_READING', 'Reading exceeds the size limit.');
  let value;
  try { value = JSON.parse(bytes.toString()); } catch { throw new AppError('INVALID_READING', 'Invalid JSON.'); }
  const parsed = readingSchema.safeParse(value);
  if (!parsed.success) throw new AppError('INVALID_READING', 'Invalid measurement fields.');
  if (topic !== `dsms/${parsed.data.deviceId}/readings`) throw new AppError('DEVICE_MISMATCH', 'Topic and device identity do not match.');
  return parsed.data;
}
const historyPayload = z.object({
  deviceCode, from: z.string().datetime({ offset: true }).optional(), to: z.string().datetime({ offset: true }).optional(), limit: z.number().int().min(1).max(500).default(100),
}).strict().refine((p) => !p.from || !p.to || new Date(p.from) <= new Date(p.to));
const requestSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('dashboard.get'), requestId: z.string().min(1).max(64), payload: z.object({ deviceCode }).strict() }).strict(),
  ...['readings.get', 'alerts.get'].map((type) => z.object({ type: z.literal(type), requestId: z.string().min(1).max(64), payload: historyPayload }).strict()),
]);
export function parseRequest(bytes) {
  let value;
  try { value = JSON.parse(bytes.toString()); } catch { throw new AppError('INVALID_REQUEST', 'Invalid JSON.'); }
  const parsed = requestSchema.safeParse(value);
  if (!parsed.success) {
    const error = new AppError('INVALID_REQUEST', 'Invalid request type, identifier or filters.');
    error.requestId = typeof value?.requestId === 'string' && value.requestId.length <= 64 ? value.requestId : null;
    throw error;
  }
  return parsed.data;
}
