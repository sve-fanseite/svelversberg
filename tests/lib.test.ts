// Tests für die Datenlogik. Start: npm test
// Die Daten hier sind künstliche Testdaten, sie erscheinen nie auf der Seite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  finalScore, findLastMatch, findNextMatch, formFor, rankTable, tableExcerpt, teamInitials,
  type OldbMatch, type OldbTableRow,
} from '../src/lib/openligadb.ts';
import { parseFeed } from '../src/lib/rss.ts';
import { currentSeason, seasonLabel, formatTime } from '../src/lib/time.ts';

const T = (id: number, name: string, short: string) => ({ teamId: id, teamName: name, shortName: short });
const ELV = T(198, 'SV 07 Elversberg', 'Elversberg');
const A = T(1, 'Team A', 'A-Stadt');
const B = T(2, 'Team B', 'B-Dorf');

function match(id: number, iso: string, home: typeof ELV, away: typeof ELV, score?: [number, number]): OldbMatch {
  return {
    matchID: id, matchDateTimeUTC: iso, leagueShortcut: 'bl1', leagueSeason: 2026, leagueName: 'Test',
    group: { groupName: `${id}. Spieltag`, groupOrderID: id }, team1: home, team2: away,
    matchIsFinished: !!score,
    matchResults: score
      ? [
          { resultTypeID: 1, resultOrderID: 1, pointsTeam1: 0, pointsTeam2: 0 },
          { resultTypeID: 2, resultOrderID: 2, pointsTeam1: score[0], pointsTeam2: score[1] },
        ]
      : [],
    goals: [], location: null,
  };
}

const matches = [
  match(1, '2026-08-22T13:30:00Z', ELV, A, [2, 1]),
  match(2, '2026-08-29T13:30:00Z', B, ELV, [1, 1]),
  match(3, '2026-09-12T13:30:00Z', ELV, B, [0, 3]),
  match(4, '2026-09-20T15:30:00Z', A, ELV, [0, 0]),
  match(5, '2026-10-10T13:30:00Z', ELV, A),
  match(6, '2026-10-17T13:30:00Z', B, ELV),
];

test('Endergebnis nimmt resultTypeID 2, nicht Halbzeit', () => {
  assert.deepEqual(finalScore(matches[0]), { home: 2, away: 1 });
  assert.equal(finalScore(matches[4]), null);
});

test('nächstes und letztes Spiel', () => {
  const now = new Date('2026-09-26T16:00:00Z');
  assert.equal(findNextMatch(matches, 198, now)?.matchID, 5);
  assert.equal(findLastMatch(matches, 198)?.matchID, 4);
});

test('laufendes Spiel (Anpfiff vor 1 h, nicht beendet) gilt noch als nächstes', () => {
  const now = new Date('2026-10-10T14:30:00Z');
  assert.equal(findNextMatch(matches, 198, now)?.matchID, 5);
});

test('Form aus Sicht Elversberg, ältestes zuerst', () => {
  assert.deepEqual(formFor(matches, 198), ['S', 'U', 'N', 'U']);
  assert.deepEqual(formFor(matches, 1), ['N', 'U']);
});

test('Tabellenausschnitt bleibt am Rand im Bereich', () => {
  const rows: OldbTableRow[] = Array.from({ length: 18 }, (_, i) => ({
    teamInfoId: i === 6 ? 198 : 1000 + i, teamName: `T${i}`, shortName: `T${i}`, points: 30 - i,
    matches: 4, won: 0, draw: 0, lost: 0, goals: 0, opponentGoals: 0, goalDiff: 0,
  }));
  const table = rankTable(rows);
  assert.deepEqual(tableExcerpt(table, 198).map((r) => r.rank), [5, 6, 7, 8, 9]);
  table[0].teamInfoId = 999; table[6].teamInfoId = 5; table[0].teamInfoId = 198;
  assert.deepEqual(tableExcerpt(table, 198).map((r) => r.rank), [1, 2, 3, 4, 5]);
  table[0].teamInfoId = 0; table[17].teamInfoId = 198;
  assert.deepEqual(tableExcerpt(table, 198).map((r) => r.rank), [14, 15, 16, 17, 18]);
});

test('Initialen statt Wappen', () => {
  assert.equal(teamInitials({ shortName: 'S04', teamName: 'FC Schalke 04' }), 'S04');
  assert.equal(teamInitials({ shortName: 'Elversberg', teamName: 'SV 07 Elversberg' }), 'ELV');
  assert.equal(teamInitials({ shortName: 'Union Berlin', teamName: '1. FC Union Berlin' }), 'UNI');
  assert.equal(teamInitials({ shortName: '', teamName: '1. FC Köln' }), 'KÖL');
});

test('Saison-Berechnung', () => {
  assert.equal(currentSeason(new Date('2026-09-26T12:00:00Z')), 2026);
  assert.equal(currentSeason(new Date('2027-05-20T12:00:00Z')), 2026);
  assert.equal(currentSeason(new Date('2027-06-30T22:30:00Z')), 2027); // 1. Juli in Berlin
  assert.equal(seasonLabel(2026), '2026/27');
  assert.equal(seasonLabel(2099), '2099/00');
});

test('Uhrzeit in deutscher Zeit', () => {
  assert.equal(formatTime(new Date('2026-10-10T13:30:00Z')), '15:30 Uhr');
  assert.equal(formatTime(new Date('2026-12-05T14:30:00Z')), '15:30 Uhr'); // Winterzeit
});

test('RSS 2.0 mit CDATA und Entities, ohne Artikeltext', () => {
  const xml = `<?xml version="1.0"?><rss><channel><title>X</title>
    <item><title><![CDATA[Sieg &amp; Tore &#8211; super]]></title><link>https://example.org/a</link>
      <pubDate>Thu, 24 Sep 2026 16:21:01 +0000</pubDate><description>Langer Text</description></item>
    <item><title>Ohne Link</title></item>
    <item><title>Test &amp;#8222;Zitat&amp;#8220;</title><link>https://example.org/b</link></item>
  </channel></rss>`;
  const items = parseFeed(xml);
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], { title: 'Sieg & Tore – super', link: 'https://example.org/a', date: '2026-09-24T16:21:01.000Z' });
  assert.equal(items[1].title, 'Test „Zitat“');
  assert.equal(items[1].date, null);
  assert.ok(!('description' in items[0]));
});

test('Atom-Feed', () => {
  const xml = `<feed><entry><title type="html">Neu</title><link rel="alternate" href="https://example.org/x?a=1&amp;b=2"/>
    <updated>2026-09-25T10:00:00Z</updated></entry></feed>`;
  assert.deepEqual(parseFeed(xml), [{ title: 'Neu', link: 'https://example.org/x?a=1&b=2', date: '2026-09-25T10:00:00.000Z' }]);
});

test('Kalenderdatei: gültige Struktur, Ergebnis im Titel, Zeilen ≤ 75 Byte', async () => {
  const { buildIcs } = await import('../src/lib/ics.ts');
  const ics = buildIcs({
    matches: matches.slice(3, 5), calName: 'SV Elversberg – Spielplan (inoffiziell)',
    leagueName: 'Bundesliga 2026/27', siteUrl: 'https://svelversberg.com/spielplan', now: new Date('2026-09-26T12:00:00Z'),
  });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
  assert.equal(ics.match(/BEGIN:VEVENT/g)?.length, 2);
  assert.ok(ics.includes('DTSTART:20261010T133000Z'));
  assert.ok(ics.includes('SUMMARY:Team A – SV 07 Elversberg (0:0)'));
  assert.ok(ics.includes('SUMMARY:SV 07 Elversberg – Team A\r\n'));
  assert.ok(ics.includes('Bundesliga 2026/27\\, 4. Spieltag'));
  for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, line);
});

test('Vereinsfarben: gültige Hex-Werte und Schrift gut lesbar (Kontrast ≥ 4,5)', async () => {
  const { readFile } = await import('node:fs/promises');
  const farben = JSON.parse(await readFile('src/data/vereinsfarben.json', 'utf8'));
  const lum = (h: string) => {
    const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const contrast = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  for (const [id, f] of Object.entries(farben)) {
    if (id.startsWith('_')) continue;
    const v = f as { name: string; bg: string; fg: string; ring?: string };
    for (const c of [v.bg, v.fg, v.ring].filter(Boolean)) assert.match(c as string, /^#[0-9A-F]{6}$/i, `${v.name}: ${c}`);
    assert.ok(contrast(v.bg, v.fg) >= 4.5, `${v.name}: Kontrast ${contrast(v.bg, v.fg).toFixed(2)}`);
  }
});
