#pragma once

constexpr int DHT_PIN = 4;
constexpr int BUZZER_PIN = 26;
constexpr int WATER_PIN = 27;

constexpr float HUMIDITY_THRESHOLD = 75.5f;

constexpr unsigned long DHT_STARTUP_MS = 2000;
constexpr unsigned long DHT_SAMPLE_INTERVAL_MS = 2000;
constexpr bool BUZZER_ACTIVE_HIGH = false;

#ifdef WOKWI_PASSIVE_BUZZER
constexpr unsigned int BUZZER_FREQUENCY_HZ = 2000;
#endif

static_assert(DHT_SAMPLE_INTERVAL_MS >= 2000,
              "DHT22 readings must be at least two seconds apart.");
