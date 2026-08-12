# Dagsavisen — natt-pipeline (Ollama + valgfri Claude-polish)

Slik fylles avisen automatisk, uten sky og uten API-nøkler. Arbeidsdelingen:
**den lokale Ollama-modellen gjør grovjobben om natten (gratis, privat), og
Claude kan gjøre en valgfri finpuss om morgenen.**

```
  NATT (f.eks. 02:00)                MORGEN (valgfritt, f.eks. 05:00)
  ┌───────────────┐  ┌────────────┐  ┌──────────────────┐
  │ fetch.mjs     │→ │ digest.mjs │→ │ claude -p (polish)│→  avis-data.json
  │ RSS → rå-JSON │  │ Ollama sile│  │  bedre reportasjer│      (ferdig avis)
  └───────────────┘  └────────────┘  └──────────────────┘
                          │
                          └─ ntfy-varsel til mobilen 📲
```

- `fetch.mjs` — henter råstoff fra kildene i `feeds.mjs` (Google News RSS) →
  `data/avis-raw.json`. Ingen AI, bare innsamling.
- `digest.mjs` — lar **Ollama** velge de beste sakene, skrive norske sammendrag
  og merke hver (`fakta`/`forskning`/`debatt`/`spekulasjon`). Skriver den
  ferdige `data/avis-data.json`. **Modellen får aldri finne opp kilder** — URL,
  kilde og dato tas alltid uendret fra råstoffet.
- Claude-morgentrinnet (valgfritt) — hever språket til ordentlige «reportasjer».
  Avisen virker helt fint uten det; det er bare kremen på toppen.

## Kom i gang (én gang)

```powershell
# I prosjektmappa:
npm install                 # henter rss-parser
ollama list                 # sjekk at du har en modell, f.eks. llama3.1
```

Vil du bruke en annen modell, sett den i `.env`:
```
OLLAMA_MODEL=llama3.1
```

## Kjør manuelt (test)

```powershell
npm run avis:natt           # = fetch + digest i ett
# eller hver for seg:
npm run avis:fetch
npm run avis:digest
```

Åpne så `http://localhost:3000/avis.html` (start serveren med `npm start` hvis
den ikke kjører). Du trenger **ikke** restarte serveren etter en oppdatering —
`/api/avis` leser fila ferskt.

## ntfy-varsel når avisen er klar (valgfritt)

1. Installer **ntfy**-appen på telefonen (gratis, ntfy.sh).
2. Abonner på et hemmelig emne-navn, f.eks. `jarvis-avis-1a2b3c`.
3. Sett samme navn i `.env`:
   ```
   NTFY_TOPIC=jarvis-avis-1a2b3c
   ```
Da får du en push når `digest.mjs` er ferdig.

## Kjør automatisk hver natt (Windows Oppgaveplanlegger)

Kjør denne **én gang** i PowerShell (bytt ut stien til prosjektmappa di):

```powershell
$proj = "C:\Sti\til\jarvis"
schtasks /Create /TN "Jarvis Dagsavis" /SC DAILY /ST 02:00 /F `
  /TR "cmd /c cd /d `"$proj`" && npm run avis:natt"
```

Det lager en jobb som kjører kl. 02:00 hver natt. (PC-en må være på — sett
gjerne på «vekk maskinen» i oppgavens egenskaper hvis du vil.) Node og npm må
være i PATH — de er det hvis du kan kjøre `npm start` fra vanlig PowerShell.

Vil du endre tid eller slette jobben:
```powershell
schtasks /Change /TN "Jarvis Dagsavis" /ST 03:30
schtasks /Delete /TN "Jarvis Dagsavis" /F
```

## Valgfritt: Claude-finpuss kl. 05:00

Vil du at Claude skal heve sakene til ordentlige reportasjer, lag en jobb til
som kjører `claude -p` med prompten i `../avis-routine-prompt.md` (den leser
`data/avis-data.json` og forbedrer teksten). Se den fila for detaljer. Dette
krever at Claude-klienten er installert og innlogget på PC-en.

## Feilsøking

- **«Ollama svarte … kjører den?»** → start Ollama (`ollama serve`, eller bare
  åpne Ollama-appen), og sjekk at `ollama list` viser modellen din.
- **En kilde gir 403 / hoppes over** → helt normalt, en enkelt død feed stopper
  ikke resten. Rediger `feeds.mjs` for å bytte kilder.
- **Tom avis** → kjørte `avis:fetch` uten treff? Sjekk internett og at
  søkeordene i `feeds.mjs` gir resultater.
