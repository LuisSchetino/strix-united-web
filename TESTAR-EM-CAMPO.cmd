@echo off
title Strix FC27 - Teste do Em campo
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\ao-vivo\vigia.ps1" -Teste
pause
