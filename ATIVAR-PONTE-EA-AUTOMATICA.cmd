@echo off
setlocal
title Strix FC27 - Ativar ponte automatica da EA
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SOURCE=%~dp0PONTE-EA-FC27-AUTO.vbs"
set "TARGET=%STARTUP%\Strix-FC27-Ponte-EA.vbs"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao foi encontrado neste computador.
  echo Instale o Node.js LTS e execute este arquivo novamente.
  pause
  exit /b 1
)

copy /Y "%SOURCE%" "%TARGET%" >nul
if errorlevel 1 (
  echo Nao foi possivel registrar a inicializacao automatica no seu perfil do Windows.
  pause
  exit /b 1
)

start "" /b wscript.exe "%SOURCE%"
echo Pronto. A ponte da EA agora inicia escondida ao entrar no Windows e ja foi iniciada.
echo No FC27, use o botao BUSCAR PELO MEU PC normalmente.
pause
