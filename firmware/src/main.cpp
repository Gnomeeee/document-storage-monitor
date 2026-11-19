#include <Arduino.h>
#include <DHT.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <math.h>

#include "config.h"

DHT dht(DHT_PIN, DHT22);

float temperatureC = NAN;
float humidityPercent = NAN;
bool hasSample = false;
bool dhtValid = false;
bool buzzerOn = false;
bool previousWaterDetected = false;
unsigned long lastSampleMs = 0;
TaskHandle_t monitorTask = nullptr;

void ARDUINO_ISR_ATTR onWaterChange() {
  BaseType_t taskWoken = pdFALSE;
  vTaskNotifyGiveFromISR(monitorTask, &taskWoken);
  if (taskWoken == pdTRUE) {
    portYIELD_FROM_ISR();
  }
}

void setBuzzer(bool on) {
#ifdef WOKWI_PASSIVE_BUZZER
  if (on) {
    tone(BUZZER_PIN, BUZZER_FREQUENCY_HZ);
  } else {
    noTone(BUZZER_PIN);
    digitalWrite(BUZZER_PIN, LOW);
  }
#else
  digitalWrite(BUZZER_PIN, on == BUZZER_ACTIVE_HIGH ? HIGH : LOW);
#endif
}

void updateBuzzer(bool waterDetected) {
  bool highHumidity = dhtValid && humidityPercent >= HUMIDITY_THRESHOLD;
  bool alarmNeeded = waterDetected || highHumidity;

  if (alarmNeeded != buzzerOn) {
    setBuzzer(alarmNeeded);
    buzzerOn = alarmNeeded;
  }
}

void printReadings(bool waterDetected) {
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
  } else if (dhtValid && humidityPercent >= HUMIDITY_THRESHOLD) {
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

void reportStatus(bool alwaysPrint) {
  bool waterDetected = digitalRead(WATER_PIN) == LOW;
  updateBuzzer(waterDetected);
  if (alwaysPrint || waterDetected != previousWaterDetected) {
    printReadings(waterDetected);
  }
  previousWaterDetected = waterDetected;
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
}

void loop() {
  reportStatus(false);
  unsigned long interval = hasSample ? DHT_SAMPLE_INTERVAL_MS : DHT_STARTUP_MS;
  unsigned long elapsed = millis() - lastSampleMs;
  if (elapsed < interval) {
    // A GPIO change wakes the task even while the next DHT sample is pending.
    ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(interval - elapsed));
    return;
  }

  humidityPercent = dht.readHumidity();
  temperatureC = dht.readTemperature();
  lastSampleMs = millis();
  hasSample = true;
  dhtValid = isfinite(temperatureC) && isfinite(humidityPercent) &&
             temperatureC >= -40.0f && temperatureC <= 80.0f &&
             humidityPercent >= 0.0f && humidityPercent <= 100.0f;

  if (!dhtValid) {
    temperatureC = NAN;
    humidityPercent = NAN;
  }
  reportStatus(true);
}
