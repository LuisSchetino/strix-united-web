param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [string]$Char = "A",
  [int]$Variant = 1,
  [int]$GreenThreshold = 90
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = "C:\Users\ObeeN\Documents\STRIX UNITED FC27"
$letter = $Char.ToUpperInvariant()
$outDir = Join-Path $root "public\collage\letters\$letter"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$src = [System.Drawing.Bitmap]::FromFile($InputPath)
$bmp = New-Object System.Drawing.Bitmap $src.Width, $src.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$minX = $src.Width; $minY = $src.Height; $maxX = 0; $maxY = 0
for ($y = 0; $y -lt $src.Height; $y++) {
  for ($x = 0; $x -lt $src.Width; $x++) {
    $c = $src.GetPixel($x, $y)
    $gDom = $c.G - [Math]::Max($c.R, $c.B)
    $alpha = if ($c.G -gt 180 -and $gDom -gt $GreenThreshold) { 0 } else { $c.A }
    $r = [int][Math]::Min(255, $c.R + [Math]::Max(0, ($c.G - $c.R) * 0.15))
    $b = [int][Math]::Min(255, $c.B + [Math]::Max(0, ($c.G - $c.B) * 0.08))
    $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $r, [Math]::Min($c.G, $r + 20), $b))
    if ($alpha -gt 12) {
      if ($x -lt $minX) { $minX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }
}
if ($maxX -le $minX) { throw "No opaque pixels after chroma key." }
$pad = 8
$minX = [Math]::Max(0, $minX - $pad); $minY = [Math]::Max(0, $minY - $pad)
$maxX = [Math]::Min($bmp.Width - 1, $maxX + $pad); $maxY = [Math]::Min($bmp.Height - 1, $maxY + $pad)
$cropW = $maxX - $minX + 1; $cropH = $maxY - $minY + 1
$cropped = $bmp.Clone([System.Drawing.Rectangle]::new($minX, $minY, $cropW, $cropH), $bmp.PixelFormat)
$scale = [Math]::Min(1.0, 220.0 / [Math]::Max($cropW, $cropH))
$nw = [Math]::Max(1, [int][Math]::Round($cropW * $scale))
$nh = [Math]::Max(1, [int][Math]::Round($cropH * $scale))
$out = New-Object System.Drawing.Bitmap $nw, $nh
$g = [System.Drawing.Graphics]::FromImage($out)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($cropped, 0, 0, $nw, $nh)
$dest = Join-Path $outDir ("{0:D2}.png" -f $Variant)
$out.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $out.Dispose(); $cropped.Dispose(); $bmp.Dispose(); $src.Dispose()
Write-Output "wrote $dest"
