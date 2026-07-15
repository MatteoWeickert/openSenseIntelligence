# senseBox-Sensoren: Boden, Position, Distanz, Schall & Bewegung

## Bodenfeuchte & Bodentemperatur: SMT50

Der SMT50 ist der Standardsensor der senseBox-Serie zur Erfassung von Bodeneigenschaften, z. B. für Anwendungen in der Landwirtschaft, im Gartenbau oder in der Umweltbeobachtung.

**Gemessene Parameter:**
- **Volumetrischer Wassergehalt:** beschreibt den Volumenanteil von Wasser im Boden
  - Messbereich: 0 bis 50 %
  - Genauigkeit: ±3 %
- **Bodentemperatur:**
  - Messbereich: −20 °C bis +85 °C

Der Sensor wird üblicherweise in den Boden eingebracht und liefert über eine analoge oder digitale Schnittstelle kontinuierliche Messwerte zur Feuchtigkeitsentwicklung im Wurzelraum sowie zur Bodentemperatur.

## Positionsbestimmung: CAM-M8Q (GPS/GNSS-Modul)

Das CAM-M8Q ist das GPS-/GNSS-Empfängermodul der senseBox-Serie und dient der Georeferenzierung mobiler oder fester Messstationen.

**Gemessene/abgeleitete Parameter:**
- **Längengrad (Longitude)** und **Breitengrad (Latitude)** — zur räumlichen Verortung der Messstation
- **Höhe (Altitude)** — absolute Höhe in Metern
- **Geschwindigkeit (Speed)** — in km/h, relevant insbesondere bei mobilen Messstationen (z. B. an Fahrzeugen)

**Technische Anbindung:**
- Anschluss an die senseBox MCU typischerweise über I2C
- In der Arduino-Umgebung wird häufig die Bibliothek `TinyGPSPlus` zur Dekodierung der NMEA-Datensätze des Moduls verwendet
- Zusätzlich zu Position, Höhe und Geschwindigkeit liefert das GPS-Modul auch Zeitstempel (Datum/Uhrzeit) und einen HDOP-Wert (Horizontal Dilution of Precision) als Qualitätsindikator der Positionsbestimmung

## Abstandsmessung: Ultraschallsensor (HC-SR04)

Der Ultraschallsensor misst Distanzen zu Objekten über Laufzeitmessung von Schallwellen im Ultraschallbereich.

- **Gemessener Parameter:** Abstand zu einem Objekt
- **Einheit:** Zentimeter (cm)
- **Messprinzip:** Ein Ultraschallimpuls wird ausgesendet, die Laufzeit bis zum Empfang des reflektierten Signals wird gemessen und daraus über die Schallgeschwindigkeit die Distanz berechnet
- **Typischer Einsatzzweck:** z. B. Pegelstandsmessung (Wasserstand), Füllstandsmessung oder Abstandsmessung in Experimentieraufbauten

## Schallpegel: Mikrofon / Soundlevelmeter

Das Mikrofonmodul erfasst die Geräuschintensität der Umgebung als analoges Spannungssignal.

- **Gemessener Parameter:** Lautstärke / Lärmpegel
- **Ausgabe:** Pegelwert zwischen **0 und 5 V**, der proportional zur erfassten Schallintensität ist
- In der openSenseMap-Metadatensystematik wird dieser Sensor häufig unter der Methodenbezeichnung "SOUNDLEVELMETER" geführt und das gemessene Phänomen oft direkt in dB(A) weiterverarbeitet bzw. dargestellt

## Beschleunigung & Lage: BMX055 / interner Bewegungssensor

In der senseBox-Produktübersicht wird ein "Lage-/Kompass-/Beschleunigungssensor" auf Basis des **BMX055** geführt. Dieser ist in einigen Konfigurationen direkt auf der MCU-Platine integriert (intern verbaut) und liefert Bewegungs- und Orientierungsdaten.

**Gemessener Parameter:**
- Beschleunigung entlang der **X-, Y- und Z-Achse**
- Einheit: Vielfaches der Erdbeschleunigung **g**
- Konfigurierbare Messbereiche: z. B. **±2 g, ±4 g, ±16 g** — je nach gewählter Empfindlichkeitsstufe lassen sich entweder sehr feine Bewegungen (kleiner Messbereich) oder starke Beschleunigungen/Stöße (großer Messbereich) präzise erfassen

Da der BMX055 zusätzlich auch Kompass- (Magnetometer) und Lagedaten (Gyroskop) liefern kann, eignet er sich neben reiner Vibrations-/Bewegungsmessung auch für Experimente zur Orientierung und Ausrichtung der Messstation.

## Zusammenfassende Übersicht

| Sensor | Messgröße(n) | Einheit | Wertebereich |
|---|---|---|---|
| SMT50 | Volumetrischer Wassergehalt, Bodentemperatur | %, °C | 0–50 % (±3 %), −20 bis +85 °C |
| CAM-M8Q | Position, Höhe, Geschwindigkeit | °, m, km/h | — |
| Ultraschallsensor (HC-SR04) | Distanz | cm | — |
| Mikrofon | Schallpegel | V (0–5 V) | 0–5 V |
| BMX055 (Beschleunigung) | Beschleunigung X/Y/Z | g | konfigurierbar: 2g, 4g, 16g |

## Typische Anwendungsfragen für dieses Themengebiet

- *Wie genau misst der Bodenfeuchtesensor SMT50?* — Volumetrischer Wassergehalt mit ±3 % Genauigkeit im Bereich 0–50 %.
- *Welche Bibliothek wird typischerweise für das GPS-Modul genutzt?* — `TinyGPSPlus`, um die NMEA-Ausgabe des CAM-M8Q zu parsen.
- *In welcher Einheit gibt der Ultraschallsensor Werte aus?* — In Zentimetern (cm).
- *Wie wird die Mikrofonlautstärke ausgegeben?* — Als analoge Spannung zwischen 0 und 5 V, proportional zur Geräuschintensität.
- *Was bedeuten die Messbereichsangaben 2g/4g/16g beim Beschleunigungssensor?* — Sie definieren, bis zu welchem Vielfachen der Erdbeschleunigung der Sensor noch linear/präzise misst; kleinere Bereiche bieten höhere Auflösung, größere Bereiche erfassen stärkere Beschleunigungen ohne Übersteuerung.
