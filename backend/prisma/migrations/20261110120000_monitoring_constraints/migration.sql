-- Fail on inconsistent existing data instead of silently deleting history.
BEGIN;
CREATE UNIQUE INDEX "Alert_one_open_per_device_type" ON "Alert" ("deviceId", "type") WHERE "status" = 'OPEN';
ALTER TABLE "SensorReading"
ADD CONSTRAINT "SensorReading_temperature_range" CHECK ("temperatureC" >= -20 AND "temperatureC" <= 80),
ADD CONSTRAINT "SensorReading_humidity_range" CHECK ("humidityPercent" >= 0 AND "humidityPercent" <= 100),
ADD CONSTRAINT "SensorReading_uid_length" CHECK ("readingUid" IS NULL OR length("readingUid") BETWEEN 1 AND 64);
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_clearance_consistency" CHECK (
  ("status" = 'OPEN' AND "clearedAt" IS NULL) OR
  ("status" = 'CLEARED' AND "clearedAt" IS NOT NULL AND "clearedAt" >= "startedAt")
);
COMMIT;
