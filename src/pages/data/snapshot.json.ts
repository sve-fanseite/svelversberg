// Veröffentlicht den aktuellen Datenstand. Der nächste Build nutzt ihn als Rückfall,
// falls eine Quelle nicht antwortet – so bleibt immer der letzte gute Stand online.
import type { APIRoute } from 'astro';
import { getSiteData } from '../../lib/data.ts';

export const GET: APIRoute = async () => {
  const data = await getSiteData();
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
};
