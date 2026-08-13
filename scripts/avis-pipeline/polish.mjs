import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Claude-morgentrinnet: leser data/avis-data.json (fylt av Ollama om natten) og
// lar Claude skrive penere norske reportasje-ingresser. Beholder ALT annet —
// url, kilde, dato, tag — uendret; bare "summary" forbedres.
//
// Krever ANTHROPIC_API_KEY i .env. Uten den hopper skriptet pent over seg selv,
// og avisen beholder de rene kilde-utdragene fra Ollama-trinnet.
//
// Kjør:  npm run avis:polish

const FILE = path.join(process.cwd(), 'data', 'avis-data.json');
const API_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5';
const API_URL = 'https://api.anthropic.com/v1/messages';

const SYSTEM = `Du er redaktør for en norsk temaavis. Du får en nummerert liste
med nyhetssaker (tittel, tag, utdrag). Skriv for hver sak en kort, velskrevet og
nøytral norsk ingress på 1–2 setninger, basert KUN på tittelen og utdraget.
Ikke dikt opp tall, sitater eller detaljer som ikke står der. Ingen medisinske
råd (peptider o.l. omtales kun som forskningsnytt). Behold saklig tone; skill
påstand fra faktum ("X hevder …"). Svar kun med JSON etter skjemaet.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['i', 'summary'],
        properties: {
          i: { type: 'integer' },
          summary: { type: 'string' },
        },
      },
    },
  },
};

async function main() {
  if (!API_KEY) {
    console.log('ANTHROPIC_API_KEY mangler — hopper over Claude-finpuss (avisen beholder kilde-utdragene).');
    return;
  }

  let data;
  try {
    data = JSON.parse(await readFile(FILE, 'utf-8'));
  } catch {
    console.error('Fant ikke data/avis-data.json — kjør natt-pipelinen først.');
    process.exit(1);
  }

  // Flat liste med global indeks → (seksjon, sak), så vi kan mappe svaret tilbake.
  const flat = [];
  (data.sections || []).forEach((section, si) => {
    (section.items || []).forEach((item, ii) => {
      flat.push({ si, ii, item });
    });
  });
  if (!flat.length) {
    console.log('Ingen saker å pusse.');
    return;
  }

  const list = flat.map(
    ({ item }, i) =>
      `${i}. [${item.tag || 'sak'}] ${item.title}\n   ${(item.summary || '').slice(0, 300)}`,
  );

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      thinking: { type: 'disabled' },
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: 'user', content: `Saker:\n${list.join('\n')}` }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Claude svarte ${res.status}: ${detail.slice(0, 300)}`);
  }

  const body = await res.json();
  if (body.stop_reason === 'refusal') {
    console.warn('Claude avslo forespørselen — beholder kilde-utdragene uendret.');
    return;
  }

  const text = (body.content || []).find((b) => b.type === 'text')?.text ?? '';
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    console.warn('Kunne ikke lese Claude-svaret som JSON — beholder kilde-utdragene.');
    return;
  }

  let updated = 0;
  for (const pick of parsed.items || []) {
    const target = flat[pick.i];
    if (!target || typeof pick.summary !== 'string' || !pick.summary.trim()) continue;
    target.item.summary = pick.summary.trim().slice(0, 400);
    updated++;
  }

  data.polishedAt = new Date().toISOString();
  await writeFile(FILE, JSON.stringify(data, null, 2));
  console.log(`✓ Claude pusset ${updated} av ${flat.length} saker (modell: ${MODEL}).`);
}

main().catch((err) => {
  // Finpuss er valgfritt — en feil her skal ikke velte hele natt-jobben.
  console.error('Claude-finpuss feilet (avisen står fortsatt med Ollama-tekst):', err.message);
  process.exit(0);
});
