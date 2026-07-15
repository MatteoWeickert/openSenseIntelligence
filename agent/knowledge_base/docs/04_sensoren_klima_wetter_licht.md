# senseBox-Sensoren: Klima, Wetter & Licht

## Temperatur & Luftfeuchte: HDC1080

Der HDC1080 ist der Standardsensor der senseBox-Serie für grundlegende Klimamessungen und wird häufig als Basisausstattung für Wetterstations-Setups eingesetzt.

- **Gemessene Parameter:** Temperatur und relative Luftfeuchtigkeit
- **Einheiten:** Temperatur in °C, relative Luftfeuchte in %
- **Schnittstelle:** I2C
- **Arduino-Bibliotheksfunktionen:** `getTemperature()`, `getHumidity()`

## Luftdruck & Höhe: BMP280 und DPS310

Beide Sensoren messen den hydrostatischen Atmosphärendruck und werden zur Berechnung der Höhe über Normalnull (NN) sowie als Temperaturreferenz genutzt.

### BMP280
- **Gemessene Parameter:** Luftdruck (hPa) und Temperatur (°C)
- Wird häufig zusammen mit dem HDC1080 als klassisches Klimapaket verbaut

### DPS310
- **Gemessene Parameter:** Luftdruck, Temperatur, daraus abgeleitet die Höhe über NN
- **Messbereich Luftdruck:** 300 bis 1200 hPa
- Gilt als präzisere/modernere Alternative zum BMP280 innerhalb des senseBox-Ökosystems

### Höhenberechnung über Druckunterschiede

Die Höhe über Normalnull wird nicht direkt gemessen, sondern aus der barometrischen Höhenformel berechnet, die den gemessenen Luftdruck mit einem Referenzdruck auf Meereshöhe vergleicht. In der senseBox-Arduino-Bibliothek geschieht dies typischerweise über eine Funktion wie:

```
getAltitude(float seaLevelhPa = 1013.25)
```

Der Standard-Referenzwert **1013,25 hPa** entspricht dem international definierten mittleren Luftdruck auf Meereshöhe (Normaldruck). Die berechnete Höhe wird in **Metern** ausgegeben.

## Helligkeit & UV-Strahlung: TSL45315 + VEML6070

Diese beiden Sensoren werden in der senseBox stets als Kombination eingesetzt, um sowohl sichtbares Licht als auch UV-Strahlung zu erfassen.

### TSL45315 — Helligkeitssensor
- **Hersteller:** AMS
- **Gemessener Parameter:** Beleuchtungsstärke (Illuminance)
- **Einheit:** Lux
- **Schnittstelle:** I2C (typische Geräteadresse in Diagnosetools: 0x29)
- **Arduino-Bibliotheksfunktion:** `getIlluminance()`

### VEML6070 — UV-Sensor
- **Hersteller:** Vishay
- **Gemessener Parameter:** UV-Intensität
- **Einheit:** µW/cm² (Mikrowatt pro Quadratzentimeter)
- **Schnittstelle:** I2C (nutzt typischerweise zwei aufeinanderfolgende Adressen, z. B. 0x38 und 0x39)
- **Arduino-Bibliotheksfunktion:** `getUvIntensity()`

## Zusätzlicher Lichtsensor bei der senseBox:edu S2: Photodiode IN-S63DTLS

Auf der senseBox:edu S2 ist zusätzlich zu TSL45315/VEML6070 eine fest verbaute Photodiode (IN-S63DTLS) verbaut, die analog ausgelesen wird:

- Auslesefrequenz: einmal pro Sekunde
- Besonderheit: Das Steuersignal `PD_ENABLE` ist bei diesem Sensor **Active-High** (im Gegensatz zu Active-Low bei anderen senseBox-Sensoren)
- Physikalischer Zusammenhang: Die gemessene Ausgangsspannung ergibt sich aus dem Photostrom über einen Lastwiderstand: `V_Out = I_Photo / R` mit R = 33 kΩ
- Typische rohe Bytewerte (0–4095, 12-Bit-ADC):
  - Normales Umgebungslicht: ca. 200–500
  - Direkte Sonneneinstrahlung: ca. 1000–2000
  - Direkte Bestrahlung mit weißer Hochleistungs-LED: bis zum Maximalwert 4095

## Zusammenfassende Übersicht

| Sensor | Messgröße(n) | Einheit | Schnittstelle |
|---|---|---|---|
| HDC1080 | Temperatur, rel. Luftfeuchte | °C, % | I2C |
| BMP280 | Luftdruck, Temperatur | hPa, °C | I2C |
| DPS310 | Luftdruck, Temperatur, Höhe | hPa, °C, m | I2C |
| TSL45315 | Beleuchtungsstärke | Lux | I2C |
| VEML6070 | UV-Intensität | µW/cm² | I2C |
| Photodiode IN-S63DTLS (edu S2) | Lichtintensität (roh) | analoger ADC-Wert 0–4095 | analog |

## Typische Anwendungsfragen für dieses Themengebiet

- *Welcher Sensor misst die Höhe über NN?* — Kein Sensor misst Höhe direkt; sie wird aus dem Luftdrucksignal (BMP280 oder DPS310) über die barometrische Höhenformel relativ zu einem Referenzdruck (Standard: 1013,25 hPa) berechnet.
- *In welcher Einheit wird UV-Strahlung angegeben?* — In µW/cm² (Mikrowatt pro Quadratzentimeter), gemessen durch den VEML6070.
- *Was ist der Unterschied zwischen BMP280 und DPS310?* — Beide messen Luftdruck und Temperatur; der DPS310 gilt als präziser/aktueller und hat einen dokumentierten Messbereich von 300–1200 hPa.
