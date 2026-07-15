# senseBox-Sensoren: Luftqualität & Feinstaub

## Was bedeutet "PM" (Particulate Matter)?

PM (Particulate Matter, Feinstaub) bezeichnet feste oder flüssige Partikel in der Luft und wird nach ihrem maximalen aerodynamischen Durchmesser in Mikrometern (µm) klassifiziert:

- **PM1.0:** Partikel mit einem Durchmesser kleiner als 1,0 µm
- **PM2.5:** Partikel kleiner als 2,5 µm — gelten als besonders gesundheitsrelevant, da sie tief in die Lunge eindringen können
- **PM4.0:** Partikel kleiner als 4,0 µm
- **PM10:** Partikel kleiner als 10 µm

Alle Feinstaubsensoren der senseBox-Serie nutzen ein **Laserstreulichtverfahren (Laserscattering)**: Ein Laser durchleuchtet die angesaugte Luft, eine Photodiode erfasst die vom Streulicht der Partikel erzeugten Signale, woraus Anzahl und Größe der Partikel und daraus die Massenkonzentration berechnet werden. Die Ergebnisse werden in **µg/m³ (Mikrogramm pro Kubikmeter)** angegeben.

## SDS011 — Feinstaubsensor (Basismodell)

Der SDS011 ist der ursprüngliche, weit verbreitete Feinstaubsensor der senseBox-Serie.

- **Gemessene Parameter:** PM2.5 und PM10
- **Messprinzip:** Laserstreulichtverfahren mit eingebautem Lüfter, der aktiv Luft durch die Messkammer ansaugt
- **Messbereich:** 0,0 – 999,9 µg/m³ (für PM2.5 und PM10)
- **Schnittstelle:** Serielle UART-Verbindung zum Mikrocontroller
- **Bibliotheksfunktionen (Arduino):** `getPm10()`, `getPm25()`

## SPS30 — Feinstaubsensor (Nachfolgemodell, höhere Präzision)

Der SPS30 ist die hochpräzisere Weiterentwicklung gegenüber dem SDS011 und erfasst zusätzliche Partikelgrößenklassen.

- **Gemessene Parameter:** PM1.0, PM2.5, PM4.0 und PM10
- **Messprinzip:** ebenfalls Laserstreulichttechnologie (Laser Scattering) zur Partikelzählung und Größenbestimmung
- **Ausgabeeinheit:** µg/m³
- **Vorteil gegenüber SDS011:** feinere Partikel-Differenzierung (zusätzliche PM1.0- und PM4.0-Werte) und höhere Messgenauigkeit

## BME680 — Kombinierter Umwelt- und Luftqualitätssensor

Der BME680 ist ein I2C-Sensor, der mehrere Umweltgrößen gleichzeitig misst und zusätzlich einen integrierten Gassensor zur Luftqualitätsbestimmung enthält.

**Gemessene/berechnete Größen:**
- Temperatur (°C)
- relative Luftfeuchte (%)
- Luftdruck (hPa)
- **IAQ (Indoor Air Quality):** ein aus den Sensordaten berechneter, dimensionsloser Luftqualitätsindex auf einer Skala von **0 bis 500**. Niedrige Werte stehen für gute, hohe Werte für schlechte Innenraumluftqualität.
- **VOC (Volatile Organic Compounds):** flüchtige organische Verbindungen in der Luft, die der integrierte Gassensor über dessen Widerstandsänderung erfasst und die in die IAQ-Berechnung einfließen

**Wichtiger Hinweis zur Hardware-Kombination:** In der Praxis berichten Nutzer im senseBox-Forum, dass BME680 und SDS011 nicht zwangsläufig konfliktfrei gemeinsam betrieben werden können bzw. dass beim Bestücken mit dem BME680 typischerweise HDC1080 und BMP280 entfernt werden, da der BME680 deren Funktion (Temperatur, Feuchte, Druck) bereits mit abdeckt. Wer also sowohl detaillierte Feinstaubdaten als auch einen Gas-/IAQ-Sensor benötigt, sollte die jeweilige Sensor-Slot-Belegung der gewählten senseBox-Variante (z. B. senseBox:home, senseBox:edu) vorab prüfen.

## Vergleichstabelle Feinstaubsensoren

| Sensor | PM1.0 | PM2.5 | PM4.0 | PM10 | Messprinzip |
|---|---|---|---|---|---|
| SDS011 | – | ✔ | – | ✔ | Laserstreulicht + Lüfter |
| SPS30 | ✔ | ✔ | ✔ | ✔ | Laserstreulicht (hochpräzise) |

## Typische Anwendungsfragen für dieses Themengebiet

- *Wie wird Feinstaub gemessen?* — Über Laserstreulichtverfahren, bei dem ein Lüfter Luft durch eine Messkammer zieht und ein Laser zusammen mit einer Photodiode Partikelanzahl und -größe bestimmt.
- *Was ist der Unterschied zwischen PM2.5 und PM10?* — Die Zahl gibt die obere Grenze des erfassten Partikeldurchmessers in Mikrometern an; PM2.5 ist eine Teilmenge feinerer, gesundheitlich relevanterer Partikel innerhalb der PM10-Fraktion.
- *Welcher Sensor liefert mehr Detailtiefe bei Feinstaub?* — Der SPS30, da er zusätzlich PM1.0 und PM4.0 ausgibt und als präziser gilt.
- *Was sagt der IAQ-Wert des BME680 aus?* — Ein berechneter Index zwischen 0 (sehr gut) und 500 (sehr schlecht) zur Bewertung der Innenraumluftqualität, basierend u. a. auf VOC-Konzentration.
