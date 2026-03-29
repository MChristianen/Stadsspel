# Stadsspel Start Script
Write-Host "================================" -ForegroundColor Cyan
Write-Host "  STADSSPEL - START SCRIPT" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

$ROOT = "c:\Users\MarkC\stadsspel"

# Stop existing processes
Write-Host "Stopping existing processes..." -ForegroundColor Yellow
Stop-Process -Name "python" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# 1. Start Database
Write-Host ""
Write-Host "[1/5] Starting PostgreSQL..." -ForegroundColor Green
Set-Location "$ROOT\infra"
docker compose up -d
Start-Sleep -Seconds 5
Write-Host "      Database started" -ForegroundColor Green

# 2. Run Migrations
Write-Host ""
Write-Host "[2/5] Running migrations..." -ForegroundColor Green
Set-Location "$ROOT\backend"
poetry run alembic upgrade head
Write-Host "      Migrations completed" -ForegroundColor Green

# 3. Seed Database
Write-Host ""
Write-Host "[3/5] Seeding database..." -ForegroundColor Green
poetry run python -m app.seeds.seed_required_data

# 4. Start Backend
Write-Host ""
Write-Host "[4/5] Starting backend..." -ForegroundColor Green
$backend = Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User'); cd '$ROOT\backend'; Write-Host 'BACKEND SERVER' -ForegroundColor Green; poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000" -PassThru
Start-Sleep -Seconds 5
Write-Host "      Backend: http://localhost:8000" -ForegroundColor Green

# 5. Start Frontend
Write-Host ""
Write-Host "[5/5] Starting frontend..." -ForegroundColor Green
$frontend = Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User'); cd '$ROOT\frontend-react'; Write-Host 'FRONTEND SERVER' -ForegroundColor Green; npm run dev" -PassThru
Start-Sleep -Seconds 5
Write-Host "      Frontend: http://localhost:3000" -ForegroundColor Green

# Done
Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host " STADSSPEL IS RUNNING!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Services:" -ForegroundColor White
Write-Host "  Backend:   http://localhost:8000" -ForegroundColor Gray
Write-Host "  Frontend:  http://localhost:3000" -ForegroundColor Gray
Write-Host ""
Write-Host "Admin Login:" -ForegroundColor Yellow
Write-Host "  Username: admin" -ForegroundColor White
Write-Host "  Password: admin" -ForegroundColor White
Write-Host ""
Write-Host "Next:" -ForegroundColor White
Write-Host "  1. Open http://localhost:3000" -ForegroundColor Gray
Write-Host "  2. Login as admin" -ForegroundColor Gray
Write-Host "  3. Create game with Amsterdam" -ForegroundColor Gray
Write-Host "  4. Share join link with teams" -ForegroundColor Gray
Write-Host ""
Write-Host "To stop: Close the server windows or run .\stop.ps1" -ForegroundColor Yellow
Write-Host ""
