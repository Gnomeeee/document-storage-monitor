#pragma once

constexpr int DHT_PIN = 4;
constexpr int BUZZER_PIN = 26;
constexpr int WATER_PIN = 27;

constexpr float HUMIDITY_THRESHOLD = 60.0f;
// Allow startup, then leave more than the DHT22's minimum 2 s between reads.
constexpr unsigned long DHT_STARTUP_MS = 2000;
constexpr unsigned long DHT_SAMPLE_INTERVAL_MS = 2500;
constexpr unsigned long LOOP_PAUSE_MS = 10;
constexpr unsigned int BUZZER_FREQUENCY_HZ = 1000;

static_assert(DHT_SAMPLE_INTERVAL_MS >= 2000,
              "DHT22 readings must be at least two seconds apart.");
