// Testet das Zusammenspiel: Live-Daten, Ausfälle und Rückfall auf den letzten Stand.
// fetch wird hier durch eine Attrappe ersetzt; es gibt keine echten Netzwerkzugriffe.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { rm, writeFile, mkdir } from 'node:fs/promises';

type Handler = (url: string) => { status: number; body: string } | Error;
let handler: Handler;
globalThis.fetch = (async (input: string | URL) => {
  const r = handler(String(input));
  if (r instanceof Error) throw r;
  return new Response(r.body, { status: r.status });
}) as typeof fetch;

const ok = (v: unknown) => ({ status: 200, body: typeof v === 'string' ? v : JSON.stringify(v) });
const ELV = { teamId: 198, teamName: 'SV 07 Elversberg', shortName: 'Elversberg' };
const TABLE = [{ teamInfoId: 198, teamName: 'SV 07 Elversberg', shortName: 'Elversberg', points: 7, matches: 4, won: 2, draw: 1, lost: 1, goals: 5, opponentGoals: 4, goalDiff: 1, teamIconUrl: 'x' }];
const MATCHES = [{ matchID: 1, matchDateTimeUTC: '2026-10-10T13:30:00Z', leagueShortcut: 'bl1', leagueSeason: 2026, leagueName: 'L', group: { groupName: '5. Spieltag', groupOrderID: 5, groupID: 1 }, team1: { ...ELV, teamIconUrl: 'x' }, team2: { teamId: 2, teamName: 'B', shortName: 'B' }, matchIsFinished: false, matchResults: [], goals: [], location: null }];
const RSS = '<rss><channel><item><title>Hallo</title><link>https://example.org/1</link><pubDate>Fri, 25 Sep 2026 10:00:00 +0000</pubDate></item></channel></rss>';

function liveHandler(fail: string[] = []): Handler {
  return (url) => {
    if (fail.some((f) => url.includes(f))) return new Error('Netzwerkfehler');
    if (url.includes('/getavailableteams/bl1/')) return ok([ELV]);
    if (url.includes('/getavailableteams/')) return ok([]);
    if (url.includes('/getbltable/bl1/')) return ok(TABLE);
    if (url.includes('/getmatchdata/bl1/')) return ok(MATCHES);
    if (url.includes('feed')) return ok(RSS);
    return { status: 404, body: '' };
  };
}

async function freshLoad() {
  const mod = await import(`../src/lib/data.ts?x=${Math.random()}`);
  return mod.getSiteData();
}

process.env.RETRY_DELAY_MS = '5';

beforeEach(async () => {
  await rm('.cache', { recursive: true, force: true });
  delete process.env.FALLBACK_URL;
  delete process.env.STRICT_DATA;
  process.env.SEASON = '2026';
});

test('alles live: Liga erkannt, Daten frisch, schlank gespeichert', { timeout: 30_000 }, async () => {
  handler = liveHandler();
  const d = await freshLoad();
  assert.equal(d.league.data.shortcut, 'bl1');
  assert.equal(d.league.data.seasonLabel, '2026/27');
  assert.equal(d.team.data.teamId, 198);
  assert.equal(d.table.stale, false);
  assert.equal(d.table.data[0].rank, 1);
  assert.ok(!('teamIconUrl' in d.table.data[0]), 'Wappen-URLs werden nicht übernommen');
  assert.ok(!('teamIconUrl' in d.matches.data[0].team1));
  assert.equal(d.news.data[0].title, 'Hallo');
  assert.deepEqual(d.problems, []);
});

test('OpenLigaDB fällt aus → letzter Stand aus Cache, als veraltet markiert', { timeout: 60_000 }, async () => {
  handler = liveHandler();
  await freshLoad(); // schreibt .cache/snapshot.json
  handler = liveHandler(['openligadb']);
  const d = await freshLoad();
  assert.equal(d.table.stale, true);
  assert.equal(d.matches.stale, true);
  assert.equal(d.league.data.shortcut, 'bl1');
  assert.equal(d.news.stale, false, 'News kommen weiter live');
  assert.ok(d.problems.length > 0);
});

test('Rückfall über FALLBACK_URL der veröffentlichten Seite', { timeout: 60_000 }, async () => {
  handler = liveHandler();
  const good = await freshLoad();
  await rm('.cache', { recursive: true, force: true });
  process.env.FALLBACK_URL = 'https://svelversberg.com/data/snapshot.json';
  handler = (url) => (url.startsWith('https://svelversberg.com/') ? ok(good) : new Error('down'));
  const d = await freshLoad();
  assert.equal(d.table.stale, true);
  assert.equal(d.news.stale, true);
  assert.equal(d.team.data.teamName, 'SV 07 Elversberg');
});

test('nichts erreichbar, kein Rückfall → leere Abschnitte statt Absturz', { timeout: 60_000 }, async () => {
  handler = () => new Error('offline');
  const d = await freshLoad();
  assert.equal(d.table, null);
  assert.equal(d.matches, null);
  assert.equal(d.news, null);
});

test('STRICT_DATA bricht ab, wenn keinerlei Liga-Daten da sind', { timeout: 60_000 }, async () => {
  process.env.STRICT_DATA = '1';
  handler = () => new Error('offline');
  await assert.rejects(freshLoad(), /Build abgebrochen/);
});

test('Elversberg in 2. Liga → wird dort gefunden', { timeout: 30_000 }, async () => {
  handler = (url) => {
    if (url.includes('/getavailableteams/bl2/2026')) return ok([ELV]);
    if (url.includes('/getavailableteams/')) return ok([{ teamId: 5, teamName: 'Andere', shortName: 'A' }]);
    if (url.includes('/getbltable/bl2/')) return ok(TABLE);
    if (url.includes('/getmatchdata/bl2/')) return ok(MATCHES);
    return ok(RSS);
  };
  const d = await freshLoad();
  assert.equal(d.league.data.shortcut, 'bl2');
  assert.equal(d.league.data.name, '2. Bundesliga');
});
