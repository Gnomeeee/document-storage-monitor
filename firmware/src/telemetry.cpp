#include "telemetry.h"

#include <Arduino.h>

#if __has_include("network_secrets.h")
#include "network_secrets.h"

#include <WiFi.h>
#include <atomic>
#include <cstring>
#include <esp_random.h>
#include <freertos/queue.h>
#include <mqtt_client.h>

namespace {
constexpr char deviceCode[] = DSMS_DEVICE_CODE;
constexpr char topic[] = "dsms/" DSMS_DEVICE_CODE "/readings";
constexpr char clientId[] = "dsms-node-" DSMS_DEVICE_CODE;
constexpr char brokerUri[] = DSMS_MQTT_URI;
constexpr int mqttQos = 1;

struct Reading {
  float temperatureC;
  float humidityPercent;
  bool waterDetected;
};

QueueHandle_t samples = nullptr;
esp_mqtt_client_handle_t mqtt = nullptr;
std::atomic<bool> connected{false};

void onMqttEvent(void *, esp_event_base_t, int32_t event, void *) {
  if (event == MQTT_EVENT_CONNECTED) {
    connected.store(true);
    Serial.println("MQTT connected.");
  } else if (event == MQTT_EVENT_DISCONNECTED) {
    connected.store(false);
    Serial.println("MQTT disconnected; retrying.");
  }
}

void publishReadings(void *) {
  unsigned long bootIdHigh = esp_random();
  unsigned long bootIdLow = esp_random();
  unsigned long sequence = 0;
  Reading reading;

  // This task waits for readings so MQTT work stays out of the sensor loop.
  while (true) {
    xQueueReceive(samples, &reading, portMAX_DELAY);
    if (!connected.load()) {
      continue;
    }

    char payload[256];
    int length = snprintf(
        payload, sizeof(payload),
        "{\"deviceId\":\"%s\",\"readingUid\":\"%08lx%08lx-%08lx\","
        "\"temperatureC\":%.1f,\"humidityPercent\":%.1f,\"waterDetected\":%s}",
        deviceCode, bootIdHigh, bootIdLow, ++sequence, reading.temperatureC,
        reading.humidityPercent, reading.waterDetected ? "true" : "false");
    if (length <= 0 || length >= static_cast<int>(sizeof(payload))) {
      continue;
    }

    int messageId = esp_mqtt_client_enqueue(mqtt, topic, payload, length, mqttQos,
                                            /*retain=*/false, /*store=*/true);
    if (messageId < 0) {
      Serial.println("MQTT could not queue a reading.");
    }
  }
}
}  // namespace

void startTelemetry() {
  constexpr char allowedCode[] =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  bool brokerUsesTls = strncmp(brokerUri, "mqtts://", 8) == 0;
  bool brokerUsesMqtt = strncmp(brokerUri, "mqtt://", 7) == 0;
  bool hasCredentials = DSMS_WIFI_SSID[0] && DSMS_MQTT_USERNAME[0] && DSMS_MQTT_PASSWORD[0];
  bool validDeviceCode = sizeof(deviceCode) >= 2 && sizeof(deviceCode) <= 65 &&
                         strspn(deviceCode, allowedCode) == strlen(deviceCode);
  if (!hasCredentials || !validDeviceCode || (!brokerUsesTls && !brokerUsesMqtt)) {
    Serial.println("MQTT disabled; check network_secrets.h.");
    return;
  }

  esp_mqtt_client_config_t options{};
  options.broker.address.uri = brokerUri;
  if (brokerUsesTls) {
#ifdef DSMS_MQTT_CA_PEM
    options.broker.verification.certificate = DSMS_MQTT_CA_PEM;
#else
    Serial.println("MQTT disabled; mqtts:// requires DSMS_MQTT_CA_PEM.");
    return;
#endif
  }
  options.credentials.client_id = clientId;
  options.credentials.username = DSMS_MQTT_USERNAME;
  options.credentials.authentication.password = DSMS_MQTT_PASSWORD;
  options.session.protocol_ver = MQTT_PROTOCOL_V_3_1_1;
  options.network.reconnect_timeout_ms = 3000;
  options.outbox.limit = 4096;

  samples = xQueueCreate(8, sizeof(Reading));
  if (samples == nullptr) {
    Serial.println("MQTT could not allocate its reading queue.");
    return;
  }

  mqtt = esp_mqtt_client_init(&options);
  if (mqtt == nullptr ||
      esp_mqtt_client_register_event(mqtt, MQTT_EVENT_ANY, onMqttEvent, nullptr) != ESP_OK ||
      xTaskCreate(publishReadings, "telemetry", 4096, nullptr, 1, nullptr) != pdPASS) {
    if (mqtt != nullptr) esp_mqtt_client_destroy(mqtt);
    vQueueDelete(samples);
    samples = nullptr;
    Serial.println("MQTT could not initialize.");
    return;
  }

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(DSMS_WIFI_SSID, DSMS_WIFI_PASSWORD);
  if (esp_mqtt_client_start(mqtt) != ESP_OK) {
    Serial.println("MQTT could not start.");
  }
}

void queueTelemetry(float temperatureC, float humidityPercent, bool waterDetected) {
  // The backend accepts temperatures down to -20 C.
  if (!connected.load() || temperatureC < -20.0f) {
    return;
  }

  Reading reading{temperatureC, humidityPercent, waterDetected};
  xQueueSend(samples, &reading, 0);
}

#else

void startTelemetry() {
  Serial.println("MQTT disabled; create include/network_secrets.h and rebuild.");
}

void queueTelemetry(float, float, bool) {}

#endif
