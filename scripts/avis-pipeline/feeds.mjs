// Kilder for Dagsavisen, gruppert per seksjon.
//
// Vi bruker Google News RSS — gratis, ingen API-nøkkel, og lar oss SØKE per
// tema. Bytt gjerne søkeordene under, eller legg til egne RSS-URL-er i tillegg.
// Feeds som er nede/blokkerer hoppes bare over (fetch.mjs er robust).
//
// id/title/icon MÅ matche seksjonene i lib/avis.js og avis-siden.

// Bygger en Google News RSS-søke-URL. lang='no' → norske treff, 'en' → globale.
function gnews(query, lang = 'no') {
  const q = encodeURIComponent(query);
  return lang === 'en'
    ? `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`
    : `https://news.google.com/rss/search?q=${q}&hl=no&gl=NO&ceid=NO:no`;
}

export const FEEDS = [
  {
    id: 'kosthold',
    title: 'Kosthold & Trening',
    icon: '🥩',
    urls: [
      gnews('kosthold OR ernæring OR trening OR søvn OR langlevelse'),
      gnews('longevity OR nutrition study OR fitness science', 'en'),
    ],
  },
  {
    id: 'penger',
    title: 'Børs & Pengemakt',
    icon: '💰',
    urls: [
      gnews('børs OR aksjer OR marked OR sentralbank OR rente'),
      gnews('S&P 500 OR gold price OR bitcoin OR BlackRock OR hedge fund', 'en'),
    ],
  },
  {
    id: 'gen',
    title: 'Genteknologi & Peptider',
    icon: '🧬',
    urls: [
      gnews('CRISPR OR genteknologi OR genterapi'),
      gnews('CRISPR OR gene therapy OR peptide research OR BPC-157', 'en'),
    ],
  },
  {
    id: 'arkeologi',
    title: 'Arkeologi & Giza',
    icon: '🏛️',
    urls: [
      gnews('arkeologi OR utgraving OR pyramide'),
      gnews('Giza pyramid OR archaeology discovery OR Gobekli Tepe', 'en'),
    ],
  },
  {
    id: 'ai',
    title: 'AI & Fremtid',
    icon: '🤖',
    urls: [
      gnews('kunstig intelligens OR AI-modell'),
      gnews('AI breakthrough OR frontier model OR AGI', 'en'),
    ],
  },
  {
    id: 'ufo',
    title: 'UFO/UAP & Det uforklarte',
    icon: '🛸',
    urls: [
      gnews('UFO OR UAP OR uidentifisert'),
      gnews('UAP OR UFO hearing OR unexplained aerial', 'en'),
    ],
  },
  {
    id: 'rogan',
    title: 'Fra Rogan-sfæren',
    icon: '🎙️',
    urls: [
      gnews('Joe Rogan podcast', 'en'),
    ],
  },
];
