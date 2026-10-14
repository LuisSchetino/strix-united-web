@echo off
title Strix FC27 - Publicar o site
cd /d "%~dp0"
rem Baixa o que esta no GitHub, testa e publica no Cloudflare. Se algum teste falhar, nada e publicado.
echo == 1/5 Baixando a versao nova do GitHub
git checkout main || goto fail
git pull origin main || goto fail
echo == 2/5 Instalando
call pnpm install || goto fail
echo == 3/5 Testando
call pnpm check || goto fail
call pnpm test || goto fail
echo == 4/5 Montando o site
call pnpm build || goto fail
echo == 5/5 Publicando
call npx wrangler pages deploy dist --project-name=strix-united-fc27 --branch=main --commit-dirty=true || goto fail
echo == Reiniciando o vigia Em campo
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\ao-vivo\reiniciar-vigia.ps1"
echo.
echo PRONTO. Site publicado.
pause
exit /b 0
:fail
echo.
echo Parou: algo deu errado acima. Nada novo foi publicado.
pause
exit /b 1
