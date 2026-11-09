# Solo modifica el PATH de esta consola; no cambia el perfil ni el sistema.
$minaNode = Join-Path $PSScriptRoot '.tools/node-v24.22.2-win-x64'
if (-not (Test-Path (Join-Path $minaNode 'node.exe'))) {
  throw 'Falta Node portátil. Consulta docs/SETUP.md.'
}
$env:PATH = "$minaNode;$env:PATH"
Write-Host 'MINA CERO: Node y npm disponibles en esta consola.'
