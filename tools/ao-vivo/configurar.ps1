# Configura o "Em campo" automatico de uma vez, sem perguntas:
#   1. cria a senha do vigia (ou reaproveita a que ja existe no ao-vivo.config.json);
#   2. cadastra a senha no Cloudflare (FC27_LIVE_SECRET do projeto strix-united-fc27);
#   3. publica o site para a senha valer;
#   4. registra o vigia para iniciar escondido com o Windows e ja liga.
# Rode pelo CONFIGURAR-EM-CAMPO.cmd na pasta do projeto.

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-Path (Join-Path $here "..\..")
Set-Location $root
$project = "strix-united-fc27"

function Step([string]$message) { Write-Host ""; Write-Host "== $message" -ForegroundColor Cyan }
function Fail([string]$message) { Write-Host $message -ForegroundColor Red; exit 1 }

# 1. senha
Step "1/4 Senha do vigia"
$configPath = Join-Path $here "ao-vivo.config.json"
$examplePath = Join-Path $here "ao-vivo.config.example.json"
$config = if (Test-Path $configPath) { Get-Content $configPath -Raw | ConvertFrom-Json } else { Get-Content $examplePath -Raw | ConvertFrom-Json }
if (-not $config.Secret -or $config.Secret -like "COLE_AQUI*") {
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $config.Secret = [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
  Write-Host "Senha nova criada."
} else {
  Write-Host "Usando a senha que ja estava no ao-vivo.config.json."
}
if (-not $config.PSObject.Properties["GameProcesses"]) {
  $config | Add-Member -NotePropertyName GameProcesses -NotePropertyValue @("FC27", "FC27_Trial", "FC 27")
}
$config | ConvertTo-Json | Set-Content -Path $configPath -Encoding UTF8
Write-Host "Configuracao salva em tools\ao-vivo\ao-vivo.config.json (esse arquivo nao vai para o GitHub)."

# 2. Cloudflare
Step "2/4 Cadastrando a senha no Cloudflare"
$config.Secret | npx wrangler pages secret put FC27_LIVE_SECRET --project-name=$project
if ($LASTEXITCODE -ne 0) { Fail "Nao deu para cadastrar a senha. Rode 'npx wrangler login' e depois este arquivo de novo." }

# 3. publicar
Step "3/4 Publicando o site"
pnpm install
if ($LASTEXITCODE -ne 0) { Fail "pnpm install falhou." }
pnpm build
if ($LASTEXITCODE -ne 0) { Fail "O build falhou. Nada foi publicado." }
npx wrangler pages deploy dist --project-name=$project --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { Fail "O deploy falhou." }

# 4. inicializacao com o Windows
Step "4/4 Ligando o vigia com o Windows"
$startup = [Environment]::GetFolderPath("Startup")
$target = Join-Path $startup "Strix-FC27-Em-Campo.vbs"
$script = Join-Path $here "vigia.ps1"
$line = 'CreateObject("WScript.Shell").Run "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""' + $script + '"" -Automatico", 0, False'
Set-Content -Path $target -Value $line -Encoding ASCII
Start-Process wscript.exe -ArgumentList "`"$target`""

Write-Host ""
Write-Host "PRONTO." -ForegroundColor Green
Write-Host "O vigia inicia escondido com o Windows, liga sozinho quando o FC 27 abre e para quando fecha."
Write-Host "Registro: $env:LOCALAPPDATA\StrixFC27\em-campo.log"
Write-Host "Para desligar de vez: DESATIVAR-EM-CAMPO-AUTOMATICO.cmd"
