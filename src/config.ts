// Zentrale Einstellungen der Fanseite.
// Hier kannst du Quellen und Texte anpassen, ohne sonst etwas zu ändern.

export const SITE = {
  name: 'svelversberg.com',
  tagline: 'Inoffizielle Fanseite',
  description:
    'Inoffizielle Fanseite rund um die SV 07 Elversberg: nächstes Spiel, Tabelle, Spielplan, Kader und News.',
  disclaimer: 'Inoffizielle Fanseite – keine Verbindung zur SV 07 Elversberg',
  lang: 'de',
};

// Suchbegriff, mit dem der Verein in OpenLigaDB gefunden wird.
export const TEAM_SEARCH = 'Elversberg';

// Ligen, in denen gesucht wird (Reihenfolge = Priorität).
// OpenLigaDB-Kürzel: bl1 = Bundesliga, bl2 = 2. Bundesliga, bl3 = 3. Liga
export const LEAGUES = [
  { shortcut: 'bl1', name: 'Bundesliga' },
  { shortcut: 'bl2', name: '2. Bundesliga' },
  { shortcut: 'bl3', name: '3. Liga' },
] as const;

// News-Quellen (RSS). Es werden nur Überschrift, Datum und Link übernommen.
// "enabled: false" schaltet eine Quelle ab.
export const NEWS_FEEDS = [
  {
    id: 'sve',
    name: 'sv07elversberg.de',
    label: 'Offizielle Vereinsseite',
    url: 'https://sv07elversberg.de/feed/',
    enabled: true,
  },
  {
    id: 'kicker',
    name: 'kicker.de',
    label: 'kicker',
    url: 'https://newsfeed.kicker.de/team/sv-elversberg',
    enabled: false,
  },
];

// Wie viele News-Karten auf der Startseite erscheinen.
export const HOME_NEWS_COUNT = 6;

// Tabellenzonen je Liga (Regelplätze). Verschiebungen, z. B. durch den DFB-Pokal-Sieger,
// sind möglich – deshalb steht auf der Seite ein Hinweis.
export type ZoneKind = 'europa' | 'aufstieg' | 'relegation' | 'abstieg';
export const TABLE_ZONES: Record<string, { from: number; to: number; label: string; kind: ZoneKind }[]> = {
  bl1: [
    { from: 1, to: 4, label: 'Champions League', kind: 'europa' },
    { from: 5, to: 5, label: 'Europa League', kind: 'europa' },
    { from: 6, to: 6, label: 'Conference League (Quali)', kind: 'europa' },
    { from: 16, to: 16, label: 'Relegation', kind: 'relegation' },
    { from: 17, to: 18, label: 'Abstieg', kind: 'abstieg' },
  ],
  bl2: [
    { from: 1, to: 2, label: 'Aufstieg', kind: 'aufstieg' },
    { from: 3, to: 3, label: 'Relegation (Aufstieg)', kind: 'relegation' },
    { from: 16, to: 16, label: 'Relegation (Abstieg)', kind: 'relegation' },
    { from: 17, to: 18, label: 'Abstieg', kind: 'abstieg' },
  ],
  bl3: [
    { from: 1, to: 2, label: 'Aufstieg', kind: 'aufstieg' },
    { from: 3, to: 3, label: 'Relegation (Aufstieg)', kind: 'relegation' },
    { from: 17, to: 20, label: 'Abstieg', kind: 'abstieg' },
  ],
};
