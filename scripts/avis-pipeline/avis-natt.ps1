# Kjorer natt-pipelinen for Dagsavisen (fetch + Ollama-digest) og logger til
# data/avis-natt.log. Dette er skriptet den planlagte oppgaven starter hver natt.
# Du kan ogsa kjore det manuelt for a teste:  .\scripts\avis-pipeline\avis-natt.ps1

$ErrorActionPreference = 'Stop'

# Prosjektroten = to mapper opp fra dette skriptet (scripts\avis-pipeline\ -> rot)
$proj = (Get-Item $PSScriptRoot).Parent.Parent.FullName
Set-Location $proj

$log = Join-Path $proj 'data\avis-natt.log'
"[$(Get-Date -Format s)] Starter avis:natt i $proj" | Out-File -Append -Encoding utf8 $log

try {
    # npm er npm.cmd pa Windows; kjor via cmd sa PATH stemmer i planlagt oppgave
    cmd /c "npm run avis:natt" *>> $log
    "[$(Get-Date -Format s)] Ferdig OK" | Out-File -Append -Encoding utf8 $log
}
catch {
    "[$(Get-Date -Format s)] FEIL: $($_.Exception.Message)" | Out-File -Append -Encoding utf8 $log
    throw
}
