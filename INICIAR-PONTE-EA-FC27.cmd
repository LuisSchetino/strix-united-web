@echo off
title Strix FC27 - Ponte local da EA
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao foi encontrado neste computador.
  echo Instale o Node.js LTS e execute este arquivo novamente.
  pause
  exit /b 1
)
echo Iniciando ponte local da EA para o Strix FC27...
node tools\ea-local-bridge.mjs
pause
