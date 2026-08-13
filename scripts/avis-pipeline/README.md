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

## Kjør automatisk hver natt (ett skript, én gang)

Kjør dette **én gang** i PowerShell, stående i prosjektmappa:

```powershell
.\scripts\avis-pipeline\setup-task.ps1
```

Det registrerer en Windows-oppgave som kjører kl. 02:00 hver natt (den vekker
til og med PC-en om den sover). Vil du ha et annet tidspunkt:

```powershell
.\scripts\avis-pipeline\setup-task.ps1 -Time 03:30
```

Blir skriptet blokkert av «execution policy», start det slik i stedet:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\avis-pipeline\setup-task.ps1
```

Nyttige kommandoer etterpå:
```powershell
Start-ScheduledTask -TaskName 'Jarvis Dagsavis'          # test nå, uten å vente til natten
Get-Content data\avis-natt.log -Tail 20                  # se hva som skjedde
Unregister-ScheduledTask -TaskName 'Jarvis Dagsavis' -Confirm:$false   # fjern oppgaven
```

**Viktig:** Ollama må kjøre når oppgaven starter (den starter vanligvis med
Windows og ligger i systemkurven). PC-en må være på eller i dvale (ikke helt
avslått), siden alt kjører lokalt hos deg.

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
