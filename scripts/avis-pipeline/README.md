# Dagsavisen — natt-pipeline (Ollama + valgfri Claude-polish)

Slik fylles avisen automatisk, uten sky og uten API-nøkler. Arbeidsdelingen:
**den lokale Ollama-modellen gjør grovjobben om natten (gratis, privat), og
Claude kan gjøre en valgfri finpuss om morgenen.**

```
  NATT (én kommando: npm run avis:natt)
  ┌───────────────┐  ┌────────────┐  ┌──────────────┐
  │ fetch.mjs     │→ │ digest.mjs │→ │ polish.mjs   │→  avis-data.json
  │ RSS → rå-JSON │  │ Ollama sile│  │ Claude-finpuss│     (ferdig avis)
  └───────────────┘  └────────────┘  └──────────────┘
                          │                  │
                          │                  └─ hopper over seg selv uten API-nøkkel
                          └─ ntfy-varsel til mobilen 📲
```

- `fetch.mjs` — henter råstoff fra kildene i `feeds.mjs` (Google News RSS) →
  `data/avis-raw.json`. Ingen AI, bare innsamling.
- `digest.mjs` — lar **Ollama** velge de beste sakene og merke hver
  (`fakta`/`forskning`/`debatt`/`spekulasjon`). Skriver den ferdige
  `data/avis-data.json`. Teksten er kilde-utdraget. **Modellen får aldri finne
  opp kilder** — URL, kilde og dato tas alltid uendret fra råstoffet.
- `polish.mjs` — **Claude** (modell `claude-opus-5`) skriver om utdragene til
  velskrevne norske ingresser. Beholder url/kilde/dato/tag uendret. Krever
  `ANTHROPIC_API_KEY` i `.env` — uten den hoppes trinnet pent over, og avisen
  står med Ollama-tekstene. Alle tre kjøres av `npm run avis:natt`.

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

## Claude-finpuss (valgfritt, men på som standard)

`polish.mjs` kjøres automatisk sist i `npm run avis:natt`. Vil du slå den på:

1. Hent en API-nøkkel på console.anthropic.com.
2. Legg den i `.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
   (Vil du ha lavere kostnad, sett `CLAUDE_MODEL=claude-haiku-4-5`.)

Uten nøkkel hopper trinnet pent over seg selv, og avisen står med de rene
Ollama-tekstene. Test den alene med `npm run avis:polish`.

## Feilsøking

- **«Ollama svarte … kjører den?»** → start Ollama (`ollama serve`, eller bare
  åpne Ollama-appen), og sjekk at `ollama list` viser modellen din.
- **En kilde gir 403 / hoppes over** → helt normalt, en enkelt død feed stopper
  ikke resten. Rediger `feeds.mjs` for å bytte kilder.
- **Tom avis** → kjørte `avis:fetch` uten treff? Sjekk internett og at
  søkeordene i `feeds.mjs` gir resultater.
