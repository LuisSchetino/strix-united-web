$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = "C:\Users\ObeeN\Documents\STRIX UNITED FC27"
$papers = @(
  (Join-Path $root "src\assets\collage\paper\cut-fill.jpg"),
  (Join-Path $root "src\assets\collage\paper\noise-paper-1.jpg"),
  (Join-Path $root "src\assets\collage\paper\noise-paper-2.jpg"),
  (Join-Path $root "src\assets\collage\texture\street-10.jpg"),
  (Join-Path $root "src\assets\collage\texture\street-26.jpg")
) | Where-Object { Test-Path $_ }
$outRoot = Join-Path $root "public\collage\letters"
New-Item -ItemType Directory -Force -Path $outRoot | Out-Null

$headline = @("A","G","E","N","D","R","L","I","O","S","U","M","C","T","V")
$chars = @([char[]](65..90)) + @([char[]](48..57)) | ForEach-Object { [string]$_ }
$fonts = @("Impact","Arial Black","Georgia","Times New Roman","Segoe UI Black","Bahnschrift","Trebuchet MS","Franklin Gothic Medium")

function Get-Seed([string]$text) {
  $h = [uint32]2166136261
  foreach ($ch in $text.ToCharArray()) {
    $h = $h -bxor [int][char]$ch
    $h = [uint32]([int64]$h * 16777619 -band [uint32]::MaxValue)
  }
  return $h
}

$loadedPapers = @()
foreach ($p in $papers) {
  $loadedPapers += [System.Drawing.Image]::FromFile($p)
}

foreach ($char in $chars) {
  $count = if ($headline -contains $char) { 8 } else { 4 }
  $dir = Join-Path $outRoot $char
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  for ($n = 1; $n -le $count; $n++) {
    $seed = Get-Seed "$char-$n"
    $rand = New-Object Random ([int]($seed % [int]::MaxValue))
    $w = 150 + $rand.Next(40)
    $h = 180 + $rand.Next(50)
    $bmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $pts = New-Object System.Collections.Generic.List[System.Drawing.PointF]
    $steps = 10
    for ($i = 0; $i -le $steps; $i++) { $pts.Add([System.Drawing.PointF]::new(($w * $i / $steps) + ($rand.NextDouble()-0.5)*10, 6 + ($rand.NextDouble()-0.5)*10)) }
    for ($i = 1; $i -le $steps; $i++) { $pts.Add([System.Drawing.PointF]::new($w - 6 + ($rand.NextDouble()-0.5)*10, ($h * $i / $steps) + ($rand.NextDouble()-0.5)*10)) }
    for ($i = 1; $i -le $steps; $i++) { $pts.Add([System.Drawing.PointF]::new($w - ($w * $i / $steps) + ($rand.NextDouble()-0.5)*10, $h - 6 + ($rand.NextDouble()-0.5)*10)) }
    for ($i = 1; $i -le $steps; $i++) { $pts.Add([System.Drawing.PointF]::new(6 + ($rand.NextDouble()-0.5)*10, $h - ($h * $i / $steps) + ($rand.NextDouble()-0.5)*10)) }
    $path.AddPolygon($pts.ToArray())
    $g.SetClip($path)
    $paper = $loadedPapers[$rand.Next($loadedPapers.Count)]
    $g.DrawImage($paper, 0, 0, $w, $h)
    $invert = $rand.NextDouble() -gt 0.55
    if ($invert) {
      $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(210, 244, 241, 234))), $path)
    }
    $fontName = $fonts[$rand.Next($fonts.Count)]
    $fontSize = [float](92 + $rand.Next(36))
    try { $font = New-Object System.Drawing.Font $fontName, $fontSize, ([System.Drawing.FontStyle]::Bold) } catch { $font = New-Object System.Drawing.Font "Impact", $fontSize, ([System.Drawing.FontStyle]::Bold) }
    $brush = New-Object System.Drawing.SolidBrush ($(if ($invert) { [System.Drawing.Color]::FromArgb(255, 16, 14, 12) } else { [System.Drawing.Color]::FromArgb(255, 18, 16, 14) }))
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $g.ResetClip()
    $g.SetClip($path)
    $g.TranslateTransform(($rand.NextDouble()-0.5)*8, ($rand.NextDouble()-0.5)*8)
    $g.RotateTransform([float](($rand.NextDouble()-0.5)*11))
    $g.DrawString($char, $font, $brush, [System.Drawing.RectangleF]::new(0, 0, $w, $h), $sf)
    $g.ResetTransform()
    $dest = Join-Path $dir ("{0:D2}.png" -f $n)
    $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose(); $font.Dispose(); $brush.Dispose(); $path.Dispose()
  }
}
foreach ($img in $loadedPapers) { $img.Dispose() }
$files = Get-ChildItem $outRoot -Recurse -File
Write-Output ("letters {0} files {1:N2} MB" -f $files.Count, (($files | Measure-Object Length -Sum).Sum / 1MB))
