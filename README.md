# Akquise

Werkzeug, um Sportvereine mit veralteter Website oder fehlender Platzbuchung zu finden,
zu bewerten und systematisch anzusprechen.

## Aufbau

- `index.html`, `stil.css`, `app.js` — Oberfläche, kein Framework, kein Bauschritt
- `api/pruefen.js` — ruft jede Website auf und vergibt Punkte für das, was fehlt

Die Abfrage an OpenStreetMap läuft bewusst **im Browser** und nicht über eine eigene
Funktion. Der freie Overpass-Dienst drosselt nach IP-Adresse, und die Server von Vercel
teilen sich ihre Adressen mit vielen anderen Projekten, dort kam praktisch jede Anfrage
als „ausgelastet" zurück. Aus dem Browser zählt die Adresse des eigenen Anschlusses.
- `sql/001_schema.sql` — Tabellen, Trigger und Zugriffsregeln für Supabase
- `konfig.js` — Supabase-URL und veröffentlichbarer Schlüssel

## Punkte

| Befund | Punkte |
|---|---|
| keine Online-Buchung | 4 |
| keine Handy-Ansicht | 4 |
| kein HTTPS | 3 |
| Zertifikat ungültig | 3 |
| Copyright drei Jahre oder älter | 2 |
| Flash, Frameset, Tabellenlayout, jQuery 1.x | 2 |
| Baukasten (Jimdo, Wix, Webnode, IONOS) | 1 |

## Einrichten

1. Supabase-Projekt anlegen, `sql/001_schema.sql` im SQL-Editor ausführen
2. In Supabase unter Authentication einen Benutzer anlegen (E-Mail und Passwort)
3. `konfig.js` mit Projekt-URL und veröffentlichbarem Schlüssel füllen
4. Auf Vercel veröffentlichen, Deployment Protection anlassen

## Rechtliches

Kalte Werbe-E-Mails an Vereine sind nach § 7 Abs. 2 UWG ohne vorherige Einwilligung
unzulässig. Das Werkzeug erzeugt deshalb Briefe und Telefonleitfäden, keinen Mailversand.
Die gespeicherten Kontaktdaten sind personenbezogene Daten, das Verzeichnis der
Verarbeitungstätigkeiten liegt in `datenschutz/verarbeitungsverzeichnis.md`.

Adressdaten stammen aus OpenStreetMap, © OpenStreetMap-Mitwirkende, Lizenz ODbL.
