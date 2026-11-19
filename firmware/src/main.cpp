#include <Arduino.h>
#include <DHT.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <math.h>

#include "config.h"
#include "telemetry.h"

DHT dht(DHT_PIN, DHT22);

float temperatureC = NAN;
float humidityPercent = NAN;
bool hasSample = false;
bool dhtValid = false;
bool humidityAlarm = false;
bool humidityBeep = false;
unsigned long humidityBeepStartedMs = 0;
bool confirmingHumidityChange = false;
bool buzzerOn = false;
bool previousWaterDetected = false;
bool confirmingDry = false;
unsigned long dryStartedMs = 0;
unsigned long lastSampleMs = 0;
TaskHandle_t monitorTask = nullptr;

// Wake loop() when the water sensor changes, even between DHT22 readings.
void ARDUINO_ISR_ATTR onWaterChange() {
  BaseType_t taskWoken = pdFALSE;
  vTaskNotifyGiveFromISR(monitorTask, &taskWoken);
  if (taskWoken == pdTRUE) {
    portYIELD_FROM_ISR();
  }
}

void setBuzzer(bool on) {
  int onLevel = BUZZER_ACTIVE_HIGH ? HIGH : LOW;
  int offLevel = BUZZER_ACTIVE_HIGH ? LOW : HIGH;
  digitalWrite(BUZZER_PIN, on ? onLevel : offLevel);
}

void updateHumidityAlarm() {
  // Two consecutive samples must agree before switching the alarm.
  bool shouldChange = humidityAlarm ? humidityPercent < HUMIDITY_CLEAR_BELOW
                                    : humidityPercent >= HUMIDITY_THRESHOLD;
  if (!dhtValid || !shouldChange) {
    confirmingHumidityChange = false;
  } else if (confirmingHumidityChange) {
    humidityAlarm = !humidityAlarm;
    humidityBeep = humidityAlarm;
    humidityBeepStartedMs = millis();
    confirmingHumidityChange = false;
  } else {
    confirmingHumidityChange = true;
  }
}

void updateBuzzer(bool waterDetected) {
  if (millis() - humidityBeepStartedMs >= HUMIDITY_BEEP_MS) {
    humidityBeep = false;
  }
  bool alarmNeeded = waterDetected || humidityBeep;

  if (alarmNeeded != buzzerOn) {
    setBuzzer(alarmNeeded);
    buzzerOn = alarmNeeded;
  }
}

void printReadings(bool waterDetected) {
  // The USB bridge reads these exact labels to build a measurement.
  Serial.println("------------------------------");
  Serial.printf("Water detected: %s\r\n", waterDetected ? "YES" : "NO");

  if (!hasSample) {
    Serial.println("DHT22 warming up; awaiting first reading.");
  } else if (dhtValid) {
    Serial.printf("Temperature: %.1f C\r\n", temperatureC);
    Serial.printf("Humidity: %.1f %%\r\n", humidityPercent);
  } else {
    Serial.println("FAULT: DHT22 reading failed; retrying on next sample.");
    Serial.printf("Check DHT VCC -> 3V3, GND -> GND, SDA -> GPIO %d.\r\n",
                  DHT_PIN);
  }

  if (waterDetected) {
    Serial.println("ALARM: Water detected!");
  } else if (!dhtValid && humidityAlarm) {
    Serial.println("ALARM: Humidity unavailable; previous high humidity alarm active.");
  } else if (humidityAlarm) {
    Serial.println("ALARM: High humidity detected!");
  } else if (!hasSample) {
    Serial.println(
        "STATUS: Awaiting temperature and humidity; water monitoring active.");
  } else if (!dhtValid) {
    Serial.println("STATUS: Humidity unavailable; water monitoring active.");
  } else {
    Serial.println("STATUS: NORMAL");
  }
}

bool readWaterSensor() {
  if (digitalRead(WATER_PIN) == LOW) {
    confirmingDry = false;
    return true;
  }

  if (!previousWaterDetected) {
    return false;
  }

  // Keep the wet state until the sensor has reported dry for long enough.
  if (!confirmingDry) {
    confirmingDry = true;
    dryStartedMs = millis();
  }

  confirmingDry = millis() - dryStartedMs < WATER_DRY_HOLD_MS;
  return confirmingDry;
}

void reportStatus(bool forceReport) {
  bool waterDetected = readWaterSensor();
  updateBuzzer(waterDetected);

  if (forceReport || waterDetected != previousWaterDetected) {
    if (dhtValid) {
      queueTelemetry(temperatureC, humidityPercent, waterDetected);
    }
    printReadings(waterDetected);
  }
  previousWaterDetected = waterDetected;
}

void sampleClimate() {
  humidityPercent = dht.readHumidity();
  temperatureC = dht.readTemperature();
  lastSampleMs = millis();
  hasSample = true;

  bool temperatureInRange = temperatureC >= -40.0f && temperatureC <= 80.0f;
  bool humidityInRange = humidityPercent >= 0.0f && humidityPercent <= 100.0f;
  dhtValid = temperatureInRange && humidityInRange;
  updateHumidityAlarm();

  if (!dhtValid) {
    temperatureC = NAN;
    humidityPercent = NAN;
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(BUZZER_PIN, OUTPUT);
  setBuzzer(false);
  pinMode(WATER_PIN, INPUT_PULLUP);
  monitorTask = xTaskGetCurrentTaskHandle();
  attachInterrupt(WATER_PIN, onWaterChange, CHANGE);

  dht.begin();
  lastSampleMs = millis();

  Serial.println("Document Storage Monitor");
  Serial.printf("DHT22 driver: Adafruit 1.4.7; sample interval: %lu ms\r\n",
                DHT_SAMPLE_INTERVAL_MS);
  Serial.printf("ESP32 CPU: %lu MHz\r\n",
                static_cast<unsigned long>(getCpuFrequencyMhz()));
  Serial.println("System initialized!");

  reportStatus(true);
  startTelemetry();
}

void loop() {
  reportStatus(false);

  unsigned long interval = hasSample ? DHT_SAMPLE_INTERVAL_MS : DHT_STARTUP_MS;
  unsigned long elapsed = millis() - lastSampleMs;
  if (elapsed >= interval) {
    sampleClimate();
    reportStatus(true);
    return;
  }

  unsigned long waitMs = interval - elapsed;
  if (humidityBeep) {
    unsigned long beepElapsed = millis() - humidityBeepStartedMs;
    unsigned long remaining = beepElapsed < HUMIDITY_BEEP_MS ? HUMIDITY_BEEP_MS - beepElapsed : 0;
    waitMs = min(waitMs, remaining);
  }
  if (confirmingDry) {
    unsigned long dryElapsed = millis() - dryStartedMs;
    unsigned long dryTimeLeft = 0;
    if (dryElapsed < WATER_DRY_HOLD_MS) {
      dryTimeLeft = WATER_DRY_HOLD_MS - dryElapsed;
    }
    waitMs = min(waitMs, dryTimeLeft);
  }

  // Wait for the next deadline or a GPIO change, whichever happens first.
  if (ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(waitMs)) > 0) {
    // Even if several edges arrived together, restart the dry confirmation.
    confirmingDry = false;
  }
}
