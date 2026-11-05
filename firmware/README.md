# Firmware and Wokwi simulator

This is the local sensor learning prototype, not the completed SRS implementation.
It reads the DHT22, interprets a switch as a digital water probe, and sounds a
buzzer for water or immediate RH >= 60%. Water alarms remain usable on DHT failure.
Wi-Fi/API ingestion, timed humidity qualification, debounce, and recovery timers
are still future work. DHT reads are scheduled every 2.5 seconds while water is
checked between readings, including during the two-second sensor startup period.

## Structure

- `src/main.cpp`: setup, readings, buzzer control, serial output.
- `include/config.h`: pins and initial learning thresholds.
- `platformio.ini`: ESP32 Arduino framework and DHT library build configuration.
- `diagram.json`: arranged simulator components, connections, and equipment labels.
- `wokwi.toml`: compiled binary paths for the VS Code simulator.
- `docs/HARDWARE.md`: every physical item in SRS Appendix A and its representation.
- `test/MANUAL_TESTS.md`: repeatable simulator checks.
- `test/scenarios/dht22.yaml`: automated Wokwi regression for real sensor readings.
- `lib/`: reserved for project libraries; none required yet.

## Setup and run

Install VS Code, PlatformIO IDE, and Wokwi Simulator extensions. Complete any
Wokwi account/license setup requested by the extension. Open this `firmware`
folder in VS Code, then use PlatformIO Build (checkmark). Open the command
palette and run `Wokwi: Start Simulator`. Stop and restart after diagram edits;
rebuild and restart after C++ or header edits.

From a PlatformIO terminal, with this folder as the working directory:

```powershell
pio run -e esp32dev
pio run -e esp32dev -t upload
pio device monitor -b 115200
```

Only the first command is needed for simulation. Upload and device monitor are
for a connected physical board. PlatformIO Core 6.x installs the pinned
Espressif32 8.0.0 / Arduino-ESP32 3.3.12 toolchain, Adafruit DHT 1.4.7, and
Adafruit Unified Sensor 1.1.15. Node.js is not required. There is no separate
C++ lint command. Run the manual tests after a successful build.

If `pio` is not on PATH, use the PlatformIO terminal in VS Code, or on this
Windows installation run:

```powershell
& "$env:USERPROFILE/.platformio/penv/Scripts/platformio.exe" run -e esp32dev
```

## DHT22 timeout repair

The previous DHTesp read path returned TIMEOUT repeatedly. This version replaces
it with the Adafruit driver used in Wokwi's own ESP32/DHT22 regression project.
The driver initializes the data pin, sends a precisely timed request, reads the
reply, and verifies its checksum. `readHumidity()` and `readTemperature()` share
one transaction; they do not request two measurements back to back.

Both the firmware and simulated ESP32 now specify 240 MHz, matching that
reference project. The first read waits two seconds for startup; later reads
are 2.5 seconds apart. Invalid or out-of-range values produce a fault and are
retried next time. They are never replaced with made-up temperature/humidity.
Water detection remains independent of the DHT result.

The precise cause of the old timeout has not been established by a signal trace.
These changes align the driver and clock configuration with the simulator's
reference rather than assuming the earlier GPIO initialization workaround fixed it.

On restart, look for `DHT22 driver: Adafruit 1.4.7` and `ESP32 CPU: 240 MHz`.
If those lines are absent, the simulator is running an older binary: build this
folder and restart Wokwi. After startup, the default sensor settings should give:

```text
Temperature: 28.0 C
Humidity: 50.0 %
STATUS: NORMAL
```

References:
- [Wokwi's ESP32/DHT22 test](https://github.com/wokwi/wokwi-part-tests/tree/main/wokwi-dht22/dht22-esp32)
- [Adafruit DHT driver](https://github.com/adafruit/DHT-sensor-library)

## Automated simulator regression (optional CLI)

With Wokwi CLI installed and your own `WOKWI_CLI_TOKEN` configured outside source
control, run from `firmware/`:

```powershell
wokwi-cli . --scenario test/scenarios/dht22.yaml --timeout 30000 --fail-text "FAULT: DHT22"
```

Use the default diagram with the water switch dry. The scenario requires two
valid readings, changes both sensor values, checks the humidity alarm, and tests
negative temperature and recovery. A build alone cannot pass these runtime checks.
See [Wokwi CLI setup](https://docs.wokwi.com/wokwi-ci/cli-usage).

## Using the simulation

Click DHT22 to change temperature and humidity. Flip the water switch and read
`Water detected: YES/NO` to identify its state. The unconnected switch terminal is
dry because INPUT_PULLUP holds GPIO 27 high; grounding it represents wet.
Allow up to about 2.5 seconds for temperature/humidity updates. Water changes are
checked between sensor transactions. The buzzer represents an audible warning,
not the exact electrical behavior of a purchased active buzzer module.

See [hardware mapping](docs/HARDWARE.md) and [manual tests](test/MANUAL_TESTS.md).
