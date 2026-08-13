// Trinn 2 av natt-pipelinen: la den lokale Ollama-modellen SILE råstoffet fra
// data/avis-raw.json — velge de beste sakene, skrive korte norske sammendrag og
// merke hver med fakta/forskning/debatt/spekulasjon. Skriver den ferdige
// data/avis-data.json (samme skjema som avis-siden leser).
//
// VIKTIG: modellen får bare VELGE og OPPSUMMERE. url/source/date tas alltid
// uendret fra råstoffet — slik kan ikke modellen dikte opp kilder.
//
// Kjør:  npm run avis:digest   (krever at Ollama kjører lokalt)

import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const RAW = path.join(process.cwd(), 'data', 'avis-raw.json');
const OUT = path.join(process.cwd(), 'data', 'avis-data.json');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1';
const NTFY_TOPIC = process.env.NTFY_TOPIC || '';
const NTFY_URL = process.env.NTFY_URL || 'https://ntfy.sh';

const VALID_TAGS = ['fakta', 'forskning', 'debatt', 'spekulasjon'];
const PICKS_PER_SECTION = 4;

function periodFromDate(date) {
  if (!date) return 'week';
  const days = (Date.now() - new Date(date).getTime()) / 86400000;
  if (Number.isNaN(days)) return 'week';
  if (days <= 1.5) return 'day';
  if (days <= 8) return 'week';
  return 'month';
}

const SYSTEM = `Du er redaktør for en norsk temaavis. Du får en nummerert liste
med ekte nyhetssaker (tittel, kilde, dato, utdrag). Velg de mest relevante og
interessante (maks ${PICKS_PER_SECTION}). For hver valgt sak: skriv et kort,
nøytralt norsk sammendrag (1-2 setninger) og sett en "tag":
- "fakta": etablert/bekreftet hendelse
- "forskning": studie / fagfellevurdert / pågående forskning
- "debatt": diskusjon, tolkning eller mening
- "spekulasjon": påstand uten solid bevis (typisk UFO, "hemmelige funn" o.l.)
Vær ærlig med taggen. Ikke dikt opp innhold. Svar KUN med JSON på formen
{"picks":[{"index":<tall>,"summary":"<norsk>","tag":"<tag>"}]}.`;

async function ollamaPick(section) {
  const list = section.items
    .map(
      (it, i) =>
        `${i}. ${it.title} [kilde: ${it.source}, dato: ${it.date || 'ukjent'}] ${it.snippet || ''}`,
    )
    .join('\n');

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      format: 'json',
      options: { temperature: 0.2 },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `Seksjon: ${section.title}\n\nSaker:\n${list}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Ollama svarte ${res.status} — kjører den? (${OLLAMA_URL})`);
  const data = await res.json();
  let parsed;
  try {
    parsed = JSON.parse(data.message?.content ?? '{}');
  } catch {
    return [];
  }
  return Array.isArray(parsed.picks) ? parsed.picks : [];
}

function buildItems(section, picks) {
  const out = [];
  for (const p of picks) {
    const raw = section.items[p.index];
    if (!raw) continue; // ugyldig indeks → hopp over
    out.push({
      title: raw.title,
      summary: String(p.summary || raw.snippet || '').slice(0, 300),
      tag: VALID_TAGS.includes(p.tag) ? p.tag : 'debatt',
      source: raw.source, // alltid ekte
      url: raw.url, //        alltid ekte
      date: raw.date,
      period: periodFromDate(raw.date),
    });
  }
  return out;
}

async function notify(text) {
  if (!NTFY_TOPIC) return;
  try {
    await fetch(`${NTFY_URL}/${NTFY_TOPIC}`, {
      method: 'POST',
      headers: { Title: 'Dagsavisen', Tags: 'newspaper' },
      body: text,
    });
  } catch (err) {
    console.warn(`  ⚠ ntfy-varsel feilet: ${err.message}`);
  }
}

async function main() {
  let raw;
  try {
    raw = JSON.parse(await readFile(RAW, 'utf-8'));
  } catch {
    console.error('Fant ikke data/avis-raw.json — kjør "npm run avis:fetch" først.');
    process.exit(1);
  }

  const sections = [];
  let total = 0;
  for (const section of raw.sections || []) {
    if (!section.items?.length) {
      sections.push({ id: section.id, title: section.title, icon: section.icon, items: [] });
      continue;
    }
    process.stdout.write(`• ${section.title} (${section.items.length} inn) … `);
    let items = [];
    try {
      items = buildItems(section, await ollamaPick(section));
    } catch (err) {
      console.log(`feil: ${err.message}`);
      throw err; // Ollama nede = stopp, ikke skriv halv avis
    }
    console.log(`${items.length} valgt`);
    total += items.length;
    sections.push({ id: section.id, title: section.title, icon: section.icon, items });
  }

  const edition = new Date().toLocaleDateString('no-NO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  await writeFile(
    OUT,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        edition: edition.charAt(0).toUpperCase() + edition.slice(1),
        sections,
      },
      null,
      2,
    ),
  );
  console.log(`\n✓ Skrev ${total} saker til data/avis-data.json (modell: ${OLLAMA_MODEL})`);
  await notify(`Avisen er oppdatert — ${total} saker klare. God morgen! ☕`);
}

main().catch((err) => {
  console.error('Digest feilet:', err.message);
  process.exit(1);
});
