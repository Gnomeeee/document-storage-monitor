# ESP32 breadboard wiring guide

Use this guide to connect the three modules to the 38-pin USB-C ESP32-WROOM-32 board. The firmware is already on the board. Add and test one module at a time.

## 1. Gather the parts and find the labels

- ESP32-WROOM-32 development board, breadboard, and USB-C data cable.
- White DHT22 module with three pins marked `+`, `OUT`, and `−`.
- LM393 rain sensor control module with four pins marked `AO`, `DO`, `GND`, and `VCC`, plus the separate two-pin rain plate and its lead.
- Three-pin buzzer module marked `S`, `+`, and `−`. Check that the module is rated for 3.3 V power and signaling.
- Five female-to-male Dupont jumpers for the ESP32. The female socket slides over an ESP32 header pin and the male end plugs into a breadboard hole. Use male-to-male jumpers between breadboard holes. Female-to-male jumpers also let you connect a module that does not fit the breadboard.

Lay the ESP32 flat beside the breadboard, with the metal module facing up and the USB socket toward you. Read the printing next to its header pins under good light. Find `3V3`, any `GND`, and the pins labeled `4`, `26`, and `27` (sometimes labeled `IO4`, `IO26`, and `IO27`). These are GPIO numbers, so use the printed labels. The ESP32 stays beside the breadboard throughout the guide, leaving all the breadboard holes accessible. Header placement varies by board revision. If a label is unreadable, check the pinout for your exact board before connecting it. [Espressif DevKitC pinout reference](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html)

**Unplug USB before adding, removing, or moving wires.** USB powers the ESP32, and its `3V3` pin powers the modules. Keep `5V` or `VIN` unused and keep all modules on the same ground rail.

## 2. Set up the breadboard

Turn the breadboard so rows increase from top to bottom. The numbered holes in the middle are arranged like this:

```text
                 center gap
    A B C D E       ||       F G H I J
 5  o-o-o-o-o       ||       o-o-o-o-o  5
 6  o-o-o-o-o       ||       o-o-o-o-o  6
 7  o-o-o-o-o       ||       o-o-o-o-o  7
```

The five holes A5 through E5 share a metal strip. Row 6 has a separate strip, and the gap separates A–E from F–J. The long power rails run along the outside. Use one pair of rails on one side. If there is a break halfway along a rail, use the same continuous segment for every connection to that rail. If you have a multimeter, check continuity with USB unplugged.

1. Connect ESP32 `3V3` to a hole in the red `+` rail.
2. Connect ESP32 `GND` to a hole in the blue or black `−` rail.
3. Keep USB unplugged for the first module. Use red wires for power and black wires for ground if available.

The holes below are suggested positions on a board with at least 24 numbered rows. If the modules overlap or your board uses different row numbers, move the whole group to free rows and keep each pin on a different five-hole strip. Rotate a straight pin header so it follows the row numbers. For example, its pins can occupy E5, E6, and E7.

## 3. Install and test the DHT22

With USB unplugged, place the DHT22 so its three pins are each in a different strip. If its printed pin order matches the table, use these holes. If the order differs, follow the actual labels and use the matching row for each jumper. If the module body blocks the holes or its pins do not seat securely, run a female-to-male jumper from each labeled module pin to its assigned E hole.

| DHT22 pin | Example module hole | Connect from the same strip to |
| --- | --- | --- |
| `+` or `VCC` | E5 | A5 → red `+` rail |
| `OUT` or `DATA` | E6 | A6 → ESP32 `GPIO 4` |
| `−` or `GND` | E7 | A7 → blue `−` rail |

Reconnect USB. From the repository's `firmware` directory, open the monitor:

```powershell
pio device monitor --port COM3 --baud 115200
```

Wait a few seconds for `Temperature:` and `Humidity:`. If the monitor stays blank, tap `EN` once with `BOOT` released. If you see `FAULT: DHT22 reading failed`, unplug USB and check the module labels, wire seating and rail continuity. A `Water detected: NO` message at this stage cannot tell you whether the rain sensor works. Press **Ctrl+C** to close the monitor before unplugging USB.

## 4. Install and test the rain sensor

With USB unplugged, connect the two-pin rain plate to the **two-pin probe connector** on the LM393 module using its supplied lead. Place the plate beside the breadboard so it can be wet separately from the electronics. Mount the control module using separate strips for the four pins, or use female-to-male jumpers to reach the example holes.

| LM393 pin | Example module hole | Connect from the same strip to |
| --- | --- | --- |
| `AO` (analog output) | E12 | Leave this strip unused |
| `DO` (digital output, sometimes printed `D0`) | E13 | A13 → ESP32 `GPIO 27` |
| `GND` | E14 | A14 → blue `−` rail |
| `VCC` | E15 | A15 → red `+` rail |

Reconnect USB and reopen the monitor. Start with a clean, dry plate. Expect `Water detected: NO`. Put a small drop of water across two adjacent exposed traces on the **plate only**. Look for `Water detected: YES` and `ALARM: Water detected!`. Wipe the plate dry. The status should return to `NO` as soon as the LM393 reports dry. If the status flickers while wet, tune the LM393 threshold as described below.

To detect smaller drops, adjust the LM393 threshold screw in small increments. Recheck both a dry plate and a small drop after each adjustment. Choose a setting where the dry plate stays `NO` and the drop gives `YES`. The adjustment direction can vary by module. The ESP32 sees only the module's digital output, so it depends on the plate and threshold to register the drop in the first place. Keep liquid away from the ESP32, breadboard, and control module.

## 5. Install and test the buzzer

Close the monitor and unplug USB. Put each buzzer pin on its own strip or use female-to-male jumpers if the buzzer body covers nearby holes.

| Buzzer pin | Example module hole | Connect from the same strip to |
| --- | --- | --- |
| `S` (signal) | E22 | A22 → ESP32 `GPIO 26` |
| `+` or `VCC` | E23 | A23 → red `+` rail |
| `−` or `GND` | E24 | A24 → blue `−` rail |

Reconnect USB and reopen the monitor. Wet the plate again and confirm that the monitor reports an alarm and the buzzer sounds. Wipe the plate dry. The buzzer should quiet down after the water status clears if the measured humidity is below 75.5%. If the buzzer stays on, check for the humidity alarm as well as the wet-plate alarm.

The physical build is set for a low-trigger module. GPIO 26 drives `S` HIGH at idle and LOW during an alarm. For a confirmed high-trigger module, set `BUZZER_ACTIVE_HIGH` to `true` in [config.h](../firmware/include/config.h), then rebuild and upload. If the buzzer still sounds weak, check its 3.3 V rating and remove any shipping seal marked for removal.

## Final wiring check

| ESP32 label | Goes to |
| --- | --- |
| `3V3` | Red rail feeding DHT22 `+`, LM393 `VCC`, and buzzer `+` |
| `GND` | Blue rail shared by all three modules |
| `4` or `IO4` | DHT22 `OUT` |
| `27` or `IO27` | LM393 `DO` |
| `26` or `IO26` | Buzzer `S` |

Check that the rails are separate, that the three signal wires are on separate strips, and that the only wires to the rain plate come from the LM393 probe connector. The pin numbers, sampling timing, and alarm threshold are defined in [config.h](../firmware/include/config.h). The serial messages and alarm behavior are in [main.cpp](../firmware/src/main.cpp).
