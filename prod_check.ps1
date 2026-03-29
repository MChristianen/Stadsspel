# Production readiness checks (configuration only)
Write-Host "================================" -ForegroundColor Cyan
Write-Host "  STADSSPEL - PROD CHECK" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

$ROOT = "c:\Users\MarkC\stadsspel"
Set-Location $ROOT

$envFileValues = @{}
if (Test-Path ".env") {
  Get-Content ".env" | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $parts = $line.Split("=", 2)
    if ($parts.Count -eq 2) {
      $envFileValues[$parts[0]] = $parts[1]
    }
  }
}

$required = @(
  "DATABASE_URL",
  "SECRET_KEY",
  "CORS_ORIGINS",
  "MEDIA_STORAGE_TYPE",
  "MEDIA_BASE_URL",
  "ENVIRONMENT"
)

$missing = @()
foreach ($name in $required) {
  $current = [Environment]::GetEnvironmentVariable($name)
  if (-not $current -and $envFileValues.ContainsKey($name)) {
    $current = $envFileValues[$name]
  }
  if (-not $current) {
    $missing += $name
  }
}

if ($missing.Count -gt 0) {
  Write-Host "Missing environment variables:" -ForegroundColor Red
  foreach ($m in $missing) { Write-Host "  - $m" -ForegroundColor Red }
  exit 1
}

Write-Host "Environment variables present" -ForegroundColor Green

Set-Location "$ROOT\backend"
poetry run python -c "from app.core.config import settings; print(f'ENVIRONMENT={settings.ENVIRONMENT}'); print('Config loaded: OK')"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

poetry run alembic current
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Production checks passed." -ForegroundColor Green
