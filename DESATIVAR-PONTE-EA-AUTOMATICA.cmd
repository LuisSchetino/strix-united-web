@echo off
setlocal
title Strix FC27 - Desativar ponte automatica da EA
set "TARGET=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Strix-FC27-Ponte-EA.vbs"

del /Q "%TARGET%" >nul 2>nul
echo A inicializacao automatica foi removida do seu perfil do Windows.
echo A ponte ativa continua ate voce reiniciar o PC.
pause
