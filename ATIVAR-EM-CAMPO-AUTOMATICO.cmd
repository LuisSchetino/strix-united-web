@echo off
setlocal
title Strix FC27 - Ativar Em campo automatico
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "TARGET=%STARTUP%\Strix-FC27-Em-Campo.vbs"
set "SCRIPT=%~dp0tools\ao-vivo\vigia.ps1"

if not exist "%~dp0tools\ao-vivo\ao-vivo.config.json" (
  echo Falta o arquivo tools\ao-vivo\ao-vivo.config.json com a senha.
  echo Copie ao-vivo.config.example.json para ao-vivo.config.json e preencha o Secret.
  pause
  exit /b 1
)

> "%TARGET%" echo CreateObject("WScript.Shell").Run "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""%SCRIPT%"" -Automatico", 0, False
if errorlevel 1 (
  echo Nao foi possivel registrar a inicializacao automatica no seu perfil do Windows.
  pause
  exit /b 1
)

start "" wscript.exe "%TARGET%"
echo Pronto. O vigia Em campo agora inicia escondido com o Windows e ja foi ligado.
echo Ele so le o placar enquanto o FC 27 estiver aberto e para quando o jogo fecha.
echo Registro do que ele fez: %LOCALAPPDATA%\StrixFC27\em-campo.log
pause
