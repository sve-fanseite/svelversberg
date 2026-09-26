// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// SITE_URL und BASE_PATH werden beim Vorschau-Build (GitHub Pages) gesetzt.
// Für die echte Seite gilt: https://svelversberg.com im Hauptverzeichnis.
const site = process.env.SITE_URL || 'https://svelversberg.com';
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site,
  base,
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  integrations: [
    sitemap({
      // Platzhalter-Seiten (noch "In Arbeit") und 404 nicht in die Sitemap
      filter: (page) =>
        !/\/(404|news|tabelle|spielplan|kader|statistiken|verein|impressum|datenschutz)\/?$/.test(page),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
