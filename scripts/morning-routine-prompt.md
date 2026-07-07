# Morgenrutine-prompt for Jarvis-dashbordet

Denne rutinen kjøres av en Claude-agent (med tilgang til Notion-, nyhets-/web-
og Gmail-verktøy — f.eks. via MCP-servere eller tilkoblede connectors) hver
morgen, typisk planlagt kl. 06:00. Den skriver **kun**
`data/claude-data.json` i prosjektroten. Node-serveren gjør ingen kall til
Notion/nyheter/Gmail selv — den leser bare denne filen og slår den sammen med
live Meta/Instagram/klient-data.

## Kjør denne prompten

```
Du er Jarvis sin morgenrutine. Gjør følgende og skriv resultatet til
data/claude-data.json i prosjektet (overskriv filen, behold eksakt skjema
under):

1. NOTION: Hent oppgaver fra "Today"-kolonnen på min Notion Home-side
   (NOTION_HOME_PAGE_ID i .env). List opp korte, konkrete oppgavetekster.

2. WORLD STAGE: Finn 3-5 store nyhetssaker fra i dag/siste 24 timer innen
   AI, finans og store verdenshendelser. For hver sak: finn en tilnærmet
   lengde-/breddegrad for hvor hendelsen fant sted (by/land-nivå er nok).
   Hent også ferske markedspriser: S&P 500, gull, sølv og Bitcoin, med
   prosentvis endring siste 24 timer / siste handelsdag.

3. GMAIL: Se gjennom innboksen og plukk ut de mest presserende, IKKE-spam
   e-postene (frister, direkte forespørsler, viktige kunder/leverandører).
   Maks 3-5 stykker. Ikke ta med nyhetsbrev, kvitteringer eller varsler.

Skriv til data/claude-data.json med NØYAKTIG dette skjemaet (bruk tomme
lister/null der det ikke finnes data — ikke dikt opp tall):

{
  "generatedAt": "<ISO-8601 tidsstempel, nå>",
  "notion": {
    "tasks": ["<oppgave 1>", "<oppgave 2>", "..."]
  },
  "worldStage": {
    "headlines": [
      { "title": "<kort overskrift>", "category": "AI|Finance|World", "lat": <number>, "lng": <number> }
    ],
    "markets": {
      "sp500": { "value": <number>, "changePercent": <number> },
      "gold": { "value": <number>, "changePercent": <number> },
      "silver": { "value": <number>, "changePercent": <number> },
      "bitcoin": { "value": <number>, "changePercent": <number> }
    }
  },
  "gmail": {
    "urgent": [
      { "from": "<navn/e-post>", "subject": "<emne>", "reason": "<hvorfor det haster, kort>" }
    ]
  }
}

Ikke inkluder felter du ikke fant ekte data for — dropp heller nøkkelen
(f.eks. la "tasks" være en tom liste hvis Notion-siden er tom) enn å gjette.
```

## Hvorfor dette designet

- Dashbordet (Node-serveren) vet ingenting om Notion/nyheter/Gmail-API-er.
  Det gjør det trivielt å bytte ut *hvordan* dataene hentes (annen agent,
  annet skedulerings-verktøy, manuelt skript) uten å røre serverkoden.
- Hvis `data/claude-data.json` mangler eller er gammel, viser de tre
  boksene (Notion, World Stage, Gmail) en pen "kjør morgenrutinen"-tilstand
  i stedet for å feile — se `claudeDataAvailable` i `/api/data`-responsen.
- Etter at rutinen har skrevet filen trenger du **ikke** restarte
  Node-serveren — `data/claude-data.json` leses på nytt for hvert
  `/api/data`- og `/api/brief`-kall.

## Planlegging

Sett opp en cron-jobb, launchd-jobb eller et scheduled trigger i ditt
agent-verktøy som kjører prompten over hver morgen før du kommer på jobb,
f.eks. kl. 06:00. En enkel `claude -p "<prompt over>"` fra en cron-jobb på
Mac-en fungerer fint, forutsatt at Claude-klienten har tilgang til
Notion-, nyhets- og Gmail-verktøyene.
