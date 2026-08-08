@echo off
setlocal
cd /d "%~dp0"
echo.
echo === STRIX FC 27 - configurar Pages e Supabase ===
echo Este CMD nao altera o site FC 26.
echo A migration do Supabase precisa estar aplicada antes.
echo.
set /p DISCORD_GUILD_ID=ID do servidor Discord: 
set /p DISCORD_BOT_TOKEN=Token do bot Discord: 
set /p DISCORD_ROLE_TIER_MAP=Mapa JSON de cargos Discord (ex: {"123":"player","456":"diretoria"}): 
if "%DISCORD_GUILD_ID%"=="" goto missing
if "%DISCORD_BOT_TOKEN%"=="" goto missing
if "%DISCORD_ROLE_TIER_MAP%"=="" goto missing

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $ref='torfjbilfiquealvjwvb'; $project='strix-united-fc27'; $raw=& npx.cmd supabase projects api-keys --project-ref $ref --output json 2>$null; $keys=($raw -join [Environment]::NewLine)|ConvertFrom-Json; $public=$keys|Where-Object { $_.type -eq 'publishable' }|Select-Object -First 1; if(!$public){$public=$keys|Where-Object { $_.name -eq 'anon' }|Select-Object -First 1}; $server=$keys|Where-Object { $_.type -eq 'secret' }|Select-Object -First 1; if(!$server){$server=$keys|Where-Object { $_.name -eq 'service_role' }|Select-Object -First 1}; if(!$public){throw 'Chave publica do Supabase nao encontrada.'}; if(!$server){throw 'Chave de servidor do Supabase nao encontrada.'}; 'https://'+$ref+'.supabase.co' | npx.cmd wrangler pages secret put SUPABASE_URL --project-name=$project; $public.api_key | npx.cmd wrangler pages secret put SUPABASE_PUBLISHABLE_KEY --project-name=$project; $server.api_key | npx.cmd wrangler pages secret put SUPABASE_SERVICE_ROLE_KEY --project-name=$project"
if errorlevel 1 goto failed

echo %DISCORD_GUILD_ID%| npx.cmd wrangler pages secret put DISCORD_GUILD_ID --project-name=strix-united-fc27
echo %DISCORD_BOT_TOKEN%| npx.cmd wrangler pages secret put DISCORD_BOT_TOKEN --project-name=strix-united-fc27
echo %DISCORD_ROLE_TIER_MAP%| npx.cmd wrangler pages secret put DISCORD_ROLE_TIER_MAP --project-name=strix-united-fc27
if errorlevel 1 goto failed

echo.
echo Configuracao salva no Cloudflare Pages. Nenhum token foi escrito em arquivo.
echo Agora publique uma nova build do FC 27.
pause
exit /b 0

:missing
echo.
echo Faltou preencher uma informacao. Nada foi configurado.
pause
exit /b 1

:failed
echo.
echo Nao foi possivel concluir. Confira se o Supabase CLI e o Wrangler estao autenticados.
pause
exit /b 1
