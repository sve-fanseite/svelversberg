// Kader aus src/data/kader.json: Prüfung, Alter, Adressen (Slugs) und Zuordnung der Torschützen.
import { TZ } from './time.ts';
import type { Scorer } from './stats.ts';

export const POSITIONS = ['Tor', 'Abwehr', 'Mittelfeld', 'Sturm'] as const;
export type Position = (typeof POSITIONS)[number];

export const POSITION_PLURAL: Record<Position, string> = {
  Tor: 'Torhüter',
  Abwehr: 'Abwehr',
  Mittelfeld: 'Mittelfeld',
  Sturm: 'Sturm',
};

export interface Player {
  nummer: number;
  name: string;
  position: Position;
  geburtsdatum: string | null;
  nationalitaet: string | null;
  profil?: string | null;
  slug: string;
}

export interface Staff {
  name: string;
  funktion: string;
}

export interface Squad {
  stand: string | null;
  quelle: string | null;
  spieler: Player[];
  trainerteam: Staff[];
}

export function slugify(name: string): string {
  return name
    .toLocaleLowerCase('de')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Liest die Kader-Datei und meldet Fehler verständlich (Build bricht dann ab). */
export function parseSquad(raw: unknown): Squad {
  const data = raw as Record<string, unknown>;
  const errors: string[] = [];
  const players = Array.isArray(data.spieler) ? data.spieler : [];
  const spieler: Player[] = players.map((p: Record<string, unknown>, i: number) => {
    const where = `Spieler ${i + 1} (${p?.name ?? 'ohne Namen'})`;
    if (typeof p.name !== 'string' || !p.name.trim()) errors.push(`${where}: "name" fehlt`);
    if (typeof p.nummer !== 'number') errors.push(`${where}: "nummer" muss eine Zahl sein`);
    if (!POSITIONS.includes(p.position as Position)) errors.push(`${where}: "position" muss Tor, Abwehr, Mittelfeld oder Sturm sein`);
    if (p.geburtsdatum != null && !/^\d{4}-\d{2}-\d{2}$/.test(String(p.geburtsdatum)))
      errors.push(`${where}: "geburtsdatum" bitte als JJJJ-MM-TT angeben`);
    return {
      nummer: p.nummer as number,
      name: String(p.name ?? '').trim(),
      position: p.position as Position,
      geburtsdatum: (p.geburtsdatum as string) ?? null,
      nationalitaet: (p.nationalitaet as string) ?? null,
      profil: (p.profil as string) ?? null,
      slug: slugify(String(p.name ?? '')),
    };
  });
  const seenNr = new Map<number, string>();
  const seenSlug = new Set<string>();
  for (const p of spieler) {
    if (seenNr.has(p.nummer)) errors.push(`Rückennummer ${p.nummer} ist doppelt vergeben (${seenNr.get(p.nummer)} und ${p.name})`);
    seenNr.set(p.nummer, p.name);
    if (seenSlug.has(p.slug)) errors.push(`Name doppelt: ${p.name}`);
    seenSlug.add(p.slug);
  }
  const staff = Array.isArray(data.trainerteam) ? (data.trainerteam as Staff[]) : [];
  if (errors.length) throw new Error(`Fehler in src/data/kader.json:\n- ${errors.join('\n- ')}`);
  return {
    stand: (data.stand as string) ?? null,
    quelle: (data.quelle as string) ?? null,
    spieler: spieler.sort((a, b) => a.nummer - b.nummer),
    trainerteam: staff,
  };
}

/** Alter in vollen Jahren (deutsche Zeit). */
export function ageOn(birth: string | null, now = new Date()): number | null {
  if (!birth) return null;
  const [y, m, d] = birth.split('-').map(Number);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(now)
    .split('-')
    .map(Number);
  let age = parts[0] - y;
  if (parts[1] < m || (parts[1] === m && parts[2] < d)) age--;
  return age;
}

const words = (n: string) =>
  n.toLocaleLowerCase('de').normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[\s.-]+/).filter(Boolean);

/**
 * Ordnet einen Torschützen-Namen aus OpenLigaDB einem Kaderspieler zu – nur bei eindeutigem Treffer.
 * "M. Krattenmacher" → Maurice Krattenmacher; "David Mokwa Ntusu" → David Ngabi Mokwa.
 */
export function matchPlayer(scorerName: string, players: Player[]): Player | null {
  const sw = words(scorerName);
  if (sw.length === 0) return null;
  const abbreviated = /^\p{L}\.\s*\S/u.test(scorerName.trim());
  const candidates = players.filter((p) => {
    const pw = words(p.name);
    if (abbreviated) {
      return pw[0].startsWith(sw[0]) && sw.slice(1).every((w) => pw.includes(w));
    }
    if (sw.join(' ') === pw.join(' ')) return true;
    // gleicher Vorname und mindestens ein weiterer gemeinsamer Namensteil
    return sw[0] === pw[0] && sw.slice(1).some((w) => pw.slice(1).includes(w));
  });
  if (candidates.length === 1) return candidates[0];
  // nur Nachname, z. B. "Krattenmacher"
  if (sw.length === 1) {
    const bySurname = players.filter((p) => words(p.name).slice(1).includes(sw[0]));
    if (bySurname.length === 1) return bySurname[0];
  }
  return null;
}

/** Torschützenliste auf offizielle Kadernamen umschreiben (und dabei zusammenführen). */
export function scorersWithSquadNames(scorers: Scorer[], players: Player[]): (Scorer & { player: Player | null })[] {
  const map = new Map<string, Scorer & { player: Player | null }>();
  for (const s of scorers) {
    const player = matchPlayer(s.name, players);
    const key = player ? `p:${player.slug}` : `n:${s.name}`;
    const cur = map.get(key) ?? { name: player?.name ?? s.name, goals: 0, penalties: 0, player };
    cur.goals += s.goals;
    cur.penalties += s.penalties;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name, 'de'));
}
