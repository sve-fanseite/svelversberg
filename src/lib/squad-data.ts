// Einmal pro Build: Kader lesen und Saisontore zuordnen.
import raw from '../data/kader.json';
import namen from '../data/torschuetzen-namen.json';
import { getSiteData } from './data.ts';
import { parseSquad, scorersWithSquadNames, type Player, type Squad } from './kader.ts';
import { teamStats, type TeamStats } from './stats.ts';

export interface SquadData {
  squad: Squad;
  stats: TeamStats | null;
  scorers: ReturnType<typeof scorersWithSquadNames>;
  goalsOf: (p: Player) => number;
}

let cached: Promise<SquadData> | null = null;

export function getSquadData(): Promise<SquadData> {
  return (cached ??= (async () => {
    const squad = parseSquad(raw);
    const data = await getSiteData();
    const teamId = data.team?.data.teamId;
    const aliases = Object.fromEntries(Object.entries(namen as Record<string, string>).filter(([k]) => !k.startsWith('_')));
    const stats = teamId && data.matches ? teamStats(data.matches.data, teamId, aliases) : null;
    const scorers = stats ? scorersWithSquadNames(stats.scorers, squad.spieler) : [];
    const goalsOf = (p: Player) => scorers.find((s) => s.player?.slug === p.slug)?.goals ?? 0;
    return { squad, stats, scorers, goalsOf };
  })());
}
