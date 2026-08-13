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
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';

const RAW = path.join(process.cwd(), 'data', 'avis-raw.json');
const OUT = path.join(process.cwd(), 'data', 'avis-data.json');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1';
const NTFY_TOPIC = process.env.NTFY_TOPIC || '';
const NTFY_URL = process.env.NTFY_URL || 'https://ntfy.sh';

const VALID_TAGS = ['fakta', 'forskning', 'debatt', 'spekulasjon'];
const PICKS_PER_SECTION = 4;
const MAX_ITEMS_PROMPT = 10; // hvor mange saker vi viser modellen per seksjon
const SNIPPET_IN_PROMPT = 120; // kutt utdrag i prompten så konteksten holder seg liten
// 0 = la Ollama bruke modellens egen standard (samme som "ollama run"). Å tvinge
// et stort num_ctx kan få små modeller til å degenerere til søppel-utskrift.
const NUM_CTX = Number(process.env.OLLAMA_NUM_CTX) || 0;

function periodFromDate(date) {
  if (!date) return 'week';
  const days = (Date.now() - new Date(date).getTime()) / 86400000;
  if (Number.isNaN(days)) return 'week';
  if (days <= 1.5) return 'day';
  if (days <= 8) return 'week';
  return 'month';
}

const SYSTEM = `Du er redaktør for en norsk temaavis. Du får en nummerert liste
med ekte nyhetssaker. Velg de mest relevante og interessante (maks ${PICKS_PER_SECTION}).
For hver valgt sak oppgir du BARE "index" (tallet foran saken) og en "tag":
- "fakta": etablert/bekreftet hendelse
- "forskning": studie / fagfellevurdert / pågående forskning
- "debatt": diskusjon, tolkning eller mening
- "spekulasjon": påstand uten solid bevis (typisk UFO, "hemmelige funn" o.l.)
Vær ærlig med taggen. Du skal IKKE skrive sammendrag — bare velge og merke.
Svar med KUN rå JSON, ingen forklaring, ingen markdown. Nøyaktig denne formen:
{"picks":[{"index":0,"tag":"forskning"}]}`;

// "Degenerert" svar = modellen har hengt seg opp i å gjenta (nesten) bare ett
// tegn, typisk "@@@@". Da er det ingen vits å prøve å lese JSON.
function isDegenerate(raw) {
  const s = String(raw).replace(/\s+/g, '');
  return s.length >= 12 && new Set(s).size <= 2;
}

async function callOllama(section, list) {
  // repeat_penalty straffer å gjenta samme token — direkte motgift mot "@@@@"-
  // loopen. num_ctx overstyres bare hvis satt eksplisitt i .env.
  const options = { temperature: 0.4, top_p: 0.9, repeat_penalty: 1.3 };
  if (NUM_CTX > 0) options.num_ctx = NUM_CTX;

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      options,
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
  return data.message?.content ?? data.response ?? '';
}

async function ollamaPick(section) {
  // Vis modellen bare de første N sakene, med korte utdrag — mindre å tygge på =
  // mindre minnepress og mindre sjanse for degenerasjon. Indeksene 0..N-1 peker
  // rett inn i section.items, så buildItems finner riktig råsak.
  const list = section.items
    .slice(0, MAX_ITEMS_PROMPT)
    .map(
      (it, i) =>
        `${i}. ${it.title} [kilde: ${it.source}, dato: ${it.date || 'ukjent'}] ${(it.snippet || '').slice(0, SNIPPET_IN_PROMPT)}`,
    )
    .join('\n');

  // Prøv opptil 2 ganger: degenerert/tomt svar → nytt forsøk.
  let content = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    content = await callOllama(section, list);
    if (process.env.AVIS_DEBUG) {
      console.log(`\n  [DEBUG ${section.id} forsøk ${attempt}]:\n${content.slice(0, 400)}\n`);
    }
    if (isDegenerate(content)) continue; // søppel → prøv på nytt
    const picks = parsePicks(content);
    if (picks.length) return { picks, raw: content };
  }
  if (!parsePicks(content).length && process.env.AVIS_DEBUG) {
    console.log('  [DEBUG] fant ingen gyldige picks etter 2 forsøk');
  }
  return { picks: parsePicks(content), raw: content };
}

// Hent picks ut av modellsvaret. Prøver ekte JSON først; faller tilbake til en
// regex-berging som plukker index + tag fra hvert {..}-objekt selv når JSON-en
// er ødelagt (små modeller lager ofte nesten-gyldig JSON — dobbeltnøkler,
// manglende hermetegn osv.).
function parsePicks(content) {
  const parsed = extractJson(content);
  if (parsed) {
    const arr = Array.isArray(parsed)
      ? parsed
      : parsed.picks || parsed.saker || parsed.valg || parsed.results || parsed.items || [];
    if (Array.isArray(arr) && arr.length) return arr;
  }
  // Bergingsmodus: plukk hvert {..}-objekt og trekk ut index + tag med regex.
  const picks = [];
  for (const obj of content.match(/\{[^{}]*\}/g) || []) {
    const idx = obj.match(/index"?\s*:\s*(\d+)/i);
    if (!idx) continue;
    const tag = obj.match(/"tag"?\s*:\s*"?([a-zæøåA-ZÆØÅ]+)/);
    picks.push({ index: Number(idx[1]), tag: tag ? tag[1].toLowerCase() : undefined });
  }
  return picks;
}

// Plukk JSON ut av modellens tekst — tåler ```json-gjerder og forklarende prat
// rundt selve JSON-en (vanlig når vi ikke tvinger format).
function extractJson(text) {
  let s = String(text).trim();
  s = s.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(s);
  } catch {}
  const start = s.search(/[[{]/);
  if (start === -1) return null;
  const open = s[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === open) depth++;
    else if (s[i] === close && --depth === 0) {
      try {
        return JSON.parse(s.slice(start, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

const DEBUG_LOG = path.join(process.cwd(), 'data', 'avis-digest-debug.log');

// Skriv modellens råsvar til logg når en seksjon gir 0 treff, så vi kan se
// nøyaktig hvilken form svaret hadde.
async function logDebug(section, raw) {
  const block = `\n[${new Date().toISOString()}] ${section.id} (0 treff) — råsvar:\n${String(raw).slice(0, 1200)}\n`;
  try {
    await appendFile(DEBUG_LOG, block, 'utf8');
  } catch {}
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
      // Teksten kommer fra den ekte RSS-kilden — ren og pålitelig. Den lokale
      // modellen brukes bare til å velge + merke; Claude-morgentrinnet kan
      // eventuelt skrive penere norske sammendrag senere.
      summary: String(raw.snippet ?? p.summary ?? p.sammendrag ?? '').slice(0, 300),
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
      const { picks, raw: modelRaw } = await ollamaPick(section);
      items = buildItems(section, picks);
      if (items.length === 0) await logDebug(section, modelRaw);
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
