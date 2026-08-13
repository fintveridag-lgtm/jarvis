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
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.text()).slice(0, 200);
    } catch {}
    throw new Error(
      `Ollama svarte ${res.status}${detail ? ` — ${detail}` : ''} ` +
        `(modell: "${OLLAMA_MODEL}", ${OLLAMA_URL}). ` +
        `Sjekk "ollama list" og sett OLLAMA_MODEL i .env til et navn du har.`,
    );
  }
  const data = await res.json();
  const content = data.message?.content ?? '';
  if (process.env.AVIS_DEBUG) {
    console.log(`\n  [DEBUG ${section.id}] råsvar fra modellen:\n${content.slice(0, 600)}\n`);
  }
  let parsed;
  try {
    parsed = JSON.parse(content || '{}');
  } catch {
    if (process.env.AVIS_DEBUG) console.log('  [DEBUG] svaret var ikke gyldig JSON');
    return [];
  }
  // Godta både {"picks":[...]}, en naken liste, og vanlige alternative nøkler —
  // små modeller følger ikke alltid skjemaet helt presist.
  const arr = Array.isArray(parsed)
    ? parsed
    : parsed.picks || parsed.saker || parsed.valg || parsed.results || parsed.items || [];
  return Array.isArray(arr) ? arr : [];
}

// Finn den ekte råsaken en "pick" peker på — via indeks, eller via tittel hvis
// modellen droppet indeksen. Kilde/URL/dato tas ALLTID herfra, aldri fra modellen.
function resolveRaw(section, p) {
  const idx = p.index ?? p.i ?? p.id ?? p.nr ?? p.indeks;
  if (idx !== undefined && idx !== null && section.items[Number(idx)]) {
    return section.items[Number(idx)];
  }
  const t = String(p.title ?? p.tittel ?? p.overskrift ?? '').toLowerCase().trim();
  if (t.length >= 6) {
    return section.items.find((it) => {
      const a = it.title.toLowerCase();
      return a.includes(t.slice(0, 25)) || t.includes(a.slice(0, 25));
    });
  }
  return null;
}

function buildItems(section, picks) {
  const out = [];
  const used = new Set();
  for (const p of picks) {
    const raw = resolveRaw(section, p);
    if (!raw || used.has(raw.url)) continue; // ugyldig/duplikat → hopp over
    used.add(raw.url);
    out.push({
      title: raw.title,
      summary: String(p.summary ?? p.sammendrag ?? raw.snippet ?? '').slice(0, 300),
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
