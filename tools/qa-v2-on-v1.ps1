$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = "C:\Users\ObeeN\Documents\STRIX UNITED FC27"
$outDir = Join-Path $root "qa\cutout-real-v2"
$jsonPath = Join-Path $outDir "v1v2-headlines.json"
$headlines = Get-Content $jsonPath -Raw | ConvertFrom-Json
$public = Join-Path $root "public"
$portrait = Join-Path $public "brand\strix\portrait-nunes.png"
$lettersRoot = Join-Path $public "collage\letters"
$ink = [System.Drawing.Color]::FromArgb(239, 236, 230)
$muted = [System.Drawing.Color]::FromArgb(163, 168, 174)
$void = [System.Drawing.Color]::FromArgb(5, 6, 7)
$rule = [System.Drawing.Color]::FromArgb(72, 239, 236, 230)

function Load-Bmp([string]$path) {
  if (-not (Test-Path $path)) { return $null }
  return [System.Drawing.Bitmap]::FromFile($path)
}

$face = Load-Bmp $portrait
$letterCache = @{}
function Get-Letter([string]$rel) {
  $path = Join-Path $public ($rel.TrimStart("/").Replace("/", "\"))
  if ($letterCache.ContainsKey($path)) { return $letterCache[$path] }
  $bmp = Load-Bmp $path
  $letterCache[$path] = $bmp
  return $bmp
}

function New-Canvas {
  $bmp = New-Object System.Drawing.Bitmap 1080, 1920
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear($void)
  $g.SmoothingMode = "AntiAlias"
  $g.TextRenderingHint = "AntiAlias"
  return @{ Bmp = $bmp; G = $g }
}

function Draw-Type($g, [string]$text, [int]$x, [int]$y, [int]$size, $color, [string]$align = "left", [bool]$inter = $false) {
  $family = if ($inter) { "Segoe UI" } else { "Segoe UI" }
  $font = New-Object System.Drawing.Font $family, $size, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $brush = New-Object System.Drawing.SolidBrush $color
  $fmt = New-Object System.Drawing.StringFormat
  if ($align -eq "center") { $fmt.Alignment = [System.Drawing.StringAlignment]::Center }
  elseif ($align -eq "right") { $fmt.Alignment = [System.Drawing.StringAlignment]::Far }
  $g.DrawString($text, $font, $brush, $x, $y, $fmt)
  $font.Dispose(); $brush.Dispose(); $fmt.Dispose()
}

function Draw-Rule($g, [int]$x1, [int]$y, [int]$x2) {
  $pen = New-Object System.Drawing.Pen $rule, 2
  $g.DrawLine($pen, $x1, $y, $x2, $y)
  $pen.Dispose()
}

function Draw-Glyphs($g, $glyphs) {
  foreach ($glyph in @($glyphs)) {
    $bmp = Get-Letter ([string]$glyph.path)
    if (-not $bmp) { continue }
    $state = $g.Save()
    $g.TranslateTransform([single]$glyph.x, [single]$glyph.y)
    $fit = [Math]::Min([double]$glyph.w / $bmp.Width, [double]$glyph.h / $bmp.Height)
    $dw = $bmp.Width * $fit
    $dh = $bmp.Height * $fit
    $cx = $dw * [double]$glyph.cx
    $base = $dh * [double]$glyph.vb
    $g.TranslateTransform([single]([double]$glyph.w / 2), [single]$glyph.baseline)
    $g.RotateTransform([single](([double]$glyph.rot) * 180 / [Math]::PI))
    $g.DrawImage($bmp, [single](-$cx), [single](-$base), [single]$dw, [single]$dh)
    $g.Restore($state)
  }
}

function Draw-V1Chrome($g) {
  Draw-Type $g "STRIX UNITED" 540 230 28 $muted "center" $true
  Draw-Rule $g 320 278 760
}

function Draw-Matches($g, [int]$startY) {
  $rows = @(
    @("22:10", "MAQUINA FC", "COPA YESHUA"),
    @("22:40", "POA CITY", "YESHUA LEAGUE"),
    @("23:10", "CTX GAMINGG", "COPA YESHUA")
  )
  $i = 0
  foreach ($row in $rows) {
    $y = $startY + $i * 220
    Draw-Type $g $row[0] 540 $y 92 $ink "center"
    Draw-Type $g ("STRIX UNITED  x  " + $row[1]) 540 ($y + 100) 28 $ink "center" $true
    Draw-Type $g $row[2] 540 ($y + 142) 22 $muted "center" $true
    $i++
  }
}

function Save($canvas, [string]$name) {
  $dest = Join-Path $outDir $name
  $canvas.Bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
  $canvas.G.Dispose(); $canvas.Bmp.Dispose()
  Write-Output $name
}

# V1 agenda
$c = New-Canvas
Draw-V1Chrome $c.G
Draw-Type $c.G "AGENDA" 540 330 150 $ink "center"
Draw-Type $c.G "DO DIA" 540 470 150 $ink "center"
Draw-Type $c.G "20 SET 2026" 540 640 40 $ink "center" $true
Draw-Type $c.G "03 JOGOS" 540 710 52 $ink "center" $true
Draw-Matches $c.G 860
Save $c "v1-agenda.png"

# V2 agenda
$c = New-Canvas
Draw-V1Chrome $c.G
Draw-Glyphs $c.G $headlines.agenda.glyphs
Draw-Type $c.G "DO DIA" 540 470 150 $ink "center"
Draw-Type $c.G "20 SET 2026" 540 640 40 $ink "center" $true
Draw-Type $c.G "03 JOGOS" 540 710 52 $ink "center" $true
Draw-Matches $c.G 860
Save $c "v2-agenda.png"

# V1 related
$c = New-Canvas
Draw-V1Chrome $c.G
Draw-Type $c.G "RELACIONADOS" 540 330 96 $ink "center"
Draw-Type $c.G "DA NOITE" 540 430 96 $ink "center"
$pen = New-Object System.Drawing.Pen $ink, 3
$c.G.DrawRectangle($pen, 90, 620, 900, 580)
$c.G.DrawLine($pen, 90, 910, 990, 910)
$c.G.DrawEllipse($pen, 470, 840, 140, 140)
$pen.Dispose()
if ($face) { $c.G.DrawImage($face, 70, 1280, 420, 520) }
Draw-Type $c.G "01  ·  MC" 520 1500 22 $muted "left" $true
Draw-Type $c.G "NUNES" 520 1540 64 $ink "left"
Save $c "v1-related.png"

# V2 related
$c = New-Canvas
Draw-V1Chrome $c.G
Draw-Glyphs $c.G $headlines.related.glyphs
Draw-Type $c.G "DA NOITE" 540 470 96 $ink "center"
$pen = New-Object System.Drawing.Pen $ink, 3
$c.G.DrawRectangle($pen, 90, 620, 900, 580)
$c.G.DrawLine($pen, 90, 910, 990, 910)
$c.G.DrawEllipse($pen, 470, 840, 140, 140)
$pen.Dispose()
if ($face) { $c.G.DrawImage($face, 70, 1280, 420, 520) }
Draw-Type $c.G "01  ·  MC" 520 1500 22 $muted "left" $true
Draw-Type $c.G "NUNES" 520 1540 64 $ink "left"
Save $c "v2-related.png"

# V1 announce
$c = New-Canvas
if ($face) { $c.G.DrawImage($face, 40, 80, 1000, 1180) }
$veil = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(180, 5, 6, 7))
$c.G.FillRectangle($veil, 0, 1120, 1080, 800)
$veil.Dispose()
Draw-Type $c.G "STRIX UNITED" 72 200 22 $muted "left" $true
Draw-Type $c.G "NUNES" 72 1280 120 $ink "left"
Draw-Type $c.G "MC" 72 1420 26 $muted "left" $true
Draw-Type $c.G "CAPITAO" 72 1460 22 $ink "left" $true
Draw-Type $c.G "08" 860 240 72 $ink "left"
Save $c "v1-announce.png"

# V2 announce
$c = New-Canvas
if ($face) { $c.G.DrawImage($face, 40, 80, 1000, 1180) }
$veil = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(180, 5, 6, 7))
$c.G.FillRectangle($veil, 0, 1120, 1080, 800)
$veil.Dispose()
Draw-Type $c.G "STRIX UNITED" 72 200 22 $muted "left" $true
Draw-Glyphs $c.G $headlines.announce.glyphs
Draw-Type $c.G "MC" 72 1480 26 $muted "left" $true
Draw-Type $c.G "CAPITAO" 72 1520 22 $ink "left" $true
Draw-Type $c.G "08" 860 240 72 $ink "left"
Save $c "v2-announce.png"

# V1 summary
$c = New-Canvas
Draw-V1Chrome $c.G
Draw-Type $c.G "RESUMO" 540 330 110 $ink "center"
Draw-Type $c.G "DO DIA" 540 440 110 $ink "center"
Draw-Type $c.G "20 SET 2026" 540 600 32 $ink "center" $true
$stats = @(@("JOGOS","03"), @("VITORIAS","02"), @("GOLS","07"))
0..2 | ForEach-Object {
  $x = 90 + $_ * 330
  $box = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(14, 16, 20))
  $c.G.FillRectangle($box, $x, 680, 300, 160)
  $box.Dispose()
  $bar = New-Object System.Drawing.SolidBrush $ink
  $c.G.FillRectangle($bar, $x, 680, 6, 160)
  $bar.Dispose()
  Draw-Type $c.G $stats[$_][0] ($x + 24) 710 18 $muted "left" $true
  Draw-Type $c.G $stats[$_][1] ($x + 24) 750 64 $ink "left"
}
Draw-Type $c.G "2  –  1" 540 920 92 $ink "center"
Draw-Type $c.G "POA CITY" 540 1030 36 $ink "center" $true
Draw-Type $c.G "COPA YESHUA" 540 1080 22 $muted "center" $true
Save $c "v1-summary.png"

# V2 summary
$c = New-Canvas
Draw-V1Chrome $c.G
Draw-Glyphs $c.G $headlines.summary.glyphs
Draw-Type $c.G "DO DIA" 540 470 110 $ink "center"
Draw-Type $c.G "20 SET 2026" 540 600 32 $ink "center" $true
0..2 | ForEach-Object {
  $x = 90 + $_ * 330
  $box = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(14, 16, 20))
  $c.G.FillRectangle($box, $x, 680, 300, 160)
  $box.Dispose()
  $bar = New-Object System.Drawing.SolidBrush $ink
  $c.G.FillRectangle($bar, $x, 680, 6, 160)
  $bar.Dispose()
  Draw-Type $c.G $stats[$_][0] ($x + 24) 710 18 $muted "left" $true
  Draw-Type $c.G $stats[$_][1] ($x + 24) 750 64 $ink "left"
}
Draw-Type $c.G "2  –  1" 540 920 92 $ink "center"
Draw-Type $c.G "POA CITY" 540 1030 36 $ink "center" $true
Draw-Type $c.G "COPA YESHUA" 540 1080 22 $muted "center" $true
Save $c "v2-summary.png"

function Compare-Pair([string]$leftName, [string]$rightName, [string]$destName, [string]$leftLabel, [string]$rightLabel) {
  $left = [System.Drawing.Bitmap]::FromFile((Join-Path $outDir $leftName))
  $right = [System.Drawing.Bitmap]::FromFile((Join-Path $outDir $rightName))
  $cmp = New-Object System.Drawing.Bitmap 2160, 1920
  $g = [System.Drawing.Graphics]::FromImage($cmp)
  $g.DrawImage($left, 0, 0, 1080, 1920)
  $g.DrawImage($right, 1080, 0, 1080, 1920)
  $tag = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(239, 236, 230))
  $g.FillRectangle($tag, 24, 24, 220, 44)
  $g.FillRectangle($tag, 1104, 24, 220, 44)
  Draw-Type $g $leftLabel 36 30 22 ([System.Drawing.Color]::FromArgb(5,6,7)) "left" $true
  Draw-Type $g $rightLabel 1116 30 22 ([System.Drawing.Color]::FromArgb(5,6,7)) "left" $true
  $cmp.Save((Join-Path $outDir $destName), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $cmp.Dispose(); $left.Dispose(); $right.Dispose(); $tag.Dispose()
  Write-Output $destName
}

Compare-Pair "v1-agenda.png" "v2-agenda.png" "v1-v2-agenda.png" "V1 CAMPANHA" "V2 COLLAGE"
Compare-Pair "v1-related.png" "v2-related.png" "v1-v2-related.png" "V1 CAMPANHA" "V2 COLLAGE"
Compare-Pair "v1-announce.png" "v2-announce.png" "v1-v2-announce.png" "V1 CAMPANHA" "V2 COLLAGE"
Compare-Pair "v1-summary.png" "v2-summary.png" "v1-v2-summary.png" "V1 CAMPANHA" "V2 COLLAGE"

if ($face) { $face.Dispose() }
foreach ($bmp in $letterCache.Values) { if ($bmp) { $bmp.Dispose() } }
Write-Output "V1V2_QA_DONE"
