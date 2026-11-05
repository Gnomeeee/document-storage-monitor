# Simulator checks

Build first, then start Wokwi. Confirm `DHT22 driver: Adafruit 1.4.7` and
`ESP32 CPU: 240 MHz` appear. Allow two seconds for startup and up to about
2.5 seconds for each subsequent temperature/humidity update.

| Case | Action | Expected |
| --- | --- | --- |
| Startup | Start with switch dry | Awaiting first reading, not a fault or NORMAL yet |
| Normal | RH 50%, switch dry | Valid readings, NORMAL, buzzer off |
| Repeated readings | Leave 28 C / 50% unchanged for three samples | All samples valid, no recurring fault |
| Temperature update | Set temperature to 31.5 C | Next sample reports 31.5 C, not a cached 28 C |
| Signed temperature | Set temperature to -5.5 C | Next sample reports -5.5 C |
| Threshold boundary | Dry switch; set RH to 59.9%, then 60.0% | NORMAL then humidity alarm |
| Water | RH 50%, switch wet | Water YES, water alarm, buzzer on |
| Humidity | Switch dry, RH 65% | High humidity alarm, buzzer on |
| Both | RH 65%, switch wet | Water alarm printed, humidity still displayed, buzzer on |
| Recovery | RH 50%, switch dry | NORMAL, buzzer off |
| DHT fault | Stop; temporarily remove DHT SDA connection; restart | DHT fault, no fabricated measurement |
| Water during fault | With DHT disconnected, switch wet | DHT fault AND water alarm, buzzer on |

Restore the SDA-to-GPIO-4 connection after the fault tests, save, and restart.
Confirm valid readings return. Restore diagram defaults to 28 C / 50% and dry.
These checks verify the learning prototype, not the SRS duration-based rules.
Record date and actual observations; do not mark a case passed from build success alone.

`scenarios/dht22.yaml` automates the valid-reading/update/recovery checks with
Wokwi CLI; see the firmware README for the exact command and authentication setup.
