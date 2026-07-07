# Jarvis — kommandosenter-dashbord

Dette er "Jarvis": et fullskjerms, mørkt, kinematisk dashbord som kjører lokalt
via Node/Express. I midten en pulserende WebGL2 "arc reactor"-orb som reagerer
på stemmen; rundt den 6 databokser. På trigger leser en ElevenLabs Jarvis-stemme
opp en morgenbrief, og hver boks FLIP-animeres til nær-fullskjerm i takt med
setningen som leses opp (ms-cues fra ElevenLabs' tegn-tidslinje).

Eieren kjører dette på Windows-PC (PowerShell) og er ikke utvikler — forklar
ting enkelt, på norsk, og gi konkrete PowerShell-kommandoer når det trengs.

## Kjøring

- `npm install` én gang, deretter `npm start` → http://localhost:3000
- Node 20+, rene ES-moduler, **ingen build-steg**. Frontend er vanilla HTML/CSS/JS.
- Hemmeligheter i `.env` (kopier fra `.env.example`): ELEVENLABS_API_KEY,
  ELEVENLABS_VOICE_ID, META_ACCESS_TOKEN, META_AD_ACCOUNT_ID,
  INSTAGRAM_BUSINESS_ACCOUNT_ID, evt. NOTION_API_KEY + NOTION_HOME_PAGE_ID.
  Aldri hardkod nøkler; aldri commit `.env`.
- VIKTIG: Node cacher moduler — etter endringer i `server.js`/`lib/*.js` må
  serveren restartes (Ctrl+C → `npm start`). Frontend serveres ferskt ved reload.

## Struktur

- `server.js` — Express-server, API-endepunkter (bl.a. `/api/brief`, `/api/data`)
- `lib/` — datamoduler: `meta-ads.js`, `instagram.js`, `client-performance.js`,
  `claude-data.js` (leser `data/claude-data.json`), `elevenlabs.js` (TTS
  with-timestamps), `cues.js` (tegn-offset → ms-cues), `brief-script.js`
  (bygger manuset), `data-aggregate.js`, `cache.js`
- `public/js/` — `orb.js` (WebGL2-shader), `overlay.js` (delt overlay + FLIP),
  `app.js`, `audio-analyser.js`, `speech.js` (Web Speech-trigger)
- `scripts/morning-routine-prompt.md` — prompt som henter Notion/nyheter/Gmail
  og skriver `data/claude-data.json` (serveren slår den sammen med live-data)

## De 6 boksene

1. Instagram (7 dager, organisk) — Graph API insights; fallback til
   followers_count/media_count hvis token mangler instagram_manage_insights-scope
2. Meta-annonser (7 dager) — resultat mappes fra ad-settets `optimization_goal`
   (THRUPLAY→thruplays, LINK_CLICKS→link-klikk, LEAD_GENERATION→leads,
   POST_ENGAGEMENT→engasjement). ALDRI vis CPL/link-klikk for engasjement-kampanjer.
3. Klient-ytelse (måned hittil) — salg/ROAS/kostnad, myke Catmull-Rom-kurver.
   Skal ALDRI leses opp i stemme-briefen — kun vises.
4. Notion "I dag" — fra claude-data.json
5. World Stage — nyheter + markedspriser + equirectangular verdenskart med
   glødende prikker (lyst nok kart)
6. Gmail hastesaker — fra claude-data.json

Boksene 4–6 fylles av morgenrutinen; uten den viser de en pen
"kjør morgenrutinen"-tilstand, aldri feil.

## Kritiske regler (lærd av bugs)

- Én delt overlay-panel gjenbrukes for alle bokser. Utsatt opprydding
  (innerHTML="") MÅ beskyttes av generasjons-token `opSeq` — ellers svart boks
  ved raske overganger.
- ALDRI legg CSS-filter (f.eks. blur) på rutenettet som inneholder bokser med
  backdrop-filter — gjør boksene svarte i Chrome. Dim med mørkt overlegg i stedet.
- Orben skal være en arc reactor (ringer, spirograf-rose, 4 glød-noder), IKKE
  en klode. Hold den samlet i midtfeltet. Tidlig-avbrudd i shaderen utenfor
  disken; cap devicePixelRatio.
- Manuset bygges KUN av tilgjengelige seksjoner — aldri påstå tall som mangler.

## Design

Bakgrunn #0f0f0f, oransje #fa6b06, cyan #0090c9, font Onest (Google Fonts).
Hvit NORSE-logo øverst i midten (kun "Norse").

## Triggere

Cmd/Ctrl+J → mikrofon → "Hey Jarvis, wake up daddy's home" (Web Speech API),
pluss synlig "Run brief"-knapp nederst som kjører briefen direkte.

## Arbeidsflyt med eieren

Eieren kjører prosjektet lokalt på Windows. Endringer gjort i sky-økter pushes
til GitHub (`fintveridag-lgtm/jarvis`); eieren henter dem med `git pull` og
restarter serveren. Forklar alltid disse to stegene når du har pushet noe.
