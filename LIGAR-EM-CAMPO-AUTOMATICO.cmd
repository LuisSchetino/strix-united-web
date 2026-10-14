@echo off
title Strix FC27 - Em campo automatico
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\ao-vivo\vigia.ps1"
pause
