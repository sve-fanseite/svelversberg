// Tests für die Kader-Logik und die echte Kader-Datei.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ageOn, matchPlayer, parseSquad, scorersWithSquadNames, slugify } from '../src/lib/kader.ts';

const squadRaw = JSON.parse(await readFile('src/data/kader.json', 'utf8'));

test('Kader-Datei ist gültig (Nummern eindeutig, Positionen korrekt)', () => {
  const squad = parseSquad(squadRaw);
  assert.ok(squad.spieler.length > 0);
  assert.ok(squad.trainerteam.length > 0);
});

test('verständliche Fehlermeldungen bei Tippfehlern in der Kader-Datei', () => {
  assert.throws(
    () => parseSquad({ spieler: [
      { nummer: 7, name: 'A', position: 'Tor' },
      { nummer: 7, name: 'B', position: 'Stürmer', geburtsdatum: '1.2.2000' },
    ] }),
    (e: Error) => /doppelt vergeben/.test(e.message) && /Tor, Abwehr, Mittelfeld oder Sturm/.test(e.message) && /JJJJ-MM-TT/.test(e.message),
  );
});

test('Adressen und Alter', () => {
  assert.equal(slugify('Lasse Günther'), 'lasse-guenther');
  assert.equal(slugify('Amara Condé'), 'amara-conde');
  assert.equal(slugify('Florian Le Joncour'), 'florian-le-joncour');
  assert.equal(ageOn('1989-04-29', new Date('2026-09-26T12:00:00Z')), 37);
  assert.equal(ageOn('2006-09-25', new Date('2026-09-26T12:00:00Z')), 20);
  assert.equal(ageOn('2006-09-27', new Date('2026-09-26T12:00:00Z')), 19);
  assert.equal(ageOn(null), null);
});

test('Torschützen aus OpenLigaDB werden Kaderspielern zugeordnet', () => {
  const { spieler } = parseSquad(squadRaw);
  const find = (n: string) => matchPlayer(n, spieler)?.name ?? null;
  assert.equal(find('M. Krattenmacher'), 'Maurice Krattenmacher');
  assert.equal(find('David Mokwa Ntusu'), 'David Ngabi Mokwa');
  assert.equal(find('D. Mokwa'), 'David Ngabi Mokwa');
  assert.equal(find('Cole Campbell'), 'Cole Campbell');
  assert.equal(find('F. Keidel'), 'Felix Keidel');
  assert.equal(find('L. Petkov'), 'Lukas Petkov');
  assert.equal(find('Pinckert'), 'Lukas Pinckert');
  assert.equal(find('L. Pfeiffer'), 'Luca Pfeiffer');
  assert.equal(find('Unbekannter Spieler'), null);
  assert.equal(find('Luca S.'), null, 'mehrdeutig/unklar → keine Zuordnung');
});

test('Torschützenliste mit offiziellen Namen, Varianten zusammengeführt', () => {
  const { spieler } = parseSquad(squadRaw);
  const out = scorersWithSquadNames(
    [
      { name: 'M. Krattenmacher', goals: 3, penalties: 0 },
      { name: 'D. Mokwa', goals: 1, penalties: 0 },
      { name: 'David Mokwa Ntusu', goals: 1, penalties: 1 },
      { name: 'Ehemaliger Spieler', goals: 1, penalties: 0 },
    ],
    spieler,
  );
  assert.deepEqual(out.map((s) => [s.name, s.goals, s.penalties, s.player?.nummer ?? null]), [
    ['Maurice Krattenmacher', 3, 0, 7],
    ['David Ngabi Mokwa', 2, 1, 42],
    ['Ehemaliger Spieler', 1, 0, null],
  ]);
});
