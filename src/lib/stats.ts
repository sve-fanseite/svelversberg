// Statistiken rund um ein Team, berechnet aus den Spieldaten von OpenLigaDB.
import { byKickoff, finalScore, involves, type OldbMatch } from './openligadb.ts';

export interface Scorer {
  name: string;
  goals: number;
  penalties: number;
}

export interface TeamStats {
  played: number;
  goalsFor: number;
  goalsAgainst: number;
  cleanSheets: number;
  failedToScore: number;
  biggestWin: { match: OldbMatch; diff: number; goals: number } | null;
  biggestLoss: { match: OldbMatch; diff: number; goals: number } | null;
  scorers: Scorer[];
  ownGoalsByOpponents: number;
  /** Tore nach Zeitraum: 1–15, 16–30, 31–45+, 46–60, 61–75, 76–90+ */
  goalsForByPeriod: number[];
  goalsAgainstByPeriod: number[];
  /** Spiele, bei denen die Torschützen in OpenLigaDB unvollständig sind */
  incompleteMatches: OldbMatch[];
}

export const PERIOD_LABELS = ['1–15', '16–30', '31–45+', '46–60', '61–75', '76–90+'];

function periodOf(minute: number): number {
  if (minute <= 15) return 0;
  if (minute <= 30) return 1;
  if (minute <= 45) return 2; // Nachspielzeit 1. Halbzeit wird in OpenLigaDB meist als 45 eingetragen
  if (minute <= 60) return 3;
  if (minute <= 75) return 4;
  return 5;
}

/**
 * Führt Schreibvarianten desselben Spielers zusammen (die OpenLigaDB-Community schreibt
 * Namen unterschiedlich, z. B. "D. Mokwa" und "David Mokwa Ntusu").
 * 1. feste Zuordnungen aus aliases (Variante → gewünschter Name)
 * 2. "X. Nachname" wird dem einzigen ausgeschriebenen Namen zugeordnet, der mit X beginnt
 *    und alle übrigen Wörter enthält.
 */
export function mergeScorers(list: Scorer[], aliases: Record<string, string> = {}): Scorer[] {
  const merged = new Map<string, Scorer>();
  const add = (name: string, s: Scorer) => {
    const cur = merged.get(name) ?? { name, goals: 0, penalties: 0 };
    cur.goals += s.goals;
    cur.penalties += s.penalties;
    merged.set(name, cur);
  };
  for (const s of list) add(aliases[s.name] ?? s.name, s);

  const words = (n: string) => n.toLocaleLowerCase('de').split(/[\s-]+/).filter(Boolean);
  const abbreviated = /^(\p{Lu})\.\s*(.+)$/u;
  for (const [name, s] of [...merged]) {
    const m = name.match(abbreviated);
    if (!m) continue;
    const [, initial, rest] = m;
    const need = words(rest);
    const candidates = [...merged.keys()].filter(
      (full) => full !== name && !abbreviated.test(full) && full.startsWith(initial) && need.every((w) => words(full).includes(w)),
    );
    if (candidates.length === 1) {
      merged.delete(name);
      add(candidates[0], s);
    }
  }
  return [...merged.values()].sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name, 'de'));
}

export function teamStats(matches: OldbMatch[], teamId: number, aliases: Record<string, string> = {}): TeamStats {
  const own = matches
    .filter((m) => involves(m, teamId) && m.matchIsFinished && finalScore(m))
    .sort(byKickoff);

  const stats: TeamStats = {
    played: own.length,
    goalsFor: 0,
    goalsAgainst: 0,
    cleanSheets: 0,
    failedToScore: 0,
    biggestWin: null,
    biggestLoss: null,
    scorers: [],
    ownGoalsByOpponents: 0,
    goalsForByPeriod: [0, 0, 0, 0, 0, 0],
    goalsAgainstByPeriod: [0, 0, 0, 0, 0, 0],
    incompleteMatches: [],
  };
  const scorers = new Map<string, Scorer>();

  for (const m of own) {
    const s = finalScore(m)!;
    const isHome = m.team1.teamId === teamId;
    const gf = isHome ? s.home : s.away;
    const ga = isHome ? s.away : s.home;
    stats.goalsFor += gf;
    stats.goalsAgainst += ga;
    if (ga === 0) stats.cleanSheets++;
    if (gf === 0) stats.failedToScore++;
    const diff = gf - ga;
    // Höchster Sieg / höchste Niederlage; bei gleicher Differenz zählt das torreichere Spiel
    const better = (cur: { diff: number; goals: number } | null, d: number) => !cur || d > cur.diff || (d === cur.diff && gf + ga > cur.goals);
    if (diff > 0 && better(stats.biggestWin, diff)) stats.biggestWin = { match: m, diff, goals: gf + ga };
    if (diff < 0 && better(stats.biggestLoss, -diff)) stats.biggestLoss = { match: m, diff: -diff, goals: gf + ga };

    // Tore einzeln durchgehen: Wer hat getroffen? Erkennbar daran, welcher Spielstand gestiegen ist.
    let prev = { t1: 0, t2: 0 };
    let countedFor = 0;
    let countedAgainst = 0;
    const goals = [...(m.goals ?? [])]
      .filter((g) => g.scoreTeam1 != null && g.scoreTeam2 != null)
      .sort((a, b) => a.scoreTeam1! + a.scoreTeam2! - (b.scoreTeam1! + b.scoreTeam2!));
    for (const g of goals) {
      const t1Scored = g.scoreTeam1! > prev.t1;
      const t2Scored = g.scoreTeam2! > prev.t2;
      prev = { t1: g.scoreTeam1!, t2: g.scoreTeam2! };
      if (t1Scored === t2Scored) continue; // unplausibler Eintrag
      const forUs = (t1Scored && isHome) || (t2Scored && !isHome);
      const period = g.matchMinute != null ? periodOf(g.matchMinute) : null;
      if (forUs) {
        countedFor++;
        if (period != null) stats.goalsForByPeriod[period]++;
        if (g.isOwnGoal) {
          stats.ownGoalsByOpponents++;
        } else {
          const name = (g.goalGetterName ?? '').trim();
          if (name) {
            const sc = scorers.get(name) ?? { name, goals: 0, penalties: 0 };
            sc.goals++;
            if (g.isPenalty) sc.penalties++;
            scorers.set(name, sc);
          }
        }
      } else {
        countedAgainst++;
        if (period != null) stats.goalsAgainstByPeriod[period]++;
      }
    }
    const namesMissing = goals.some((g) => !g.isOwnGoal && !(g.goalGetterName ?? '').trim() && (g.scoreTeam1! + g.scoreTeam2! > 0));
    if (countedFor !== gf || countedAgainst !== ga || namesMissing) stats.incompleteMatches.push(m);
  }

  stats.scorers = mergeScorers([...scorers.values()], aliases);
  return stats;
}
