param(
  [switch]$Apply
)
$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $ProjectRoot '.env.local'
if (-not (Test-Path $EnvFile)) {
  throw 'No existe .env.local. Configura DATABASE_URL antes de aplicar migraciones.'
}
# Read only the DATABASE_URL variable from .env.local; never echo its value.
$DbLine = Get-Content $EnvFile | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
if (-not $DbLine) { throw 'No se encontró DATABASE_URL en .env.local.' }
$DatabaseUrl = ($DbLine -replace '^\s*DATABASE_URL\s*=\s*','').Trim().Trim('"').Trim("'")
if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) { throw 'DATABASE_URL está vacío.' }
$Psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $Psql) { throw 'No se encontró psql. Instala PostgreSQL o usa pgAdmin Query Tool.' }
$Files = @(
  'db/005_privacy_consent_and_validation_lockout.sql',
  'db/006_profiles_and_food_windows.sql',
  'db/007_persistent_auth_rate_limit.sql',
  'db/008_declared_weight_kg.sql'
)
Write-Host 'Este script aplica migraciones incrementales 005–008 a la base indicada por DATABASE_URL.' -ForegroundColor Yellow
Write-Host 'No ejecuta 000_schema.sql y no elimina tablas, pero debes tener una copia de seguridad antes de continuar.'
if (-not $Apply) {
  Write-Host 'Modo de vista previa: no se modificó la base. Tras respaldar, vuelve a ejecutar con -Apply.' -ForegroundColor Cyan
  exit 0
}
$confirmation = Read-Host 'Escribe APLICAR para confirmar que ya hiciste respaldo y que DATABASE_URL apunta a la base correcta'
if ($confirmation -cne 'APLICAR') { throw 'Cancelado; no se aplicaron migraciones.' }
Push-Location $ProjectRoot
try {
  foreach ($file in $Files) {
    $fullPath = Join-Path $ProjectRoot $file
    if (-not (Test-Path $fullPath)) { throw "No existe el archivo de migración: $file" }
    Write-Host "Aplicando $file ..."
    & $Psql.Source $DatabaseUrl '-v' 'ON_ERROR_STOP=1' '-f' $fullPath
    if ($LASTEXITCODE -ne 0) { throw "Falló $file. Revisa el mensaje de PostgreSQL; no continúes manualmente sin revisar el estado de la base." }
  }
  Write-Host 'Migraciones 005–008 aplicadas. Ejecuta ahora la prueba de esquema descrita en docs/VALIDACION_LOCAL.md.' -ForegroundColor Green
} finally {
  Pop-Location
}
