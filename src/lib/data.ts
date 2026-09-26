// Lädt beim Build alle Daten (Liga, Tabelle, Spiele, News) – mit Rückfallebene:
// 1. live von OpenLigaDB bzw. den RSS-Feeds
// 2. sonst letzter guter Stand (Snapshot der veröffentlichten Seite oder lokaler Cache)
// 3. sonst null → die Seite zeigt eine freundliche Meldung
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { LEAGUES, NEWS_FEEDS, TEAM_SEARCH } from '../config.ts';
import { currentSeason, seasonLabel } from './time.ts';
import {
  fetchJson,
  rankTable,
  type OldbMatch,
  type OldbTableRow,
  type OldbTeam,
  type TableRow,
} from './openligadb.ts';
import { fetchFeed } from './rss.ts';

export interface LeagueInfo {
  shortcut: string;
  name: string;
  season: number;
  seasonLabel: string;
}

export interface NewsItem {
  title: string;
  link: string;
  date: string | null;
  sourceId: string;
  sourceName: string;
}

export interface Section<T> {
  data: T;
  asOf: string; // wann die Daten zuletzt erfolgreich geladen wurden
  stale: boolean; // true = Rückfall auf älteren Stand
}

export interface SiteData {
  generatedAt: string;
  league: Section<LeagueInfo> | null;
  team: Section<OldbTeam> | null;
  table: Section<TableRow[]> | null;
  matches: Section<OldbMatch[]> | null;
  news: Section<NewsItem[]> | null;
  problems: string[];
}

const CACHE_FILE = '.cache/snapshot.json';

function log(msg: string) {
  console.log(`[daten] ${msg}`);
}

// ---------------------------------------------------------------- Liga-Erkennung

async function detectLeague(): Promise<{ league: LeagueInfo; team: OldbTeam }> {
  const forced = process.env.LEAGUE;
  const season = Number(process.env.SEASON) || currentSeason();
  const candidates = forced ? LEAGUES.filter((l) => l.shortcut === forced) : LEAGUES;
  const needle = TEAM_SEARCH.toLowerCase();

  // Aktuelle Saison zuerst; im Sommer vor Saisonstart ggf. noch die vorige.
  for (const s of [season, season - 1]) {
    for (const l of candidates) {
      try {
        const teams = await fetchJson<OldbTeam[]>(`/getavailableteams/${l.shortcut}/${s}`);
        const team = teams.find((t) => t.teamName.toLowerCase().includes(needle));
        if (team) {
          return {
            league: { shortcut: l.shortcut, name: l.name, season: s, seasonLabel: seasonLabel(s) },
            team: { teamId: team.teamId, teamName: team.teamName, shortName: team.shortName },
          };
        }
      } catch (err) {
        log(`Teamliste ${l.shortcut}/${s} nicht abrufbar: ${(err as Error).message}`);
      }
    }
  }
  throw new Error(`"${TEAM_SEARCH}" in keiner Liga gefunden`);
}

// ---------------------------------------------------------------- Verschlanken

const slimTeam = (t: OldbTeam): OldbTeam => ({
  teamId: t.teamId,
  teamName: t.teamName,
  shortName: t.shortName,
});

function slimMatch(m: OldbMatch): OldbMatch {
  return {
    matchID: m.matchID,
    matchDateTimeUTC: m.matchDateTimeUTC,
    leagueShortcut: m.leagueShortcut,
    leagueSeason: m.leagueSeason,
    leagueName: m.leagueName,
    group: m.group ? { groupName: m.group.groupName, groupOrderID: m.group.groupOrderID } : null,
    team1: slimTeam(m.team1),
    team2: slimTeam(m.team2),
    matchIsFinished: m.matchIsFinished,
    matchResults: (m.matchResults ?? []).map((r) => ({
      resultTypeID: r.resultTypeID,
      resultOrderID: r.resultOrderID,
      pointsTeam1: r.pointsTeam1,
      pointsTeam2: r.pointsTeam2,
    })),
    goals: (m.goals ?? []).map((g) => ({
      goalGetterName: g.goalGetterName,
      matchMinute: g.matchMinute,
      scoreTeam1: g.scoreTeam1,
      scoreTeam2: g.scoreTeam2,
      isPenalty: g.isPenalty,
      isOwnGoal: g.isOwnGoal,
      isOvertime: g.isOvertime,
    })),
    location: m.location
      ? { locationCity: m.location.locationCity, locationStadium: m.location.locationStadium }
      : null,
  };
}

function slimRow(r: OldbTableRow): OldbTableRow {
  return {
    teamInfoId: r.teamInfoId,
    teamName: r.teamName,
    shortName: r.shortName,
    points: r.points,
    matches: r.matches,
    won: r.won,
    draw: r.draw,
    lost: r.lost,
    goals: r.goals,
    opponentGoals: r.opponentGoals,
    goalDiff: r.goalDiff,
  };
}

// ---------------------------------------------------------------- Rückfallebene

async function loadFallback(): Promise<Partial<SiteData> | null> {
  const url = process.env.FALLBACK_URL;
  if (url) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (res.ok) {
        log(`Rückfall-Stand von ${url} geladen`);
        return (await res.json()) as SiteData;
      }
      log(`Rückfall-Stand ${url}: HTTP ${res.status}`);
    } catch (err) {
      log(`Rückfall-Stand ${url} nicht erreichbar: ${(err as Error).message}`);
    }
  }
  try {
    const cached = JSON.parse(await readFile(CACHE_FILE, 'utf8')) as SiteData;
    log(`Rückfall-Stand aus ${CACHE_FILE} geladen`);
    return cached;
  } catch {
    return null;
  }
}

function asStale<T>(s: Section<T> | null | undefined): Section<T> | null {
  return s ? { ...s, stale: true } : null;
}

// ---------------------------------------------------------------- Hauptfunktion

async function load(): Promise<SiteData> {
  const now = new Date().toISOString();
  const problems: string[] = [];
  let fallback: Partial<SiteData> | null | undefined;
  const getFallback = async () => (fallback === undefined ? (fallback = await loadFallback()) : fallback);
  const fresh = <T>(data: T): Section<T> => ({ data, asOf: now, stale: false });

  // Liga & Team
  let league: Section<LeagueInfo> | null = null;
  let team: Section<OldbTeam> | null = null;
  try {
    const found = await detectLeague();
    league = fresh(found.league);
    team = fresh(found.team);
    log(`${found.team.teamName} spielt ${found.league.name} ${found.league.seasonLabel}`);
  } catch (err) {
    problems.push(`Liga-Erkennung: ${(err as Error).message}`);
    const fb = await getFallback();
    league = asStale(fb?.league);
    team = asStale(fb?.team);
  }

  // Tabelle & Spiele
  let table: Section<TableRow[]> | null = null;
  let matches: Section<OldbMatch[]> | null = null;
  if (league && !league.stale) {
    const { shortcut, season } = league.data;
    try {
      const rows = await fetchJson<OldbTableRow[]>(`/getbltable/${shortcut}/${season}`);
      table = fresh(rankTable(rows.map(slimRow)));
    } catch (err) {
      problems.push(`Tabelle: ${(err as Error).message}`);
    }
    try {
      const list = await fetchJson<OldbMatch[]>(`/getmatchdata/${shortcut}/${season}`);
      if (!Array.isArray(list) || list.length === 0) throw new Error('leerer Spielplan');
      matches = fresh(list.map(slimMatch));
    } catch (err) {
      problems.push(`Spielplan: ${(err as Error).message}`);
    }
  }
  if (!table) table = asStale((await getFallback())?.table);
  if (!matches) matches = asStale((await getFallback())?.matches);

  // News
  let news: Section<NewsItem[]> | null = null;
  const items: NewsItem[] = [];
  let anyFeedOk = false;
  for (const feed of NEWS_FEEDS.filter((f) => f.enabled)) {
    try {
      const got = await fetchFeed(feed.url);
      anyFeedOk = true;
      for (const it of got) items.push({ ...it, sourceId: feed.id, sourceName: feed.name });
    } catch (err) {
      problems.push(`News ${feed.name}: ${(err as Error).message}`);
    }
  }
  if (anyFeedOk) {
    const seen = new Set<string>();
    const unique = items
      .filter((i) => (seen.has(i.link) ? false : (seen.add(i.link), true)))
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
      .slice(0, 60);
    news = fresh(unique);
  } else {
    news = asStale((await getFallback())?.news);
  }

  const result: SiteData = { generatedAt: now, league, team, table, matches, news, problems };

  for (const p of problems) log(`Problem – ${p}`);
  if (process.env.STRICT_DATA === '1' && (!table || !matches)) {
    // Lieber den Build abbrechen, als eine gute Seite durch eine leere zu ersetzen.
    throw new Error('Keine Liga-Daten verfügbar (weder live noch als Rückfall) – Build abgebrochen.');
  }

  try {
    await mkdir('.cache', { recursive: true });
    await writeFile(CACHE_FILE, JSON.stringify(result));
  } catch {
    /* Cache ist optional */
  }
  return result;
}

let promise: Promise<SiteData> | null = null;

/** Einmal pro Build laden, alle Seiten teilen sich das Ergebnis. */
export function getSiteData(): Promise<SiteData> {
  return (promise ??= load());
}
