$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = "C:\Users\ObeeN\Documents\STRIX UNITED FC27"
$outDir = Join-Path $root "qa\cutout-real-v2"
$framesPath = Join-Path $outDir "frames.json"
if (-not (Test-Path $framesPath)) { throw "frames.json missing. Run tools/qa-cutout-real-v2.mjs first." }
$frames = Get-Content $framesPath -Raw | ConvertFrom-Json
$byFile = @{}
foreach ($item in $frames) { $byFile[$item.file] = $item }

$public = Join-Path $root "public"
$paperPath = Join-Path $root "src\assets\collage\paper\noise-paper-1.jpg"
$portrait = Join-Path $public "brand\strix\portrait-nunes.png"
$cutFill = Join-Path $root "src\assets\collage\paper\cut-fill.jpg"

function Load-Bitmap([string]$path) {
  if (-not (Test-Path $path)) { return $null }
  return [System.Drawing.Bitmap]::FromFile($path)
}

function Cover([System.Drawing.Graphics]$g, $img, [int]$x, [int]$y, [int]$w, [int]$h) {
  if ($null -eq $img) { return }
  $scale = [Math]::Max($w / [double]$img.Width, $h / [double]$img.Height)
  $dw = [int]($img.Width * $scale)
  $dh = [int]($img.Height * $scale)
  $g.DrawImage($img, $x + [int](($w - $dw) / 2), $y + [int](($h - $dh) / 2), $dw, $dh)
}

$paper = Load-Bitmap $paperPath
$face = Load-Bitmap $portrait
$fill = Load-Bitmap $cutFill
$letterCache = @{}

function Get-Letter([string]$rel) {
  $path = Join-Path $public ($rel.TrimStart("/").Replace("/", "\"))
  if ($letterCache.ContainsKey($path)) { return $letterCache[$path] }
  $bmp = Load-Bitmap $path
  $letterCache[$path] = $bmp
  return $bmp
}

function Draw-Paper([System.Drawing.Graphics]$g, [int]$w, [int]$h) {
  $g.Clear([System.Drawing.Color]::FromArgb(7, 7, 6))
  if ($paper) { Cover $g $paper 10 14 ($w - 20) ($h - 28) }
}

function Draw-Glyphs([System.Drawing.Graphics]$g, $glyphs) {
  foreach ($glyph in @($glyphs)) {
    $bmp = Get-Letter ([string]$glyph.path)
    if (-not $bmp) { continue }
    $state = $g.Save()
    $g.TranslateTransform([single]$glyph.x, [single]$glyph.y)
    $slotW = [double]$glyph.w
    $slotH = [double]$glyph.h
    $fit = [Math]::Min($slotW / $bmp.Width, $slotH / $bmp.Height)
    $dw = $bmp.Width * $fit
    $dh = $bmp.Height * $fit
    $cx = $dw * [double]$glyph.cx
    $base = $dh * [double]$glyph.vb
    $g.TranslateTransform([single]($slotW / 2), [single]$glyph.baseline)
    $g.RotateTransform([single](([double]$glyph.rot) * 180 / [Math]::PI))
    $g.DrawImage($bmp, [single](-$cx), [single](-$base), [single]$dw, [single]$dh)
    $g.Restore($state)
  }
}

function Draw-Card([System.Drawing.Graphics]$g, [int]$x, [int]$y, [int]$w, [int]$h, [string]$title, [string]$sub, [string]$meta) {
  if ($fill) { $g.DrawImage($fill, $x, $y, $w, $h) }
  else {
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(236, 231, 220))
    $g.FillRectangle($brush, $x, $y, $w, $h)
    $brush.Dispose()
  }
  $ink = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(22, 20, 16))
  $muted = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(92, 87, 78))
  $fontTitle = New-Object System.Drawing.Font "Segoe UI", 42, ([System.Drawing.FontStyle]::Bold)
  $fontSub = New-Object System.Drawing.Font "Segoe UI", 22, ([System.Drawing.FontStyle]::Bold)
  $fontMeta = New-Object System.Drawing.Font "Segoe UI", 12, ([System.Drawing.FontStyle]::Bold)
  $g.DrawString($title, $fontTitle, $ink, $x + 22, $y + 18)
  $g.DrawString($sub, $fontSub, $ink, $x + 22, $y + $h - 70)
  $g.DrawString($meta, $fontMeta, $muted, $x + 24, $y + $h - 36)
  $ink.Dispose(); $muted.Dispose(); $fontTitle.Dispose(); $fontSub.Dispose(); $fontMeta.Dispose()
}

function Save-Frame([string]$rel, $spec, [scriptblock]$extra) {
  $dest = Join-Path $outDir $rel
  New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
  $bmp = New-Object System.Drawing.Bitmap 1080, 1920
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  Draw-Paper $g 1080 1920
  if ($extra) { & $extra $g }
  Draw-Glyphs $g $spec.glyphs
  $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Output $rel
}

foreach ($item in $frames) {
  if ($item.file -like "v2-*") { continue }
  Save-Frame $item.file $item $null
}

Save-Frame "v2-agenda.png" $byFile["v2-agenda-headline.png"] {
  param($g)
  Draw-Card $g 18 330 1044 280 "22:10" "MAQUINA FC" "COPA YESHUA"
  Draw-Card $g 32 620 1044 280 "22:40" "POA CITY" "YESHUA LEAGUE"
  Draw-Card $g 12 910 1044 280 "23:10" "CTX GAMINGG" "COPA YESHUA"
  Draw-Card $g 28 1200 1044 280 "00:10" "SUMMIT ES" "AMISTOSO"
  Draw-Card $g 16 1490 1044 280 "01:00" "WINNER ELEVENS" "MASTER"
}

Save-Frame "v2-related.png" $byFile["v2-related-headline.png"] {
  param($g)
  $pw = 1080 * 0.86
  $ph = $pw * (68.0 / 105)
  $px = (1080 - $pw) / 2
  $py = 1920 * 0.24
  $state = $g.Save()
  $g.TranslateTransform([single]($px + $pw / 2), [single]($py + $ph / 2))
  $g.RotateTransform(-1.1)
  $g.TranslateTransform([single](-$pw / 2), [single](-$ph / 2))
  if ($fill) { $g.DrawImage($fill, 0, 0, [int]$pw, [int]$ph) }
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(26, 24, 20), 4)
  $g.DrawRectangle($pen, 8, 8, [int]$pw - 16, [int]$ph - 16)
  $g.DrawLine($pen, 8, [int]($ph / 2), [int]$pw - 8, [int]($ph / 2))
  $g.DrawEllipse($pen, [int]($pw / 2 - 70), [int]($ph / 2 - 70), 140, 140)
  $pen.Dispose()
  $g.Restore($state)
  if ($face) { $g.DrawImage($face, -20, 1160, 430, 520) }
}

Save-Frame "v2-announce.png" $byFile["v2-announce-name.png"] {
  param($g)
  if ($face) { $g.DrawImage($face, -40, -80, 980, 1500) }
  if ($fill) { $g.DrawImage($fill, 804, 238, 216, 216) }
  $ink = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(17, 16, 13))
  $font = New-Object System.Drawing.Font "Segoe UI", 64, ([System.Drawing.FontStyle]::Bold)
  $g.DrawString("08", $font, $ink, 850, 290)
  $seal = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(207, 198, 180))
  $g.FillRectangle($seal, 24, 1450, 280, 70)
  $g.DrawString("CAPITAO", (New-Object System.Drawing.Font "Segoe UI", 22, ([System.Drawing.FontStyle]::Bold)), $ink, 48, 1468)
  $g.FillRectangle($seal, 24, 1680, 140, 56)
  $g.DrawString("MC", (New-Object System.Drawing.Font "Segoe UI", 20, ([System.Drawing.FontStyle]::Bold)), $ink, 58, 1694)
  $ink.Dispose(); $font.Dispose(); $seal.Dispose()
}

Save-Frame "v2-summary.png" $byFile["v2-summary-headline.png"] {
  param($g)
  Draw-Card $g 18 262 328 188 "03" "J" "JOGOS"
  Draw-Card $g 366 280 328 188 "02" "V" "VITORIAS"
  Draw-Card $g 714 268 328 188 "07" "GOLS" "MARCADOS"
  Draw-Card $g 16 490 1048 220 "2-1" "POA CITY" "COPA YESHUA"
  Draw-Card $g 28 720 1048 220 "3-0" "MAQUINA FC" "YESHUA LEAGUE"
  Draw-Card $g 10 950 1048 220 "1-1" "CTX GAMINGG" "AMISTOSO"
  Draw-Card $g 22 1180 1048 220 "4-2" "SUMMIT ES" "MASTER"
}

$left = [System.Drawing.Bitmap]::FromFile((Join-Path $outDir "agenda-matchcut\composicao-01.png"))
$right = [System.Drawing.Bitmap]::FromFile((Join-Path $outDir "agenda-matchcut\composicao-02.png"))
$cmp = New-Object System.Drawing.Bitmap 2160, 1920
$cg = [System.Drawing.Graphics]::FromImage($cmp)
$cg.DrawImage($left, 0, 0, 1080, 1920)
$cg.DrawImage($right, 1080, 0, 1080, 1920)
$white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(244, 241, 234))
$font = New-Object System.Drawing.Font "Segoe UI", 18, ([System.Drawing.FontStyle]::Bold)
$cg.FillRectangle($white, 24, 24, 560, 48)
$cg.FillRectangle($white, 1104, 24, 760, 48)
$ink = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(17, 16, 13))
$cg.DrawString("NANDO POOL  A3 G7 E2 N18 D4 A9", $font, $ink, 36, 34)
$cg.DrawString("STRIX CUTOUT  A16 G2 E19 N4 D1 A3", $font, $ink, 1116, 34)
$cmp.Save((Join-Path $outDir "nando-strix-compare.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$cg.Dispose(); $cmp.Dispose(); $left.Dispose(); $right.Dispose()
$white.Dispose(); $font.Dispose(); $ink.Dispose()

$refDir = Join-Path $outDir "reference"
New-Item -ItemType Directory -Force -Path $refDir | Out-Null
$srcRoot = Join-Path $root "design-assets\source\cutout-letters\letras_recortadas-main"
$copies = @(
  @("A", 3), @("G", 7), @("E", 2), @("N", 18), @("D", 4), @("A", 9),
  @("A", 16), @("G", 2), @("E", 19), @("N", 4), @("D", 1)
)
foreach ($pair in $copies) {
  $from = Join-Path $srcRoot ("{0}\{0} ({1}).png" -f $pair[0], $pair[1])
  if (Test-Path $from) {
    Copy-Item $from (Join-Path $refDir ("{0}-{1:D2}.png" -f $pair[0], $pair[1])) -Force
  }
}

if ($paper) { $paper.Dispose() }
if ($face) { $face.Dispose() }
if ($fill) { $fill.Dispose() }
foreach ($bmp in $letterCache.Values) { if ($bmp) { $bmp.Dispose() } }
Write-Output "QA_DONE"
