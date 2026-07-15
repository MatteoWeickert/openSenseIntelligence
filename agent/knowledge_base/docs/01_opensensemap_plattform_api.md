# openSenseMap: Plattform & REST-API

## Was ist die openSenseMap?

Die openSenseMap ist eine vom Institut für Geoinformatik (ifgi) der WWU Münster betriebene Cloud-Plattform zur Veröffentlichung, Visualisierung und Speicherung von Umweltsensordaten. Sie ist Bestandteil des senseBox-Projekts und dient als zentrales Web-Portal für Open Data: Alle dort veröffentlichten Messwerte stehen unter der **Public Domain Dedication and License (PDDL) 1.0**, sind also frei nachnutzbar.

Auf der Plattform werden Messstationen ("Boxen") inklusive ihrer Sensoren, Standorte und Metadaten verwaltet. Neben senseBox-Hardware können auch andere Messgeräte Daten einspeisen, z. B. Geräte aus den Projekten luftdaten.info (Sensor.Community) oder hackAIR. Über offene Schnittstellen werden die Daten auch in Drittsystemen genutzt, etwa als Live-Exponat im Berliner Futurium oder als Layer in ArcGIS Online.

## Grundkonzept: Box und Sensor-ID

Jede registrierte Messstation erhält bei der Anmeldung eine eindeutige **senseBoxId**. Jeder einzelne an die Box angeschlossene Sensor (bzw. jedes gemessene Phänomen, z. B. "Temperatur" oder "rel. Luftfeuchte") erhält wiederum eine eigene **sensorId**. Diese IDs werden nach der Registrierung per E-Mail zugestellt bzw. sind über das Web-Interface der openSenseMap und die API einsehbar. Jede Messung wird sensorId-spezifisch übertragen — eine Box mit fünf Sensoren benötigt also fünf separate Upload-Vorgänge (einen pro Phänomen) oder einen Sammel-Request mit mehreren Sensor-Wert-Paaren.

## REST-API: Grundlagen

Der zentrale API-Endpunkt lautet:

```
https://api.opensensemap.org/
```

Die vollständige, maschinenlesbare API-Dokumentation ist unter `https://docs.opensensemap.org/` verfügbar (generiert aus dem Quellcode des Backends im GitHub-Repository `sensebox/openSenseMap-API`).

### Messwert übertragen (Standard-Upload)

Um einen einzelnen Messwert für einen Sensor zu übertragen, wird ein HTTP-POST-Request an folgende URI gesendet:

```
POST https://api.opensensemap.org/boxes/:senseBoxId/:sensorId
Content-Type: application/json

{"value": 22.5}
```

Beispiel als vollständiger Rohrequest:

```
POST /boxes/1234/abcd HTTP/1.1
Host: api.opensensemap.org
Content-Type: application/json
Connection: close
Content-Length: 14

{"value":22.5}
```

Optional kann zusätzlich ein Zeitstempel mitgegeben werden:

```json
{"value": 25.5, "createdAt": "2022-01-01T12:00:00Z"}
```

Für Mikrocontroller, die kein HTTPS unterstützen, existiert (historisch) zusätzlich eine reine HTTP-Schnittstelle:

```
http://opensensemap.org:8000/:senseBoxId/:sensorId
```

### Sensordaten abrufen

Um die zuletzt übertragenen bzw. historischen Messwerte einer Box auszulesen:

```
GET https://api.opensensemap.org/boxes/:boxId/data
```

### Authentifizierung

Verwaltungsoperationen (z. B. Anlegen, Bearbeiten oder Löschen einer Box) erfordern eine Authentifizierung per JSON Web Token (JWT), das nach Login über die API ausgestellt wird. Der reine Messwert-Upload per `POST /boxes/:senseBoxId/:sensorId` war historisch **ohne** Authentifizierung möglich — Kenntnis von senseBoxId und sensorId genügte. Da diese IDs öffentlich (z. B. über das Web-Interface) einsehbar sind, wurde dies in der Community als Sicherheitsthema diskutiert; je nach API-Version und Box-Konfiguration kann ein "sicherer Upload" mit Token erzwungen werden.

### Mehrere Sensoren in einem Request

Statt vieler Einzel-Requests pro Sensor unterstützt die API auch das gebündelte Posten mehrerer Sensorwerte einer Box in einem einzigen JSON-Array-Request, was bei stromsparenden bzw. selten sendenden Stationen Bandbreite spart.

## Datendownload

Es gibt drei Wege, Messdaten aus der openSenseMap zu beziehen:

1. **Web-Interface (Download-Funktion):** Über den Reiter "Datendownload" auf opensensemap.org lassen sich Daten räumlich (Bounding Box), zeitlich und nach Phänomen filtern. Über den Reiter "Filter" kann vorab nach Stationsnamen eingeschränkt werden (erkennbar an einem roten Dreieck am Reiter). Unterstützte Exportformate sind **CSV**, **JSON** und **Tidy**.
2. **Tages-Archiv:** Unter `https://archive.opensensemap.org` werden tageweise nach Box gegliederte Rohdaten als CSV/ZIP bereitgestellt — geeignet für lange Zeiträume, aber ohne Echtzeitdaten.
3. **REST-API direkt:** Für komplexere, programmatische Abfragen steht der Endpunkt `/boxes/data` zur Verfügung, der über Query-Parameter wie `phenomenon` und `bbox` (Bounding Box) gefiltert werden kann.

### CSV-Format

Eine exportierte CSV-Datei enthält pro Zeile eine Einzelmessung mit Zeitstempel, Wert und Standort (WGS84):

```
createdAt;value;lat;lng
2016-09-20T10:05:49.581Z;18.70;7.64568;51.962372
2016-09-20T10:00:52.689Z;18.62;7.64568;51.962372
```

### Beispiel: Bounding-Box-Abfrage per curl

Um alle Temperaturmessungen im Gebiet 51–52° nördlicher Breite und 7–8° östlicher Länge herunterzuladen:

```bash
curl "https://api.opensensemap.org/boxes/data?phenomenon=Temperatur&bbox=7,51,8,52" > measurements.csv
```

Die Bounding Box wird dabei im Format `minLng,minLat,maxLng,maxLat` angegeben.

### Limitierungen

Bei direkten API-Abfragen über lange Zeiträume gilt eine praktische Obergrenze von etwa 10.000 Messwerten pro 30-Tage-Intervall; für umfangreichere historische Auswertungen ist das Tages-Archiv (`archive.opensensemap.org`) die geeignetere Quelle.

## Weiterverarbeitung der Daten

Heruntergeladene CSV-/JSON-Daten lassen sich direkt in Tabellenkalkulationsprogrammen (Excel, LibreOffice) oder statistischer Software öffnen. Für geoinformatische Analysen werden sie häufig in GIS-Software wie **ArcGIS Online** importiert (z. B. über "Layer aus Datei hinzufügen"), um räumliche Muster (z. B. Wärmeinseleffekte) zu visualisieren. Für die statistische Umgebung **R** existiert das CRAN-Paket `opensensmapr`, das Funktionen wie `osem_box()`, `osem_boxes()` und `osem_measurements()` zum direkten Laden der Daten in R bereitstellt, inklusive Filterung über Bounding Boxes (kompatibel mit dem `sf`-Paket).

## Andere Übertragungswege

Neben der direkten HTTP-REST-API unterstützt das senseBox-Ökosystem je nach verwendetem Funkmodul ("Bee", siehe Hardware-Dokument) auch alternative Übertragungswege, u. a.:

- MQTT-basierte Übertragung
- LoRaWAN-Anbindung an The Things Network (TTN), von wo Daten per Integration an die openSenseMap weitergeleitet werden
- Übertragung von kompatiblen Drittgeräten (luftdaten.info / Sensor.Community, hackAIR)
