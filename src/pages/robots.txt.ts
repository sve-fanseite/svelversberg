import type { APIRoute } from 'astro';
import { isPreview, url } from '../lib/url.ts';

export const GET: APIRoute = ({ site }) => {
  const body = isPreview()
    ? 'User-agent: *\nDisallow: /\n' // Vorschau soll nicht in Suchmaschinen landen
    : `User-agent: *\nAllow: /\n\nSitemap: ${new URL(url('/sitemap-index.xml'), site)}\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
