// Datums- und Zeitfunktionen, immer in deutscher Zeit (Europe/Berlin).

export const TZ = 'Europe/Berlin';

function berlinParts(d: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get('year'), month: get('month') };
}

/** Saison-Startjahr: ab Juli zählt die neue Saison (2026 = Saison 2026/27). */
export function currentSeason(now: Date = new Date()): number {
  const { year, month } = berlinParts(now);
  return month >= 7 ? year : year - 1;
}

export function seasonLabel(season: number): string {
  return `${season}/${String((season + 1) % 100).padStart(2, '0')}`;
}

const fmt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('de-DE', { timeZone: TZ, ...opts });

const fDateLong = fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fDateShort = fmt({ weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
const fDay = fmt({ day: '2-digit', month: '2-digit', year: 'numeric' });
const fTime = fmt({ hour: '2-digit', minute: '2-digit' });

export const formatDateLong = (d: Date) => fDateLong.format(d);
export const formatDateShort = (d: Date) => fDateShort.format(d);
export const formatDay = (d: Date) => fDay.format(d);
export const formatTime = (d: Date) => `${fTime.format(d)} Uhr`;
export const formatStamp = (d: Date) => `${fDay.format(d)}, ${fTime.format(d)} Uhr`;
