# SRS hardware mapping

The simulator layout groups controller/power on the left, sensors and alarm on
the right, and physical installation/validation accessories below. Text labels
represent accessories, not working electrical models. Jumper wires connect the
functional parts directly; the breadboard is a layout reference, not in the circuit.

| SRS Appendix A item                  | Simulator representation                                                                            |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| ESP32 DevKit                         | ESP32 DevKit C V4 board                                                                             |
| DHT22 module                         | Interactive DHT22, initially 28 C and 50% RH                                                        |
| Water detection module/probe         | Slide switch substitutes for digital wet/dry output; does not model corrosion or analog sensitivity |
| 3.3V-compatible active buzzer module | Wokwi piezo buzzer driven by tone(); substitute, not an active-module electrical model              |
| Breadboard and jumper kit            | Breadboard layout reference plus connected colored jumper wires                                     |
| USB data cable                       | Power/upload label beside ESP32; simulated power is implicit                                        |
| Regulated 5V USB adapter             | Same power label; no external mains circuit                                                         |
| Protective project enclosure         | Physical-only installation label                                                                    |
| Mounting materials                   | Physical-only installation label                                                                    |
| Reference hygrometer                 | Physical-only validation label; simulation cannot measure real sensor accuracy                      |
| Test tray and dropper                | Physical-only validation label; switch substitutes for wetting a probe                              |

## Pin map (SRS section 3.1)

| Signal              | ESP32   | Connection                                      |
| ------------------- | ------- | ----------------------------------------------- |
| DHT power           | 3V3     | DHT VCC                                         |
| DHT data            | GPIO 4  | DHT SDA                                         |
| Water digital input | GPIO 27 | Switch center; one outside terminal goes to GND |
| Buzzer output       | GPIO 26 | Piezo positive pin 2                            |
| Ground              | GND     | DHT GND, piezo pin 1, water switch              |

The diagram's ESP32 frequency is explicitly 240 MHz, matching `board_build.f_cpu`
in `platformio.ini`. The Adafruit DHT driver's `begin()` configures the data pin's
internal pull-up. A bare physical DHT22 may also need an external data pull-up;
check the purchased module's instructions (modules may already include one).

The optional analog input in the SRS is not used. For physical assembly, confirm
the purchased probe output polarity, buzzer driver requirements, and module
ratings before reusing these connections. Keep the controller above the wet area.

References:

- https://docs.wokwi.com/parts/wokwi-dht22
- https://docs.wokwi.com/parts/wokwi-buzzer
- https://docs.wokwi.com/parts/wokwi-text
