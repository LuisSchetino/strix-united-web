@echo off
title Strix FC27 - Configurar Em campo automatico
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\ao-vivo\configurar.ps1"
pause
