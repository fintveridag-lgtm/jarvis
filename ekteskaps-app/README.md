# Ekteskaps-appen 🌳

En rolig, japansk-inspirert skrivebordsapp for par. **Alt lagres kun på din egen
maskin** — ingen sky, ingen innlogging, ingen sporing.

Se `PLAN.md` for hele idégrunnlaget (bekymringstreet, Sofies verden, psykologi,
familiekalender osv.). Dette er **MVP-en (Fase 1)**.

## Hva som er med nå
- 🌳 **Bekymringstreet** — heng fra deg dagens bekymringer før du «går inn i huset»
- 🕯️ **Vår tid** — teller dagene dere har vært gift / sammen, med milepæler
- 📖 **Rubrikker** — sju korte kapitler om hvordan holde seg gift
- 🍵 **Ukens samtale** — trekk et samtalekort og sett en fast ukedag

## Slik kjører du den

### Enkleste måte (ingen installasjon)
Åpne mappen `renderer` og **dobbeltklikk på `index.html`**. Appen åpner seg i
nettleseren din og virker med én gang. (Data lagres i den nettleseren.)

### Som ekte skrivebordsapp (Electron)
I PowerShell, stå i denne mappen:
```powershell
cd $HOME\jarvis\ekteskaps-app
npm install     # laster ned Electron, tar et par minutter foerste gang
npm start       # aapner appen i eget vindu
```

## Merk
- Dette er et tidlig utkast — vi bygger videre i faser (se `PLAN.md`).
- Appen er et **støtteverktøy, ikke en terapeut**. Ved vold, rus eller vedvarende
  vansker: kontakt familievernkontoret (gratis i Norge) eller fastlege.
