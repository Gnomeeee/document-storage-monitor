#pragma once

constexpr int DHT_PIN = 4;
constexpr int BUZZER_PIN = 26;
constexpr int WATER_PIN = 27;

constexpr float HUMIDITY_THRESHOLD = 75.5f;
constexpr float HUMIDITY_CLEAR_BELOW = 73.0f;

constexpr unsigned long DHT_STARTUP_MS = 2000;
constexpr unsigned long DHT_SAMPLE_INTERVAL_MS = 2500;
constexpr unsigned long WATER_DRY_HOLD_MS = 3000;
constexpr unsigned long HUMIDITY_BEEP_MS = 1000;
constexpr bool BUZZER_ACTIVE_HIGH = false;

static_assert(DHT_SAMPLE_INTERVAL_MS >= 2000,
              "DHT22 readings must be at least two seconds apart.");
