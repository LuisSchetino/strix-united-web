@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"

echo.
echo === STRIX - atualizar token Discord nos dois sites ===
echo FC 26 e FC 27 usarao o mesmo token novo do bot.
echo O token nao sera gravado em arquivo.
echo.
set /p "DISCORD_BOT_TOKEN=Cole o token novo do bot Discord: "
if "%DISCORD_BOT_TOKEN%"=="" goto missing

echo.
echo Atualizando FC 26...
echo %DISCORD_BOT_TOKEN%| npx.cmd wrangler pages secret put DISCORD_BOT_TOKEN --project-name=strix-united-team-os
if errorlevel 1 goto failed

echo Atualizando FC 27...
echo %DISCORD_BOT_TOKEN%| npx.cmd wrangler pages secret put DISCORD_BOT_TOKEN --project-name=strix-united-fc27
if errorlevel 1 goto failed

echo.
echo Pronto. O token novo foi salvo nos dois projetos do Cloudflare Pages.
echo Agora abra os sites e valide o login/acoes normalmente.
pause
exit /b 0

:missing
echo.
echo Nenhum token foi informado. Nada foi alterado.
pause
exit /b 1

:failed
echo.
echo Nao foi possivel atualizar um dos sites. Confira se o Wrangler esta autenticado.
echo Se o FC 26 foi atualizado antes do erro, rode este CMD novamente para concluir o FC 27.
pause
exit /b 1
