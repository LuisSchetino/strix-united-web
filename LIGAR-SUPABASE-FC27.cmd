@echo off
setlocal
cd /d "%~dp0"
title Strix FC 27 - ligar Supabase

echo.
echo Conectando somente o Supabase separado do FC 27...
echo Quando o Supabase pedir, digite a senha do banco do projeto FC 27.
echo A senha nao fica gravada neste arquivo.
echo.

call npx.cmd supabase link --project-ref torfjbilfiquealvjwvb
if errorlevel 1 goto :erro

call npx.cmd supabase db push --linked
if errorlevel 1 goto :erro

echo.
echo Tudo certo. As migrations do FC 27, incluindo Agenda, catalogo e vinculos do elenco, foram aplicadas.
pause
exit /b 0

:erro
echo.
echo Nao foi possivel concluir. Nenhuma alteracao foi feita no site FC 26.
pause
exit /b 1
