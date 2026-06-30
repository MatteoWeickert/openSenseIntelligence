User-Szenarien & MCP Tool-Design
Typische Nutzerfragen an einen AI-Assistenten:
Häufigkeit	Frage-Typ	Beispiel
★★★★★	Entdecken	"Welche Sensoren gibt es in meiner Nähe?"
★★★★★	Aktueller Zustand	"Wie ist die Temperatur gerade in Münster?"
★★★★☆	Zeitverlauf	"Wie hat sich die Luftqualität diese Woche entwickelt?"
★★★★☆	Regionaler Vergleich	"Zeig mir PM2.5-Werte im Ruhrgebiet"
★★★☆☆	Statistiken	"Durchschnittstemperatur letzte 7 Tage in Region X?"
★★☆☆☆	Plattform-Info	"Wie viele Stationen gibt es insgesamt?"
★★☆☆☆	Mobiltracking	"Wo war mein mobiler Sensor unterwegs?"
★☆☆☆☆	Verwaltung	"Erstelle mir eine neue Box" (braucht Auth)
Vorgeschlagene MCP Tools (6 Tools):
1. search_stations
"Finde relevante Messstationen"

Parameter	Typ	Beschreibung
name	optional string	Suche nach Name
near	optional {lat, lng, maxDistance}	Umkreissuche
bbox	optional [lonSW, latSW, lonNE, latNE]	Bounding Box
phenomenon	optional string	Nur Stationen die X messen
exposure	optional enum	indoor/outdoor/mobile
grouptag	optional string	Gruppierung
API-Calls: GET /boxes mit minimal=true für schnelle Antwort. Ergebnis auf max. 50 Stationen begrenzt mit sinnvoller Zusammenfassung (Name, Standort, letztes Update, gemessene Phänomene).

Warum: Das ist die Einstiegsfrage Nr. 1. Nutzer wissen selten die Box-ID — sie denken räumlich oder thematisch.

2. get_station_details
"Zeig mir alles über eine bestimmte Station"

Parameter	Typ	Beschreibung
boxId	string	Die senseBox-ID
API-Calls: GET /boxes/:boxId — gibt Name, Sensoren, letzten Messwert jedes Sensors, Standort, Exposure etc. zurück.

Warum: Natürlicher zweiter Schritt nach der Suche. Kompakte Antwort, weil nur aktuelle Werte.

3. get_sensor_data
"Hole Messdaten eines bestimmten Sensors"

Parameter	Typ	Beschreibung
boxId	string	senseBox-ID
sensorId	string	Sensor-ID
fromDate	optional RFC3339	Startdatum
toDate	optional RFC3339	Enddatum
limit	optional number (default: 100)	Max. Datenpunkte
API-Calls: GET /boxes/:boxId/data/:sensorId

Wichtig: Das Tool muss die Ergebnisse intern begrenzen/samplen. Die API gibt bis zu 10.000 Werte zurück — wir geben dem LLM maximal ~100-200 und berechnen dazu eine Zusammenfassung (min/max/mean/trend).

Warum: Kernfunktion für zeitliche Analysen. Aber mit eingebauter Schutzlogik gegen Datenflut.

4. get_statistics
"Berechne Statistiken über Stationen/Region"

Parameter	Typ	Beschreibung
boxIds	optional string[]	Liste von Box-IDs
bbox	optional [lonSW, latSW, lonNE, latNE]	ODER Bounding Box
phenomenon	string	z.B. "Temperatur", "PM10"
fromDate	RFC3339	Start
toDate	RFC3339	Ende
operation	enum	arithmeticMean, max, min, median, standardDeviation
window	string	Zeitfenster z.B. "1d", "1h"
API-Calls: GET /statistics/descriptive

Warum: Das ist der Goldstandard für LLM-Interaktion — gibt kompakte, aggregierte Zahlen statt Rohdaten. Perfekt für Fragen wie "Durchschnittstemperatur letzte Woche" oder "Wie variiert PM2.5 über den Tag?"

5. get_regional_measurements
"Hole Messwerte eines Phänomens über mehrere Stationen"

Parameter	Typ	Beschreibung
boxIds	optional string[]	Komma-separierte IDs
bbox	optional [lonSW, latSW, lonNE, latNE]	ODER Region
phenomenon	string	z.B. "Temperatur"
fromDate	optional RFC3339	Start
toDate	optional RFC3339	Ende
exposure	optional enum	indoor/outdoor/mobile
API-Calls: GET /boxes/data (Multi-Box Phenomenon Endpoint)

Warum: Ermöglicht regionale Analysen ("Alle Temperatur-Daten im Münsterland") in einem Call. Ergebnis wird vom Tool zusammengefasst (Durchschnitt pro Box, Trend, Ausreißer markiert).

6. get_platform_stats
"Überblick über die openSenseMap Plattform"

Parameter	Typ	Beschreibung
—	—	Keine Parameter nötig
API-Calls: GET /stats

Warum: Schneller Kontext-Einstieg. "Wie groß ist openSenseMap?" → Anzahl Boxen, Gesamtmessungen, aktuelle Aktivität.

Bewusst NICHT als Tool:
Ausgelassen	Grund
User-Management (register, login, update)	Auth-Flows gehören nicht in AI-Tools
Box erstellen/updaten/löschen	Destruktive Aktionen, braucht Auth
Measurement-Upload	Schreibzugriff, braucht Device-Key
Arduino-Script Download	Nischenfall, besser über UI
Transfer-Management	Admin-Task, nicht AI-relevant
IDW-Interpolation	Komplex, riesige Response (GeoJSON FeatureCollection), schwer nutzbar für LLM



OSEM_API_URL im .env File neu setzen auf https://staging.opensensemap.org/api !!!!

search_boxes tool funktioniert noch nicht richtig: es werden nicht die nächsten boxes zu einer koordinate ausgegeben sondern irgendwelche Boxen -> API Fehler?