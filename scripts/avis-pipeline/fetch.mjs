// Trinn 1 av natt-pipelinen: hent råstoff fra RSS-kildene i feeds.mjs og skriv
// data/avis-raw.json. Ingen AI her — bare innsamling. Robust: en kilde som er
// nede hoppes over, resten fortsetter.
//
// Kjør:  npm run avis:fetch

import Parser from 'rss-parser';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { FEEDS } from './feeds.mjs';

const OUT = path.join(process.cwd(), 'data', 'avis-raw.json');
const MAX_PER_FEED = 12; // hold råfila liten — Ollama siler senere
const MAX_AGE_DAYS = 30; // ikke ta med eldgammelt stoff

// Nettleser-User-Agent: mange nyhetssider (og Google News) svarer 403 på
// forespørsler uten den.
const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  },
});

function clean(html) {
  return String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);
}

function withinAge(iso) {
  if (!iso) return true; // ukjent dato → behold, Ollama vurderer
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return true;
  return (Date.now() - t) / 86400000 <= MAX_AGE_DAYS;
}

async function fetchFeed(url) {
  try {
    const feed = await parser.parseURL(url);
    const source = feed.title || new URL(url).hostname;
    return (feed.items || [])
      .filter((it) => withinAge(it.isoDate || it.pubDate))
      .slice(0, MAX_PER_FEED)
      .map((it) => ({
        title: (it.title || '').trim(),
        url: it.link || '',
        source,
        date: (it.isoDate || it.pubDate || '').slice(0, 10),
        snippet: clean(it.contentSnippet || it.content || it.summary),
      }))
      .filter((it) => it.title && it.url);
  } catch (err) {
    console.warn(`  ⚠ hoppet over ${url} (${err.message})`);
    return [];
  }
}

async function main() {
  const sections = [];
  let total = 0;

  for (const feed of FEEDS) {
    process.stdout.write(`• ${feed.title} … `);
    const items = [];
    const seen = new Set();
    for (const url of feed.urls) {
      for (const it of await fetchFeed(url)) {
        const key = it.url || it.title;
        if (seen.has(key)) continue;
        seen.add(key);
        items.push(it);
      }
    }
    console.log(`${items.length} saker`);
    total += items.length;
    sections.push({ id: feed.id, title: feed.title, icon: feed.icon, items });
  }

  await writeFile(
    OUT,
    JSON.stringify({ fetchedAt: new Date().toISOString(), sections }, null, 2),
  );
  console.log(`\n✓ Skrev ${total} råsaker til data/avis-raw.json`);
}

main().catch((err) => {
  console.error('Fetch feilet:', err);
  process.exit(1);
});
