# Jarvis — lokalt kommandosenter-dashbord

Fullskjerms, mørkt dashbord som kjører lokalt via Node/Express. En 3D
"arc reactor"-orb i midten reagerer på en ElevenLabs-stemme som leser opp en
morgenbrief, mens 6 databokser rundt utvider seg til nær-fullskjerm i takt
med setningen som leses.

## Oppsett

```bash
npm install
cp .env.example .env   # fyll inn nøklene dine (se under)
npm start
```

Åpne `http://localhost:3000`.

### Nøkler i `.env`

| Variabel | Brukes til |
|---|---|
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | Stemme-brief (`/v1/text-to-speech/{voice_id}/with-timestamps`) |
| `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID` | Meta-annonser-boksen (din konto) |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | Instagram-boksen (bruker samme `META_ACCESS_TOKEN`) |
| `CLIENT_A_AD_ACCOUNT_ID`, `CLIENT_B_AD_ACCOUNT_ID` (+ `_NAME`) | Klient-ytelse-boksen — **antagelse**: dette er egne Meta-annonsekontoer for hver klient, målt måned-hittil. Bytt til en annen datakilde i `lib/client-performance.js` hvis klientene dine måles annerledes. |
| `NOTION_API_KEY`, `NOTION_HOME_PAGE_ID` | Brukes **kun** av morgenrutinen (se under), ikke av serveren direkte |

Uten en nøkkel viser boksen en ren "ikke konfigurert"-tilstand i stedet for
å feile.

## Arkitektur

```
server.js              Express-server, /api/data og /api/brief
lib/
  meta-ads.js           Meta-annonser, siste 7 dager, optimization_goal-bevisst
  instagram.js           Instagram Insights (+ fallback ved manglende scope)
  client-performance.js  Klient A/B, måned-hittil, daglig ROAS for kurven
  claude-data.js          Leser data/claude-data.json (Notion/nyheter/Gmail)
  data-aggregate.js       Slår sammen alt til én payload, 60s cache på live-kall
  brief-script.js         Bygger stemme-manus KUN av seksjoner med ekte data
  cues.js                  Regner ms-cues fra ElevenLabs' tegn-tidslinje
  elevenlabs.js            TTS-kall + lagrer mp3 i public/audio/
public/
  index.html, css/style.css   Layout: 6 bokser rundt orben, delt overlay-panel
  js/orb.js                    WebGL2 arc-reactor-shader
  js/audio-analyser.js          Web Audio AnalyserNode → RMS/bass/treble
  js/overlay.js                 Delt overlay + opSeq-generasjonstoken
  js/speech.js                  Cmd+J wake word, Cmd+Shift+J hotkey-fallback
  js/app.js                     Rendering av bokser + master rAF-løkke
data/claude-data.example.json  Skjema/eksempel for morgenrutinens output
scripts/morning-routine-prompt.md  Prompten som fyller data/claude-data.json
```

### De 6 boksene

1. **Instagram** — siste 7 dager, `/{ig-user-id}/insights`. Fallback til
   følgere + antall innlegg hvis scope `instagram_manage_insights` mangler.
2. **Meta-annonser** — din konto, siste 7 dager. Leser hver ad-set sin
   `optimization_goal` og velger riktig resultatmetrikk (thruplays, klikk,
   leads eller engasjement) — aldri generiske link-klikk for
   engasjement-kampanjer.
3. **Klient-ytelse** — måned-hittil for Klient A/B, myk Catmull-Rom-kurve.
   **Leses aldri opp i stemme-briefen**, kun vist visuelt.
4. **Notion "I dag"** — fra `data/claude-data.json` (morgenrutinen).
5. **World Stage** — nyheter + markedspriser + verdenskart med glødende
   prikker (equirectangular). Fra `data/claude-data.json`.
6. **Gmail-hastesaker** — fra `data/claude-data.json`.

### Stemme + koreografi

`POST /api/brief` henter fersk data, bygger et manus (ekskluderer boks 3),
sender det til ElevenLabs `with-timestamps`, lagrer mp3 og regner ut
ms-cues per boks fra tegn-tidslinjen. Frontend spiller av lyden, leser
`audio.currentTime` i en `requestAnimationFrame`-løkke, og utvider/krymper
riktig boks i takt med aktiv cue.

**Kritisk bugfiks (svart popup):** Ett delt `#overlayPanel` gjenbrukes for
alle bokser. Kollaps rydder opp (`innerHTML = ''`) etter en forsinkelse som
matcher CSS-transisjonen. Denne oppryddingen er beskyttet av et
generasjonstoken (`opSeq` i `public/js/overlay.js`) — hvis en ny
expand/collapse skjer før forsinkelsen er ute, sjekkes token og den gamle
oppryddingen hoppes over, slik at den ikke visker ut nylig vist innhold.

**Kritisk (Chrome-bug):** `.grid` (rutenettet med boksene) har **ingen**
`filter: blur()`. Bokser bruker `backdrop-filter` individuelt; bakgrunnen
dimmes med en separat `#dimmer`-div, ikke en filter på en forelder-container.

### Trigger

- **Cmd+J**: aktiverer mikrofonen (Web Speech API), lytter etter frasen
  "Hey Jarvis, wake up daddy's home" (matcher løst på "wake up").
- **Cmd+Shift+J**: ren hotkey-fallback, kjører briefen direkte uten stemme.
- **"Run brief"-knapp**: samme direkte trigger, nederst på skjermen.

## Viktig: server-restart

Node cacher importerte moduler. Etter **enhver** endring i `server.js` eller
`lib/*.js` må serveren restartes (`npm start` på nytt, eller bruk
`npm run dev` som kjører med `node --watch`) for at `/api/brief` skal bruke
ny kode. Frontend-filer i `public/` serveres ferske ved hver sideinnlasting —
ingen restart nødvendig der.

## Morgenrutine

Se `scripts/morning-routine-prompt.md` for prompten som henter Notion,
nyheter/markeder og Gmail, og skriver `data/claude-data.json`. Sett den opp
som en planlagt jobb (cron/launchd/agent-trigger) hver morgen. Dashbordet
fungerer fullt ut selv om denne aldri har kjørt — de tre boksene viser da en
"kjør morgenrutinen"-tilstand.

## Logo

`public/assets/norse-logo.svg` er en plassholder (hvit "NORSE"-tekst i
Onest). Bytt ut filen med din egen hvite Norse-logo — behold filnavnet så
slipper du å røre `index.html`.

## Verifisering

Se commit-historikk / sesjonsnotat for verifiseringssteget som ble kjørt:
`npm install`, serverstart, `curl /api/health` og `/api/data` (graceful
"ikke konfigurert"-tilstander uten nøkler), samt en headless
nettleser-sjekk av at siden laster uten konsollfeil, at orben tegner, og at
DOM-strukturen med 6 bokser + overlay er på plass. Full ende-til-ende med
ekte stemme krever dine egne API-nøkler i `.env` — sett dem inn og trykk
"Run brief" for å høre briefen og se boksene utvide seg.
