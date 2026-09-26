// Kleiner, abhängigkeitsfreier RSS-/Atom-Leser.
// Übernimmt bewusst nur Überschrift, Link und Datum – keine Artikeltexte.

export interface FeedItem {
  title: string;
  link: string;
  date: string | null; // ISO
}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»',
  bdquo: '„', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', sbquo: '‚',
  auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e] ?? m;
  });
}

function unwrap(s: string): string {
  const cdata = s.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  const raw = cdata ? cdata[1] : s;
  // Zweimal dekodieren fängt doppelt kodierte Titel ab (z. B. &amp;#8211;).
  const text = decodeEntities(decodeEntities(raw.replace(/<[^>]*>/g, ' ')));
  return text.replace(/\s+/g, ' ').trim();
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? unwrap(m[1]) : null;
}

function toIso(s: string | null): string | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function parseFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = [];

  // RSS 2.0
  for (const [, block] of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)) {
    const title = tag(block, 'title');
    const link = tag(block, 'link') ?? tag(block, 'guid');
    if (!title || !link || !/^https?:\/\//.test(link)) continue;
    items.push({ title, link, date: toIso(tag(block, 'pubDate') ?? tag(block, 'dc:date')) });
  }

  // Atom
  if (items.length === 0) {
    for (const [, block] of xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi)) {
      const title = tag(block, 'title');
      const hrefs = [...block.matchAll(/<link\b([^>]*)\/?>/gi)].map(([, attrs]) => ({
        href: attrs.match(/href="([^"]+)"/)?.[1],
        rel: attrs.match(/rel="([^"]+)"/)?.[1] ?? 'alternate',
      }));
      const link = decodeEntities(hrefs.find((h) => h.rel === 'alternate')?.href ?? hrefs[0]?.href ?? '');
      if (!title || !/^https?:\/\//.test(link)) continue;
      items.push({ title, link, date: toIso(tag(block, 'published') ?? tag(block, 'updated')) });
    }
  }
  return items;
}

export async function fetchFeed(url: string): Promise<FeedItem[]> {
  const res = await fetch(url, {
    headers: {
      accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
      'user-agent': 'svelversberg.com-fanseite (RSS-Reader; +https://svelversberg.com)',
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} für ${url}`);
  return parseFeed(await res.text());
}
