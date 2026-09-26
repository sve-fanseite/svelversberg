# svelversberg.com

Inoffizielle Fanseite rund um die SV 07 Elversberg. **Keine Verbindung zur SV 07 Elversberg.**

## So funktioniert die Seite

- Gebaut mit [Astro](https://astro.build) und Tailwind CSS als rein statische Seite.
- Tabelle, Spielplan und Ergebnisse kommen von [OpenLigaDB](https://www.openligadb.de), die News
  (nur Überschrift, Datum und Link) aus RSS-Feeds. Beides wird **beim Bauen** abgerufen,
  Besucher verbinden sich also nur mit dieser Seite.
- GitHub Actions baut die Seite stündlich neu, Freitag bis Sonntag tagsüber alle 15 Minuten.
- Antwortet eine Quelle nicht, bleibt der letzte gute Stand stehen (mit Hinweis auf der Seite).
  Gibt es gar keine Liga-Daten, bricht der Build ab und die bisherige Version bleibt online.
- Die Liga wird automatisch erkannt (Bundesliga, 2. Bundesliga oder 3. Liga).

## Wichtige Dateien

| Datei | Wofür |
| --- | --- |
| `src/config.ts` | Seitenname, News-Quellen an/aus, Anzahl News auf der Startseite |
| `src/lib/data.ts` | Lädt alle Daten, inklusive Rückfall auf den letzten Stand |
| `src/pages/` | Eine Datei pro Seite |
| `.github/workflows/build.yml` | Automatischer Bau und Veröffentlichung |

## Selbst einen Neubau starten

Auf GitHub: **Actions → Seite bauen → Run workflow**.
