param([switch]$SkipDependencies)
$ErrorActionPreference = 'Stop'
$minaRoot = Split-Path $PSScriptRoot
$minaTools = Join-Path $minaRoot '.tools'
$minaVersion = 'v24.22.2'
$minaArchive = "node-$minaVersion-win-x64.zip"
$minaNode = Join-Path $minaTools "node-$minaVersion-win-x64"
if (-not [Environment]::Is64BitOperatingSystem) { throw 'Este paquete portátil requiere Windows x64.' }
New-Item -ItemType Directory -Path $minaTools -Force | Out-Null
if (-not (Test-Path (Join-Path $minaNode 'node.exe'))) {
  $archivePath = Join-Path $minaTools $minaArchive
  Invoke-WebRequest "https://nodejs.org/dist/$minaVersion/$minaArchive" -OutFile $archivePath
  $checksums = (Invoke-WebRequest "https://nodejs.org/dist/$minaVersion/SHASUMS256.txt").Content
  $checksumLine = $checksums -split "`n" | Where-Object { $_.Trim().EndsWith(" $minaArchive") }
  if (-not $checksumLine) { throw 'No se encontró el hash oficial.' }
  $expected = ($checksumLine -split '\s+')[0]
  if ((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLower() -ne $expected) {
    throw 'Hash SHA256 incorrecto; no se extraerá el archivo.'
  }
  Expand-Archive -LiteralPath $archivePath -DestinationPath $minaTools
}
& (Join-Path $minaNode 'node.exe') --version
& (Join-Path $minaNode 'npm.cmd') --version
if (-not $SkipDependencies) {
  $previousPath = $env:PATH
  Push-Location $minaRoot
  try {
    $env:PATH = "$minaNode;$env:PATH"
    & (Join-Path $minaNode 'npm.cmd') ci
    if ($LASTEXITCODE -ne 0) { throw 'npm ci falló.' }
  } finally {
    $env:PATH = $previousPath
    Pop-Location
  }
}
Write-Host 'Entorno local preparado. Iniciar con .\npm.cmd run dev'
