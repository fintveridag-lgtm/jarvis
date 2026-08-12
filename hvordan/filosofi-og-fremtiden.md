# Filosofi og fremtiden

> Tema-fil for Jarvis-avisen. Dette er kompasset for hva «Dagsavisen» skal
> lete etter og hvordan den skal presentere det. Merket: **filosofi**, **fremtiden**.

Dette er et levende dokument. Her står *hvorfor* avisen finnes, *hva* den
følger, og — like viktig — *hvordan* den skal skille mellom det vi vet, det
noen forsker på, og det folk bare diskuterer. Nysgjerrig, men ærlig.

## Hvorfor

En egen liten avis som hver dag samler det som faktisk beveger seg i temaene
eieren bryr seg om — helse, penger og makt, bioteknologi, arkeologi, AI og det
uforklarte — slik at man slipper å hoppe mellom ti kilder og ti algoritmer som
alle vil ha oppmerksomheten din. Ett rolig sted, mørkt og lesbart, på PC eller
telefon.

## Redaksjonelle prinsipper (viktig)

Flere av temaene her grenser mot spekulasjon (hva er under Giza, hvem «styrer»
pengene, UFO-er). Avisen skal ikke være en ekkokammer-maskin. Derfor:

- **Merk alt med hva det er:** `fakta` (etablert/bekreftet), `forskning`
  (fagfellevurdert eller pågående studie), `debatt` (diskusjon/mening) eller
  `spekulasjon` (påstand uten solid bevis). Fargekodet i avisen.
- **Alltid kilde.** Ingen sak uten en lenke eller navngitt kilde. Kan du ikke
  finne kilde, dropp saken heller enn å dikte.
- **Skill påstand fra bevis.** «X hevder» er ikke «X er sant». Si hvem som
  hevder hva.
- **Ingen medisinske råd.** Peptider som BPC-157 følges som *forskningsnytt* —
  aldri doser eller «slik bruker du det».
- **Ingen falske tall.** Mangler data, står det tomt, ikke gjettet.

## Temaene avisen følger

1. **Kosthold & Trening** — ny ernærings-/treningsforskning, protokoller, søvn,
   langlevelse.
2. **Børs & Pengemakt** — markeder (S&P, gull, sølv, Bitcoin) + hvem som
   flytter kapital i verden (store fond, forsvarskontraktører, sentralbanker).
3. **Genteknologi & Peptider** — CRISPR, genterapi, peptider som BPC-157
   (kun forskningsstatus).
4. **Arkeologi & Giza** — utgravinger og ny forskning ved Giza og andre store
   steder verden rundt (Göbekli Tepe, Saqqara, m.m.).
5. **AI & Fremtid** — nye modeller, gjennombrudd, hvor teknologien er på vei.
6. **UFO/UAP & Det uforklarte** — offisielle rapporter, høringer, seriøs
   forskning — tydelig merket når det er spekulasjon.
7. **Fra Rogan-sfæren** — hva de store lange podkastene diskuterer nå
   (ideer, gjester, debatter) — som inngang til temaer, ikke som fasit.

## Mulige utvidelser (idébank)

- Romfart & oppdagelse (SpaceX, teleskoper, funn)
- Energi (fusjon, kjernekraft, batteri)
- Bevissthet & psykedelika-forskning
- Frihet & personvern (kryptering, overvåking, digitale rettigheter)
- Historie som skrives om (nye dateringer, tapte sivilisasjoner)

## Slik henger det sammen teknisk

- Serveren henter **ingenting** selv. En planlagt Claude-rutine
  (`scripts/avis-routine-prompt.md`) leter fram dagens saker og skriver
  `data/avis-data.json`.
- Avis-siden (`public/avis.html`) leser `/api/avis` og viser sakene, filtrert
  på **I dag / Uken / Måneden**.
- Mangler filen, viser avisen en pen «kjør avis-rutinen»-forside — aldri feil.
