import { readFile } from 'node:fs/promises';
import path from 'node:path';

const FILE_PATH = path.join(process.cwd(), 'data', 'avis-data.json');

// Standard-seksjoner brukes som fallback slik at avisen alltid viser en pen
// forside med temaene, selv når data/avis-data.json ikke finnes ennå.
export const DEFAULT_SECTIONS = [
  { id: 'kosthold', title: 'Kosthold & Trening', icon: '🥩', items: [] },
  { id: 'penger', title: 'Børs & Pengemakt', icon: '💰', items: [] },
  { id: 'gen', title: 'Genteknologi & Peptider', icon: '🧬', items: [] },
  { id: 'arkeologi', title: 'Arkeologi & Giza', icon: '🏛️', items: [] },
  { id: 'ai', title: 'AI & Fremtid', icon: '🤖', items: [] },
  { id: 'ufo', title: 'UFO/UAP & Det uforklarte', icon: '🛸', items: [] },
  { id: 'rogan', title: 'Fra Rogan-sfæren', icon: '🎙️', items: [] },
];

// Leser data/avis-data.json (skrevet av avis-rutinen). Mangler den, returneres
// en tom-tilstand med standard-seksjoner — aldri en feil.
export async function getAvis() {
  try {
    const raw = await readFile(FILE_PATH, 'utf-8');
    const data = JSON.parse(raw);
    return {
      available: true,
      generatedAt: data.generatedAt ?? null,
      edition: data.edition ?? null,
      sections:
        Array.isArray(data.sections) && data.sections.length
          ? data.sections
          : DEFAULT_SECTIONS,
    };
  } catch {
    return {
      available: false,
      generatedAt: null,
      edition: null,
      sections: DEFAULT_SECTIONS,
    };
  }
}
