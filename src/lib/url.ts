// Baut Links passend zum Basis-Pfad (Vorschau auf GitHub Pages liegt in einem Unterordner).
export function url(path = '/'): string {
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}` || '/';
}

/** Vorschau-Build (GitHub Pages): nicht von Suchmaschinen indexieren lassen. */
export const isPreview = () => process.env.PREVIEW === 'true';

export const NAV = [
  { href: '/', label: 'Start' },
  { href: '/news', label: 'News' },
  { href: '/tabelle', label: 'Tabelle' },
  { href: '/spielplan', label: 'Spielplan' },
  { href: '/kader', label: 'Kader' },
  { href: '/statistiken', label: 'Statistiken' },
  { href: '/verein', label: 'Verein' },
];
