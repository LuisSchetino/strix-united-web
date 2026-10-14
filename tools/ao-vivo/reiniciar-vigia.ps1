# Reinicia o vigia "Em campo" para ele rodar a versao nova (chamado pelo PUBLICAR-SITE.cmd).
# So mexe se o vigia automatico estiver ativado (atalho na inicializacao do Windows).
$startup = Join-Path ([Environment]::GetFolderPath("Startup")) "Strix-FC27-Em-Campo.vbs"
if (-not (Test-Path $startup)) { Write-Host "Vigia automatico nao esta ativado: nada a reiniciar."; exit 0 }
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
  Where-Object { $_.CommandLine -like "*vigia.ps1*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 1
Start-Process wscript.exe -ArgumentList "`"$startup`""
Write-Host "Vigia Em campo reiniciado com a versao nova."
