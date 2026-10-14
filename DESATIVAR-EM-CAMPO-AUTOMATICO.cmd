@echo off
setlocal
title Strix FC27 - Desativar Em campo automatico
del /Q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Strix-FC27-Em-Campo.vbs" >nul 2>nul
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | Where-Object { $_.CommandLine -like '*ao-vivo*vigia.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
echo O vigia Em campo foi desligado e nao inicia mais com o Windows.
pause
