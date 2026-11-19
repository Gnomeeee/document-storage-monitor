# ESP32 firmware

The physical ESP32 reads the DHT22 and water sensor, drives the local buzzer, and sends valid readings to the dashboard. See the [wiring guide](../docs/ESP32_WIRING_GUIDE.md) for the physical connections.

## Connect the ESP32 to the dashboard

1. Set up PostgreSQL, the MQTT broker, and the backend using the [backend guide](../backend/README.md). Register the device and start the backend before testing the dashboard. The default broker account for the ESP32 is `DOC-ROOM-01`.
2. Make MQTT reachable from the ESP32 on your private Wi-Fi network. The checked-in broker configuration listens on loopback. To keep backend access on loopback and also serve the ESP32, add a second `listener 1883 <broker-LAN-IP>` to the active Mosquitto configuration. Keep password authentication and the topic ACL on both listeners. If Windows Firewall blocks the connection, allow inbound MQTT only from the private LAN or the ESP32's address. Never use `localhost` as the broker address on the ESP32.
3. From `firmware/`, create the ignored header if it does not already exist:

   ```powershell
   Copy-Item include/network_secrets.example.h include/network_secrets.h
   ```

4. Open `include/network_secrets.h` locally. Set the SSID and password of the ESP32's 2.4 GHz network, the broker URI (for example `mqtt://192.168.1.10:1883`), the registered device code, and the **device** broker account credentials. Across untrusted networks, use `mqtts://` and supply the broker CA in `DSMS_MQTT_CA_PEM`.
5. Close any serial monitor and flash the device:

   ```powershell
   pio run -e esp32dev -t upload --upload-port COM3
   pio device monitor --port COM3 --baud 115200
   ```

6. Look for `MQTT connected.` and valid temperature/humidity readings. Start the frontend from its own folder with `npm.cmd run dev`, then open `http://localhost:5173`. Confirm the latest reading updates. Wet and dry the plate to check that the water card follows the sensor. An open backend water alert clears according to the backend recovery rule.

Missing network settings disable telemetry. The buzzer and serial monitoring still work locally.

## USB connection for a Windows demo

Use USB when the broker is local to the PC or the ESP32 lacks Wi-Fi credentials. Plug in the ESP32, confirm its COM port and close any serial monitor. From `backend/`, run:

```powershell
npm.cmd run bridge:usb -- COM3
```

The bridge uses PlatformIO's Python environment to read valid sensor frames at 115200 baud and publishes them to the existing MQTT broker with the device account from `backend/.env`. Use `DEVICE_MQTT_USERNAME`, `DEVICE_MQTT_PASSWORD`, and `DEVICE_CODE`, or the existing `SIM_MQTT_*` and `SIM_DEVICE_CODE` settings for the same device account. Set `PIO_PYTHON` to the path of PlatformIO's Python if you installed it outside the default location. Keep MQTT publishing on either the ESP32 or the USB bridge for a given device. Stop the bridge with **Ctrl+C** before flashing or opening a serial monitor.

## Build and check the physical board

Open the `firmware` folder in VS Code with the PlatformIO extension installed. Run these commands from that folder:

```powershell
pio run -e esp32dev
pio run -e esp32dev -t upload
pio device monitor -b 115200
```

Check that the serial monitor shows temperature, humidity, and water status. With the humidity alarm clear, wet the plate and confirm the buzzer sounds. Lift and touch the wet plate again within three seconds. Expect one continuous wet indication. Wipe the plate and leave it dry for three seconds to clear the water state.

The DHT22 takes a sample every 2.5 seconds. Two consecutive valid samples at or above 75.5% RH turn the humidity alarm on. Two below 73% RH clear it. A failed sample restarts confirmation and preserves the previous alarm state. The dashboard shows measured humidity, and humidity produces one one-second beep per episode. The water alarm sounds continuously while wet.

## Source files

- `src/main.cpp` reads the sensors and controls the buzzer.
- `src/telemetry.cpp` sends valid readings over MQTT.
- `include/config.h` sets the pins, alarm threshold, and timing.
- `platformio.ini` defines the physical ESP32 build.
