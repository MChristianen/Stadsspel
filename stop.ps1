# Stadsspel Stop Script
Write-Host "🛑 Stopping Stadsspel..." -ForegroundColor Yellow

Stop-Process -Name "python" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue

Write-Host "✅ All processes stopped" -ForegroundColor Green

# Optionally stop database
$response = Read-Host "Do you want to stop the database as well? (y/n)"
if ($response -eq "y" -or $response -eq "Y") {
    Write-Host "🛑 Stopping database..." -ForegroundColor Yellow
    Set-Location "c:\Users\MarkC\stadsspel\infra"
    docker compose down
    Write-Host "✅ Database stopped" -ForegroundColor Green
}
