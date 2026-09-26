// Tests für die Statistik-Berechnung (künstliche Testdaten).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { teamStats } from '../src/lib/stats.ts';
import type { OldbGoal, OldbMatch } from '../src/lib/openligadb.ts';

const T = (id: number, name: string) => ({ teamId: id, teamName: name, shortName: name });
const ELV = T(198, 'SV 07 Elversberg');
const A = T(1, 'Team A');
const B = T(2, 'Team B');
const g = (s1: number, s2: number, name: string, minute: number, extra: Partial<OldbGoal> = {}): OldbGoal => ({
  scoreTeam1: s1, scoreTeam2: s2, goalGetterName: name, matchMinute: minute, ...extra,
});
function match(id: number, home: typeof ELV, away: typeof ELV, score: [number, number], goals: OldbGoal[]): OldbMatch {
  return {
    matchID: id, matchDateTimeUTC: `2026-09-0${id}T13:30:00Z`, leagueShortcut: 'bl1', leagueSeason: 2026, leagueName: 'L',
    group: { groupName: `${id}. Spieltag`, groupOrderID: id }, team1: home, team2: away, matchIsFinished: true,
    matchResults: [{ resultTypeID: 2, resultOrderID: 2, pointsTeam1: score[0], pointsTeam2: score[1] }], goals, location: null,
  };
}

const matches = [
  // Heim 3:2 – Müller 2 (1 Elfer), Eigentor Gegner; Gegentore 2
  match(1, ELV, A, [3, 2], [g(1, 0, 'Müller', 10, { isPenalty: true }), g(1, 1, 'Gegner X', 30), g(2, 1, 'Müller', 44), g(2, 2, 'Gegner Y', 50), g(3, 2, 'A-Spieler', 88, { isOwnGoal: true })]),
  // Auswärts 1:4 – für uns 4 Tore (Team 2): Meier, Müller, Meier, Schulz
  match(2, B, ELV, [1, 4], [g(0, 1, 'Meier', 5), g(1, 1, 'B-Stürmer', 20), g(1, 2, 'Müller', 47), g(1, 3, 'Meier', 70), g(1, 4, 'Schulz', 90)]),
  // Heim 0:0
  match(3, ELV, B, [0, 0], []),
  // Auswärts 2:0 verloren, Torschützen fehlen in der Datenbank
  match(4, A, ELV, [2, 0], []),
];

test('Torschützen, Elfmeter, Eigentore des Gegners', () => {
  const s = teamStats(matches, 198);
  assert.deepEqual(s.scorers, [
    { name: 'Müller', goals: 3, penalties: 1 },
    { name: 'Meier', goals: 2, penalties: 0 },
    { name: 'Schulz', goals: 1, penalties: 0 },
  ]);
  assert.equal(s.ownGoalsByOpponents, 1);
});

test('Kennzahlen: Tore, zu Null, ohne Tor, höchster Sieg und höchste Niederlage', () => {
  const s = teamStats(matches, 198);
  assert.equal(s.played, 4);
  assert.equal(s.goalsFor, 7);
  assert.equal(s.goalsAgainst, 5);
  assert.equal(s.cleanSheets, 1);
  assert.equal(s.failedToScore, 2);
  assert.equal(s.biggestWin?.match.matchID, 2);
  assert.equal(s.biggestWin?.diff, 3);
  assert.equal(s.biggestLoss?.match.matchID, 4);
});

test('Tore nach Zeitraum und Erkennung unvollständiger Spiele', () => {
  const s = teamStats(matches, 198);
  assert.deepEqual(s.goalsForByPeriod, [2, 0, 1, 1, 1, 2]);
  assert.deepEqual(s.goalsAgainstByPeriod, [0, 2, 0, 1, 0, 0]);
  assert.deepEqual(s.incompleteMatches.map((m) => m.matchID), [4]);
});
