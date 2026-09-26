// Zugriff auf die OpenLigaDB-API (https://api.openligadb.de) und
// reine Hilfsfunktionen, die aus den Rohdaten Tabelle, Form usw. ableiten.

export const API_BASE = 'https://api.openligadb.de';

export interface OldbTeam {
  teamId: number;
  teamName: string;
  shortName: string;
}

export interface OldbResult {
  resultTypeID: number;
  resultOrderID: number;
  pointsTeam1: number | null;
  pointsTeam2: number | null;
}

export interface OldbGoal {
  goalGetterName: string | null;
  matchMinute: number | null;
  scoreTeam1: number | null;
  scoreTeam2: number | null;
  isPenalty?: boolean;
  isOwnGoal?: boolean;
  isOvertime?: boolean;
}

export interface OldbMatch {
  matchID: number;
  matchDateTimeUTC: string;
  leagueShortcut: string;
  leagueSeason: number;
  leagueName: string;
  group: { groupName: string; groupOrderID: number } | null;
  team1: OldbTeam;
  team2: OldbTeam;
  matchIsFinished: boolean;
  matchResults: OldbResult[] | null;
  goals: OldbGoal[] | null;
  location: { locationCity: string | null; locationStadium: string | null } | null;
}

export interface OldbTableRow {
  teamInfoId: number;
  teamName: string;
  shortName: string;
  points: number;
  matches: number;
  won: number;
  draw: number;
  lost: number;
  goals: number;
  opponentGoals: number;
  goalDiff: number;
}

// ---------------------------------------------------------------- Netzwerk

export async function fetchJson<T>(path: string, tries = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} für ${path}`);
      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
      const delay = Number(process.env.RETRY_DELAY_MS ?? 1500);
      if (i < tries - 1) await new Promise((r) => setTimeout(r, delay * (i + 1)));
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------- Ableitungen

/** Endergebnis eines Spiels oder null, falls (noch) keins vorliegt. */
export function finalScore(m: OldbMatch): { home: number; away: number } | null {
  const results = m.matchResults ?? [];
  const final =
    results.find((r) => r.resultTypeID === 2) ??
    [...results].sort((a, b) => b.resultOrderID - a.resultOrderID)[0];
  if (!final || final.pointsTeam1 == null || final.pointsTeam2 == null) return null;
  return { home: final.pointsTeam1, away: final.pointsTeam2 };
}

export const kickoff = (m: OldbMatch) => new Date(m.matchDateTimeUTC);

export function byKickoff(a: OldbMatch, b: OldbMatch) {
  return kickoff(a).getTime() - kickoff(b).getTime();
}

export function involves(m: OldbMatch, teamId: number) {
  return m.team1.teamId === teamId || m.team2.teamId === teamId;
}

/** Nächstes Spiel: erstes nicht beendetes Spiel, das höchstens 3 h zurückliegt (läuft evtl. gerade). */
export function findNextMatch(matches: OldbMatch[], teamId: number, now = new Date()) {
  const cutoff = now.getTime() - 3 * 60 * 60 * 1000;
  return (
    matches
      .filter((m) => involves(m, teamId) && !m.matchIsFinished && kickoff(m).getTime() >= cutoff)
      .sort(byKickoff)[0] ?? null
  );
}

/** Letztes beendetes Spiel mit Ergebnis. */
export function findLastMatch(matches: OldbMatch[], teamId: number) {
  const done = matches
    .filter((m) => involves(m, teamId) && m.matchIsFinished && finalScore(m))
    .sort(byKickoff);
  return done[done.length - 1] ?? null;
}

export type Outcome = 'S' | 'U' | 'N';

export function outcomeFor(m: OldbMatch, teamId: number): Outcome | null {
  const s = finalScore(m);
  if (!s) return null;
  const own = m.team1.teamId === teamId ? s.home : s.away;
  const opp = m.team1.teamId === teamId ? s.away : s.home;
  return own > opp ? 'S' : own < opp ? 'N' : 'U';
}

/** Form der letzten n Spiele (ältestes zuerst). */
export function formFor(matches: OldbMatch[], teamId: number, n = 5): Outcome[] {
  return matches
    .filter((m) => involves(m, teamId) && m.matchIsFinished && finalScore(m))
    .sort(byKickoff)
    .slice(-n)
    .map((m) => outcomeFor(m, teamId) as Outcome);
}

export interface TableRow extends OldbTableRow {
  rank: number;
}

export function rankTable(rows: OldbTableRow[]): TableRow[] {
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

/** Tabellenausschnitt rund um ein Team (size Zeilen, Team möglichst mittig). */
export function tableExcerpt(table: TableRow[], teamId: number, size = 5): TableRow[] {
  const idx = table.findIndex((r) => r.teamInfoId === teamId);
  if (idx < 0) return table.slice(0, size);
  let start = Math.max(0, idx - Math.floor(size / 2));
  start = Math.min(start, Math.max(0, table.length - size));
  return table.slice(start, start + size);
}

/** Kurzer, aber lesbarer Name für enge Stellen (Handy, Tabelle). */
export function shortLabel(t: { shortName?: string | null; teamName: string }): string {
  const short = (t.shortName ?? '').trim();
  return short.length > 4 ? short : t.teamName;
}

/** Kurzes Kürzel für Initialen-Badges (statt Vereinswappen). */
export function teamInitials(t: { shortName?: string | null; teamName: string }): string {
  const short = (t.shortName ?? '').trim();
  if (short && short.length <= 4) return short.toUpperCase();
  const base = short || t.teamName;
  const words = base
    .replace(/^((\d+\.|\d{2}|FC|SV|SC|VfL|VfB|TSG|SpVgg|DSC|FSV|RB|SSV|TSV|SG|BV)\s+)+/i, '')
    .split(/[\s-]+/)
    .filter(Boolean);
  return (words[0] ?? base).slice(0, 3).toUpperCase();
}

// ---------------------------------------------------------------- Tabellen & Spieltage

export type TableMode = 'all' | 'home' | 'away';

/** Tabelle aus den Spielen berechnen (für Heim- und Auswärtstabelle). */
export function computeTable(matches: OldbMatch[], mode: TableMode = 'all'): TableRow[] {
  const rows = new Map<number, OldbTableRow>();
  const ensure = (t: OldbTeam) => {
    if (!rows.has(t.teamId)) {
      rows.set(t.teamId, {
        teamInfoId: t.teamId, teamName: t.teamName, shortName: t.shortName,
        points: 0, matches: 0, won: 0, draw: 0, lost: 0, goals: 0, opponentGoals: 0, goalDiff: 0,
      });
    }
    return rows.get(t.teamId)!;
  };
  const add = (r: OldbTableRow, own: number, opp: number) => {
    r.matches++;
    r.goals += own;
    r.opponentGoals += opp;
    r.goalDiff = r.goals - r.opponentGoals;
    if (own > opp) { r.won++; r.points += 3; } else if (own === opp) { r.draw++; r.points += 1; } else r.lost++;
  };
  for (const m of matches) {
    const home = ensure(m.team1);
    const away = ensure(m.team2);
    const s = m.matchIsFinished ? finalScore(m) : null;
    if (!s) continue;
    if (mode !== 'away') add(home, s.home, s.away);
    if (mode !== 'home') add(away, s.away, s.home);
  }
  const sorted = [...rows.values()].sort(
    (a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goals - a.goals || a.teamName.localeCompare(b.teamName, 'de'),
  );
  return rankTable(sorted);
}

export interface Matchday {
  order: number;
  name: string;
  matches: OldbMatch[];
}

export function groupByMatchday(matches: OldbMatch[]): Matchday[] {
  const map = new Map<number, Matchday>();
  for (const m of matches) {
    const order = m.group?.groupOrderID ?? 0;
    if (!map.has(order)) map.set(order, { order, name: m.group?.groupName ?? `${order}. Spieltag`, matches: [] });
    map.get(order)!.matches.push(m);
  }
  const days = [...map.values()].sort((a, b) => a.order - b.order);
  for (const d of days) d.matches.sort((a, b) => byKickoff(a, b) || a.team1.teamName.localeCompare(b.team1.teamName, 'de'));
  return days;
}

/** Aktueller Spieltag: der früheste mit noch offenen Spielen, sonst der letzte. */
export function currentMatchday(days: Matchday[]): number | null {
  const open = days.find((d) => d.matches.some((m) => !m.matchIsFinished));
  return open?.order ?? days[days.length - 1]?.order ?? null;
}
