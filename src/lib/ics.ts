// Erzeugt eine abonnierbare Kalenderdatei (.ics) aus dem Spielplan.
import { finalScore, kickoff, type OldbMatch } from './openligadb.ts';

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Zeilen länger als 75 Byte umbrechen (RFC 5545). */
function fold(line: string): string {
  const bytes = new TextEncoder();
  if (bytes.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  for (const ch of line) {
    const limit = out.length === 0 ? 75 : 74; // Folgezeilen beginnen mit Leerzeichen
    if (bytes.encode(cur + ch).length > limit) {
      out.push(cur);
      cur = ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}

export function buildIcs(opts: {
  matches: OldbMatch[];
  calName: string;
  leagueName: string;
  siteUrl: string;
  now?: Date;
}): string {
  const now = opts.now ?? new Date();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//svelversberg.com//Spielplan//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(opts.calName)}`,
    'X-WR-TIMEZONE:Europe/Berlin',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
  ];
  for (const m of opts.matches) {
    const start = kickoff(m);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const score = finalScore(m);
    const summary = `${m.team1.teamName} – ${m.team2.teamName}${m.matchIsFinished && score ? ` (${score.home}:${score.away})` : ''}`;
    const desc = `${opts.leagueName}${m.group ? `, ${m.group.groupName}` : ''}.\nAnstoßzeit laut OpenLigaDB, ohne Gewähr.\nInoffizielle Fanseite: ${opts.siteUrl}`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:match-${m.matchID}@svelversberg.com`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${esc(summary)}`,
      `DESCRIPTION:${esc(desc)}`,
      ...(m.location?.locationStadium ? [`LOCATION:${esc(m.location.locationStadium)}`] : []),
      `URL:${opts.siteUrl}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
