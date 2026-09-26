import type { APIRoute } from 'astro';
import { getSiteData } from '../lib/data.ts';
import { buildIcs } from '../lib/ics.ts';
import { byKickoff, involves } from '../lib/openligadb.ts';
import { url } from '../lib/url.ts';

export const GET: APIRoute = async ({ site }) => {
  const data = await getSiteData();
  const teamId = data.team?.data.teamId;
  const matches = teamId ? (data.matches?.data ?? []).filter((m) => involves(m, teamId)).sort(byKickoff) : [];
  const body = buildIcs({
    matches,
    calName: 'SV Elversberg – Spielplan (inoffiziell)',
    leagueName: data.league ? `${data.league.data.name} ${data.league.data.seasonLabel}` : 'Liga',
    siteUrl: new URL(url('/spielplan'), site).toString(),
  });
  return new Response(body, { headers: { 'Content-Type': 'text/calendar; charset=utf-8' } });
};
