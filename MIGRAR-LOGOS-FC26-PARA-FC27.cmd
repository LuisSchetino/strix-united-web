@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\MIGRAR-LOGOS-FC26-PARA-FC27.ps1"
set "EXITCODE=%ERRORLEVEL%"
echo.
if not "%EXITCODE%"=="0" echo A migracao terminou com pendencias. Nenhuma chave foi salva.
pause
exit /b %EXITCODE%
