# Vigia "Em campo" do Strix FC27.
#
# Roda no PC de quem joga. A cada poucos segundos tira um print da faixa de cima da tela (onde o
# FC mostra o placar), le o texto com o OCR que ja vem no Windows e, quando aparece um placar com
# relogio, manda esse texto para o site. O site descobre o jogo da Agenda e marca "Em campo" com
# placar e minuto. Nao le memoria nem rede do jogo: so a imagem da tela, como o OBS.
#
# Uso:
#   LIGAR-EM-CAMPO-AUTOMATICO.cmd        (fica vigiando)
#   TESTAR-EM-CAMPO.cmd                  (um print + texto lido, para calibrar)
#
# Configuracao em tools\ao-vivo\ao-vivo.config.json (copie de ao-vivo.config.example.json).

param(
  [switch]$Teste
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$configPath = Join-Path $here "ao-vivo.config.json"
if (-not (Test-Path $configPath)) {
  Write-Host "Falta o arquivo de configuracao: $configPath" -ForegroundColor Red
  Write-Host "Copie ao-vivo.config.example.json para ao-vivo.config.json e preencha a senha (Secret)."
  exit 1
}
$config = Get-Content $configPath -Raw | ConvertFrom-Json
$site = ([string]$config.SiteUrl).TrimEnd("/")
$secret = [string]$config.Secret
$interval = [Math]::Max(2, [int]($config.IntervalSeconds))
$sendEvery = [Math]::Max(5, [int]($config.SendEverySeconds))
$regionTop = [double]($config.RegionTop)
$regionHeight = [double]($config.RegionHeight)
$regionLeft = [double]($config.RegionLeft)
$regionWidth = [double]($config.RegionWidth)
if ($regionHeight -le 0) { $regionHeight = 0.2 }
if ($regionWidth -le 0) { $regionWidth = 1.0 }

# Telas com escala (125%, 150%): sem isso o print sai cortado.
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class StrixDpi { [DllImport("user32.dll")] public static extern bool SetProcessDPIAware(); }
"@
[void][StrixDpi]::SetProcessDPIAware()

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Storage.FileAccessMode, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrResult, Windows.Foundation, ContentType = WindowsRuntime]

$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq "AsTask" -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq "IAsyncOperation``1"
})[0]
function Await($operation, [Type]$resultType) {
  $task = $asTask.MakeGenericMethod($resultType).Invoke($null, @($operation))
  [void]$task.Wait(-1)
  $task.Result
}

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if ($null -eq $engine) {
  Write-Host "O Windows nao tem leitor de texto (OCR) para o idioma do sistema." -ForegroundColor Red
  Write-Host "Instale em Configuracoes > Hora e idioma > Idioma > Portugues (Brasil) > Opcoes > Reconhecimento optico."
  exit 1
}

$tempPng = Join-Path $env:TEMP "strix-ao-vivo.png"

function Capture-Region {
  $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $x = [int]($screen.X + $screen.Width * $regionLeft)
  $y = [int]($screen.Y + $screen.Height * $regionTop)
  $w = [int]($screen.Width * $regionWidth)
  $h = [int]($screen.Height * $regionHeight)
  $shot = New-Object System.Drawing.Bitmap $w, $h
  $graphics = [System.Drawing.Graphics]::FromImage($shot)
  $graphics.CopyFromScreen($x, $y, 0, 0, $shot.Size)
  $graphics.Dispose()
  # letras do placar sao pequenas: dobrar o tamanho ajuda o OCR
  $big = New-Object System.Drawing.Bitmap ($w * 2), ($h * 2)
  $scale = [System.Drawing.Graphics]::FromImage($big)
  $scale.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $scale.DrawImage($shot, 0, 0, $w * 2, $h * 2)
  $scale.Dispose()
  $shot.Dispose()
  $big.Save($tempPng, [System.Drawing.Imaging.ImageFormat]::Png)
  $big.Dispose()
}

function Read-Text {
  $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($tempPng)) ([Windows.Storage.StorageFile])
  $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  try {
    $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
    ($result.Lines | ForEach-Object { $_.Text }) -join "`n"
  } finally {
    $stream.Dispose()
  }
}

function Send-Text([string]$text) {
  $body = @{ text = $text } | ConvertTo-Json -Compress
  $headers = @{ Authorization = "Bearer $secret" }
  Invoke-RestMethod -Method Post -Uri "$site/api/internal/live-signal" -Headers $headers -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 15
}

# relogio de partida (34:12) no texto lido: so entao vale mandar para o site
$clockPattern = "(?<![0-9])[0-9]{1,3}[:.][0-9]{2}(?![0-9])"

if ($Teste) {
  Capture-Region
  $text = Read-Text
  $folder = Join-Path ([Environment]::GetFolderPath("MyDocuments")) "STRIX-ao-vivo-teste"
  New-Item -ItemType Directory -Force -Path $folder | Out-Null
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  Copy-Item $tempPng (Join-Path $folder "print-$stamp.png")
  Set-Content -Path (Join-Path $folder "texto-$stamp.txt") -Value $text -Encoding UTF8
  Write-Host "Texto lido da tela:" -ForegroundColor Cyan
  Write-Host $text
  Write-Host ""
  Write-Host "Print e texto salvos em $folder" -ForegroundColor Green
  if ($text -match $clockPattern) {
    try {
      $answer = Send-Text $text
      Write-Host ("Resposta do site: " + ($answer | ConvertTo-Json -Compress)) -ForegroundColor Green
    } catch {
      Write-Host ("Nao foi possivel falar com o site: " + $_.Exception.Message) -ForegroundColor Yellow
    }
  } else {
    Write-Host "Nenhum relogio de partida no texto (normal fora de jogo)." -ForegroundColor Yellow
  }
  exit 0
}

Write-Host "Vigia Em campo ligado. Deixe o FC em TELA CHEIA SEM BORDAS. Ctrl+C para parar." -ForegroundColor Green
$lastSent = [DateTime]::MinValue
$lastText = ""
while ($true) {
  try {
    Capture-Region
    $text = Read-Text
    if ($text -match $clockPattern) {
      $changed = $text -ne $lastText
      $elapsed = ((Get-Date) - $lastSent).TotalSeconds
      # placar mudou (ou o relogio andou): manda; parado no intervalo: um aviso por minuto
      if (($changed -and $elapsed -ge $sendEvery) -or $elapsed -ge 60) {
        $answer = Send-Text $text
        $lastSent = Get-Date
        $lastText = $text
        if ($answer.status -eq "live") {
          Write-Host ("{0}  Em campo vs {1}  {2}x{3}  {4}'" -f (Get-Date -Format "HH:mm:ss"), $answer.opponent, $answer.strix, $answer.opponent_score, $answer.minute)
        } else {
          Write-Host ("{0}  Placar lido, mas sem jogo na Agenda agora ({1})" -f (Get-Date -Format "HH:mm:ss"), $answer.status)
        }
      }
    }
  } catch {
    Write-Host ("{0}  Erro: {1}" -f (Get-Date -Format "HH:mm:ss"), $_.Exception.Message) -ForegroundColor Yellow
  }
  Start-Sleep -Seconds $interval
}
