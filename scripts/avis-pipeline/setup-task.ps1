# Registrerer en daglig Windows-oppgave som fyller Dagsavisen med Ollama hver natt.
#
# Kjor EN gang i PowerShell (staaende i prosjektmappa):
#     .\scripts\avis-pipeline\setup-task.ps1
#
# Vil du ha et annet klokkeslett enn 02:00:
#     .\scripts\avis-pipeline\setup-task.ps1 -Time 03:30
#
# Blir skriptet blokkert av "execution policy", start det slik i stedet:
#     powershell -ExecutionPolicy Bypass -File .\scripts\avis-pipeline\setup-task.ps1

param(
    [string]$Time = '02:00',
    [string]$TaskName = 'Jarvis Dagsavis'
)

$script = Join-Path $PSScriptRoot 'avis-natt.ps1'
if (-not (Test-Path $script)) {
    Write-Error "Fant ikke $script - kjor fra prosjektmappa etter git pull."
    return
}

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`""

$trigger = New-ScheduledTaskTrigger -Daily -At $Time

# Vekk PC-en om den sover, kjor selv om den var av pa tidspunktet, ikke stopp pa batteri
$settings = New-ScheduledTaskSettingsSet -WakeToRun -StartWhenAvailable `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
    -Settings $settings -Description 'Fyller Dagsavisen med Ollama hver natt' -Force | Out-Null

Write-Host ""
Write-Host "OK. Oppgaven '$TaskName' er registrert og kjorer kl. $Time hver natt." -ForegroundColor Green
Write-Host "Ollama maa vaere i gang (den starter vanligvis med Windows)."
Write-Host ""
Write-Host "Test den med en gang (uten a vente til natten):"
Write-Host "    Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "Se logg:        Get-Content data\avis-natt.log -Tail 20"
Write-Host "Fjern oppgaven: Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"
