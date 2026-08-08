<#
  Copia apenas o catalogo de logos do FC26 (legacy_state.main.data.opponentLogoCatalog)
  para o bucket/catalogo do FC27. Nenhuma linha do FC26 e alterada.
  As chaves sao solicitadas em memoria e nunca sao gravadas no projeto.
#>

$ErrorActionPreference = "Stop"

function Read-Secret([string]$Prompt) {
  $secure = Read-Host $Prompt -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function Get-SafePathPart([string]$Value) {
  $clean = $Value.Normalize([Text.NormalizationForm]::FormD) -replace '[\p{Mn}]', ''
  $clean = $clean -replace '[^a-zA-Z0-9]+', '-'
  $clean = $clean.Trim('-').ToLowerInvariant()
  if ([string]::IsNullOrWhiteSpace($clean)) { return "logo" }
  return $clean.Substring(0, [Math]::Min(80, $clean.Length))
}

function Get-Headers([string]$Key, [string]$Prefer = "") {
  $headers = @{ apikey = $Key; Authorization = "Bearer $Key" }
  if ($Prefer) { $headers.Prefer = $Prefer }
  return $headers
}

Write-Host "`nMigracao FC26 -> FC27: catalogo de logos" -ForegroundColor Cyan
Write-Host "Le somente legacy_state no FC26 e grava copias no FC27." -ForegroundColor DarkGray

$fc26Url = (Read-Host "URL do Supabase FC26 [https://qhpvjmmadsqjmtrypzdf.supabase.co]").Trim()
if (-not $fc26Url) { $fc26Url = "https://qhpvjmmadsqjmtrypzdf.supabase.co" }
$fc27Url = (Read-Host "URL do Supabase FC27 [https://torfjbilfiquealvjwvb.supabase.co]").Trim()
if (-not $fc27Url) { $fc27Url = "https://torfjbilfiquealvjwvb.supabase.co" }
$fc26Key = Read-Secret "Service role do FC26"
$fc27Key = Read-Secret "Service role do FC27"
$actorId = (Read-Host "UUID do seu usuario no FC27 (created_by)").Trim()
if ($actorId -notmatch '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') {
  throw "O UUID do usuario FC27 nao parece valido. Nenhuma logo foi copiada."
}

$stateUri = "$fc26Url/rest/v1/legacy_state?select=data&id=eq.main&limit=1"
$stateRows = Invoke-RestMethod -Method Get -Uri $stateUri -Headers (Get-Headers $fc26Key)
if (-not $stateRows -or -not $stateRows[0].data) { throw "legacy_state.main nao foi encontrado no FC26." }

$catalog = @($stateRows[0].data.opponentLogoCatalog | Where-Object {
  $_ -and $_.name -and $_.logo -and [string]$_.logo -match '^https?://'
})
if ($catalog.Count -eq 0) { throw "Nenhuma logo HTTP foi encontrada no catalogo do FC26." }

$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ("strix-fc27-logo-migration-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tempRoot | Out-Null
$copied = 0; $failed = @()

try {
  foreach ($entry in $catalog) {
    $name = [string]$entry.name
    $sourceUrl = [string]$entry.logo
    $safe = Get-SafePathPart $name
    $extension = ".webp"
    try {
      $uri = [Uri]$sourceUrl
      $candidate = [IO.Path]::GetExtension($uri.AbsolutePath)
      if ($candidate -match '^\.(png|jpe?g|webp)$') { $extension = $candidate.ToLowerInvariant() }
    } catch {}
    $targetPath = "migrated-fc26/$safe-$([guid]::NewGuid().ToString('N').Substring(0, 10))$extension"
    $tempFile = Join-Path $tempRoot ("$safe$extension")
    try {
      Invoke-WebRequest -Uri $sourceUrl -OutFile $tempFile -MaximumRedirection 3 | Out-Null
      $mime = switch ($extension) { ".png" { "image/png" } ".jpg" { "image/jpeg" } ".jpeg" { "image/jpeg" } default { "image/webp" } }
      $uploadHeaders = Get-Headers $fc27Key
      $uploadHeaders["x-upsert"] = "true"
      Invoke-WebRequest -Method Post -Uri "$fc27Url/storage/v1/object/fc27-team-assets/$targetPath" -Headers $uploadHeaders -ContentType $mime -InFile $tempFile | Out-Null
      $payload = @{ canonical_name = $name.Trim(); storage_path = $targetPath; created_by = $actorId } | ConvertTo-Json -Compress
      Invoke-RestMethod -Method Post -Uri "$fc27Url/rest/v1/opponent_logos?on_conflict=normalized_name" -Headers (Get-Headers $fc27Key "resolution=merge-duplicates") -ContentType "application/json" -Body $payload | Out-Null
      $copied += 1
      Write-Host "OK  $name" -ForegroundColor Green
    } catch {
      $failed += "$name - $($_.Exception.Message)"
      Write-Host "ERRO  $name" -ForegroundColor Yellow
    } finally {
      Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
    }
  }
} finally {
  Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "`nConcluido: $copied logo(s) migrada(s)." -ForegroundColor Cyan
if ($failed.Count) {
  Write-Host "Falharam $($failed.Count) item(ns):" -ForegroundColor Yellow
  $failed | ForEach-Object { Write-Host " - $_" }
  exit 1
}
