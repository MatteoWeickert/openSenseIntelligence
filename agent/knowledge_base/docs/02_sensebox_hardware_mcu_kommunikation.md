# senseBox Hardware: Mikrocontroller (MCU) & Kommunikationsmodule

## Überblick über die MCU-Generationen

Das Herzstück jeder senseBox ist ein Arduino-kompatibler Mikrocontroller, an den Sensoren und Funkmodule angeschlossen werden. Es existieren mehrere Boardvarianten:

| Board | Prozessor | Architektur | Bemerkung |
|---|---|---|---|
| senseBox MCU (klassisch) | ARM Cortex-M0 (SAMD21-Familie) | 32-Bit | Ursprüngliches Modell, vollständig Arduino-kompatibel |
| senseBox MCU mini | SAMD21-basiert | 32-Bit | Kompaktere Variante |
| senseBox MCU-S2 | ESP32 (Xtensa LX6 Dual-Core) | 32-Bit | Aktuelle Generation, mit integriertem WLAN/Bluetooth |

## senseBox MCU-S2 (ESP32) — Detailspezifikation

Die MCU-S2 ist die aktuelle Generation der senseBox-Plattform und basiert auf einem ESP32-System-on-Chip.

**Prozessor & Speicher:**
- Prozessor: ESP32, Xtensa-LX6-Dual-Core
- Architektur: 32-Bit
- Taktfrequenz: bis zu 240 MHz
- Flash-Speicher: 4 MB
- SRAM: 520 KB
- EEPROM: emuliert im Flash-Speicher (kein dediziertes EEPROM)

**Stromversorgung:**
- Betriebsspannung: 5 V
- Versorgung über USB-C (Programmierung & Strom) oder extern über VIN-Pin (empfohlen: 5 V DC)
- Durchschnittlicher Stromverbrauch: ca. 80 mA, stark abhängig von aktiver Peripherie und Funkmodus (WiFi/Bluetooth aktiv vs. inaktiv)

**Konnektivität & Schnittstellen:**
- Integriertes WiFi und Bluetooth (über den ESP32-Chip)
- I2C, UART und SPI als Standard-Sensorschnittstellen
- **I2C-Daisy-Chain:** Mehrere I2C-Geräte können seriell hintereinander verbunden werden, was die Anzahl benötigter physischer Verbindungen reduziert und Verkabelung in platzbeschränkten Aufbauten vereinfacht
- Grove-Steckverbinder zum werkzeugfreien Anschluss kompatibler Sensormodule
- Integrierter RGB-LED (NeoPixel, ansteuerbar z. B. via CircuitPython über `board.NEOPIXEL`)

**Einsatzbereiche:** IoT-Projekte, Umweltüberwachung, Bildung/Schule, Forschung, drahtlose Kommunikationsprojekte.

**Programmierumgebungen:** Die MCU-S2 ist Arduino-kompatibel (eigener ESP32-Arduino-Core im Repository `sensebox/sensebox-arduino-esp32`), unterstützt aber auch CircuitPython sowie PlatformIO (Board-ID `sensebox_mcu_esp32s2`). Für Einsteiger und den Schulkontext steht zusätzlich ein grafischer Blockly-Editor zur Verfügung, mit dem Sensorabfragen ohne Textcode konfiguriert werden können.

## senseBox:edu S2 — Erweiterte Bildungsvariante

Die senseBox:edu S2 ist eine speziell für den Bildungsbereich konzipierte Ausbaustufe der MCU-S2 mit zusätzlich direkt auf der Platine integrierten Komponenten:

- RGB-LED zur visuellen Statusanzeige
- Integrierter Akku-Ladecontroller für unkomplizierten Batteriebetrieb
- microSD-Kartenslot zur lokalen Datenspeicherung
- Fest integriertes WLAN-Modul
- **Bluetooth-Bee** zur Nutzung mit der Phyphox-App (z. B. für physikalische Schulexperimente)
- LED-Matrix zur Farbdarstellung und zum Vermitteln informatischer Grundkonzepte (z. B. Arrays)
- **ESP-NOW**-Unterstützung für direkte Kommunikation zwischen mehreren MCU-S2-Einheiten ohne Router
- Fest verbaute Photodiode (IN-S63DTLS) als zusätzlicher einfacher Lichtsensor

Geliefert wird die senseBox:edu S2 in einem robusten Kunststoffgehäuse mit Schaumstoffeinlage für den Klassenzimmereinsatz.

## Modulkonzept: "Bees" (Funk-/Kommunikationsmodule)

Die Datenübertragung zur openSenseMap erfolgt nicht zwingend fest verdrahtet, sondern über austauschbare, steckbare Erweiterungsmodule, im senseBox-Ökosystem "Bees" genannt. Je nach Anwendungsfall (Reichweite, Stromverbrauch, Infrastruktur vor Ort) kann das passende Modul gewählt werden:

| Bee-Modul | Übertragungsweg | Typischer Einsatzzweck |
|---|---|---|
| WiFi-Bee | WLAN | Stationärer Betrieb mit vorhandenem WLAN-Netz |
| LAN-Bee | Kabelgebundenes Ethernet | Stabile Verbindung ohne Funk |
| LoRa-Bee | LoRaWAN (z. B. via The Things Network) | Energiesparende Langstreckenübertragung, geringe Datenrate |
| microSD-Bee | Lokale Speicherung | Offline-Logging ohne Live-Übertragung |
| BLE Bee | Bluetooth Low Energy | Kurzstrecken-/mobile Anwendungen, App-Anbindung |
| XBee | je nach gestecktem XBee-Funkmodul | Flexible Funklösungen über das XBee-Ökosystem |

### senseBox BLE Bee

Das BLE Bee ist das Erweiterungsmodul zur Datenübertragung per Bluetooth Low Energy.

- Funk-Chip: **u-blox NINA-B312**
- Standard: **Bluetooth 5.0 (BLE)**
- Reichweite: bis zu **100 m bei freier Sichtlinie** (Line-of-Sight)
- Anwendungsfall: insbesondere für mobile Endgeräte-Kopplung sowie — in Kombination mit der senseBox:edu S2 — für die Anbindung an Apps wie Phyphox im Bildungskontext

## Zusammenfassung: Welches Modul für welchen Zweck?

- **Dauerhafte stationäre Messstation mit Internetzugang:** WiFi-Bee oder LAN-Bee
- **Abgelegener Standort ohne WLAN, geringe Datenmenge:** LoRa-Bee (Anbindung über TTN möglich)
- **Mobiler Einsatz / Kopplung an Smartphone-App:** BLE Bee
- **Reines Offline-Logging zur späteren Auswertung:** microSD-Bee
- **Schul-/Bildungskontext mit App-Experimenten:** senseBox:edu S2 mit integriertem Bluetooth-Bee
