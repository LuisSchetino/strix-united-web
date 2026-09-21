$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
$cp = New-Object System.CodeDom.Compiler.CompilerParameters
$cp.ReferencedAssemblies.Add("System.dll")
$cp.ReferencedAssemblies.Add("System.Drawing.dll")
Add-Type -CompilerParameters $cp -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
public static class CutoutPrep {
  public static Bitmap TrimFit(Bitmap src, int maxSide, out int inkW, out int inkH, out float cx, out float cy, out float baseline) {
    Bitmap argb = src.Clone(new Rectangle(0, 0, src.Width, src.Height), PixelFormat.Format32bppArgb);
    BitmapData data = argb.LockBits(new Rectangle(0, 0, argb.Width, argb.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    int w = data.Width, h = data.Height, stride = data.Stride;
    byte[] buf = new byte[stride * h];
    Marshal.Copy(data.Scan0, buf, 0, buf.Length);
    argb.UnlockBits(data);
    int minX = w, minY = h, maxX = -1, maxY = -1, bottom = 0;
    long mass = 0, massX = 0, massY = 0;
    for (int y = 0; y < h; y++) {
      int row = y * stride;
      for (int x = 0; x < w; x++) {
        int i = row + x * 4;
        int a = buf[i + 3];
        if (a < 10) continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        mass += a;
        massX += (long)x * a;
        massY += (long)y * a;
        bottom = y;
      }
    }
    if (maxX < minX) {
      inkW = 1; inkH = 1; cx = 0.5f; cy = 0.5f; baseline = 0.82f;
      argb.Dispose();
      return new Bitmap(1, 1, PixelFormat.Format32bppArgb);
    }
    int pad = 4;
    minX = Math.Max(0, minX - pad);
    minY = Math.Max(0, minY - pad);
    maxX = Math.Min(w - 1, maxX + pad);
    maxY = Math.Min(h - 1, maxY + pad);
    inkW = maxX - minX + 1;
    inkH = maxY - minY + 1;
    cx = mass > 0 ? (float)(((massX / (double)mass) - minX) / inkW) : 0.5f;
    cy = mass > 0 ? (float)(((massY / (double)mass) - minY) / inkH) : 0.5f;
    baseline = (float)((bottom - minY + 1) / (double)inkH);
    double scale = Math.Min(1.0, maxSide / (double)Math.Max(inkW, inkH));
    int nw = Math.Max(1, (int)Math.Round(inkW * scale));
    int nh = Math.Max(1, (int)Math.Round(inkH * scale));
    Bitmap cropped = argb.Clone(new Rectangle(minX, minY, inkW, inkH), PixelFormat.Format32bppArgb);
    argb.Dispose();
    Bitmap dest = new Bitmap(nw, nh, PixelFormat.Format32bppArgb);
    using (Graphics g = Graphics.FromImage(dest)) {
      g.Clear(Color.Transparent);
      g.DrawImage(cropped, 0, 0, nw, nh);
    }
    cropped.Dispose();
    return dest;
  }
}
"@

$root = "C:\Users\ObeeN\Documents\STRIX UNITED FC27"
$srcRoot = Join-Path $root "design-assets\source\cutout-letters\letras_recortadas-main"
$outRoot = Join-Path $root "public\collage\letters"
if (Test-Path $outRoot) { Remove-Item $outRoot -Recurse -Force }
New-Item -ItemType Directory -Force -Path $outRoot | Out-Null

function Get-CharKey([string]$folder) {
  switch ($folder) {
    "Exclamacao" { return "!" }
    "Ponto" { return "." }
    "Virgula" { return "," }
    "virgula" { return "," }
    default { return $folder.ToUpperInvariant() }
  }
}
function Get-DirName([string]$key) {
  switch ($key) {
    "!" { return "excl" }
    "." { return "dot" }
    "," { return "comma" }
    default { return $key }
  }
}

$chars = [ordered]@{}
Get-ChildItem $srcRoot -Directory | Sort-Object Name | ForEach-Object {
  $key = Get-CharKey $_.Name
  if ($chars.Contains($key)) { return }
  $files = @(Get-ChildItem $_.FullName -File | Where-Object { $_.Extension -match '\.(png|jpg|jpeg|webp)$' })
  $sorted = $files | Sort-Object {
    if ($_.Name -match '\((\d+)\)') { [int]$Matches[1] } else { 0 }
  }
  if (-not $sorted) { return }
  $dirName = Get-DirName $key
  $destDir = Join-Path $outRoot $dirName
  New-Item -ItemType Directory -Force -Path $destDir | Out-Null
  $variants = @()
  $n = 0
  foreach ($file in @($sorted)) {
    $n += 1
    $src = [System.Drawing.Bitmap]::FromFile($file.FullName)
    $inkW = 0; $inkH = 0; $cx = 0; $cy = 0; $base = 0
    $out = [CutoutPrep]::TrimFit($src, 280, [ref]$inkW, [ref]$inkH, [ref]$cx, [ref]$cy, [ref]$base)
    $name = "{0:D2}.png" -f $n
    $dest = Join-Path $destDir $name
    $out.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
    $variants += [ordered]@{
      file = $name
      path = "/collage/letters/$dirName/$name"
      width = [int]$out.Width
      height = [int]$out.Height
      aspectRatio = [double][Math]::Round($out.Width / [Math]::Max(1, $out.Height), 4)
      visualCenter = @([double][Math]::Round($cx, 3), [double][Math]::Round($cy, 3))
      visualBaseline = [double][Math]::Round($base, 3)
      recommendedScale = 1
    }
    $out.Dispose(); $src.Dispose()
  }
  $heights = @($variants | ForEach-Object { $_.height } | Sort-Object)
  $medianH = $heights[[int][Math]::Floor(($heights.Count - 1) / 2)]
  foreach ($v in $variants) {
    $v.recommendedScale = [double][Math]::Round($medianH / [Math]::Max(1, $v.height), 3)
  }
  $chars[$key] = [ordered]@{
    dir = $dirName
    count = $variants.Count
    variants = $variants
  }
  Write-Output ("{0} {1}" -f $key, $variants.Count)
}

$manifest = [ordered]@{
  version = "letters-real-v1"
  engine = "cutout-v2"
  source = "fernandochueire/letras_recortadas"
  chars = $chars
}
$jsonPath = Join-Path $outRoot "manifest.json"
[System.IO.File]::WriteAllText($jsonPath, ($manifest | ConvertTo-Json -Depth 8 -Compress:$false))
$files = Get-ChildItem $outRoot -Recurse -File
Write-Output ("TOTAL_FILES={0} MB={1:N2}" -f $files.Count, (($files | Measure-Object Length -Sum).Sum / 1MB))
