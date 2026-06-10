# ============================================================
# EAEDS Phase-1: One-Click Setup Script for Windows
# Run this in PowerShell from the project root:
#   .\setup_and_run.ps1
# ============================================================

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  EAEDS Phase-1 Setup & Launch Script" -ForegroundColor Cyan  
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$ProjectRoot = $PSScriptRoot
if (-not $ProjectRoot) { $ProjectRoot = Get-Location }

# --- STEP 1: Create Python Virtual Environment ---
Write-Host "[1/5] Creating Python virtual environment..." -ForegroundColor Yellow
if (-not (Test-Path "$ProjectRoot\venv")) {
    python -m venv "$ProjectRoot\venv"
    Write-Host "  ✅ Virtual environment created" -ForegroundColor Green
} else {
    Write-Host "  ✅ Virtual environment already exists" -ForegroundColor Green
}

# Activate venv
& "$ProjectRoot\venv\Scripts\Activate.ps1"
Write-Host "  ✅ Virtual environment activated" -ForegroundColor Green

# --- STEP 2: Install Python Dependencies ---
Write-Host ""
Write-Host "[2/5] Installing Python dependencies..." -ForegroundColor Yellow

# Install from server/requirements.txt (core deps)
pip install -r "$ProjectRoot\server\requirements.txt" --quiet 2>$null

# Install additional required packages
pip install sqlalchemy python-dotenv python-multipart --quiet 2>$null

Write-Host "  ✅ Python dependencies installed" -ForegroundColor Green

# --- STEP 3: Initialize Databases ---
Write-Host ""
Write-Host "[3/5] Initializing databases..." -ForegroundColor Yellow

# Init calls.db (raw SQLite)
python -c "import sys; sys.path.insert(0, '$($ProjectRoot -replace '\\','/')'); from server.database.db_manager import DatabaseManager; db = DatabaseManager()"

# Init dispatch.db (SQLAlchemy)
python -c "import sys; sys.path.insert(0, '$($ProjectRoot -replace '\\','/')'); from server.database.database import engine, Base; from server.database import models; Base.metadata.create_all(bind=engine); print(' ✅ dispatch.db initialized')"

Write-Host "  ✅ Databases initialized" -ForegroundColor Green

# --- STEP 4: Start Backend Server ---
Write-Host ""
Write-Host "[4/5] Starting Backend Server (FastAPI)..." -ForegroundColor Yellow
Write-Host "  → http://127.0.0.1:8000" -ForegroundColor Cyan
Write-Host "  → Chat Test: http://127.0.0.1:8000/chat" -ForegroundColor Cyan

Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$ProjectRoot'; & '$ProjectRoot\venv\Scripts\Activate.ps1'; python -m uvicorn server.main:app --reload --host 127.0.0.1 --port 8000"

Start-Sleep -Seconds 3
Write-Host "  ✅ Backend server launched in new window" -ForegroundColor Green

# --- STEP 5: Install & Start Frontend ---
Write-Host ""
Write-Host "[5/5] Setting up Frontend (Next.js)..." -ForegroundColor Yellow

if (-not (Test-Path "$ProjectRoot\client\node_modules")) {
    Write-Host "  Installing npm dependencies (this may take a minute)..." -ForegroundColor Gray
    Push-Location "$ProjectRoot\client"
    npm install --loglevel=error 2>$null
    Pop-Location
    Write-Host "  ✅ npm dependencies installed" -ForegroundColor Green
} else {
    Write-Host "  ✅ node_modules already exists" -ForegroundColor Green
}

Write-Host "  → http://localhost:3000" -ForegroundColor Cyan

Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$ProjectRoot\client'; npm run dev"

Start-Sleep -Seconds 2
Write-Host "  ✅ Frontend server launched in new window" -ForegroundColor Green

# --- DONE ---
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  🚀 EAEDS is now running!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Dashboard:  http://localhost:3000" -ForegroundColor White
Write-Host "  Backend:    http://127.0.0.1:8000" -ForegroundColor White
Write-Host "  Chat Test:  http://127.0.0.1:8000/chat" -ForegroundColor White
Write-Host "  Live Page:  http://localhost:3000/live" -ForegroundColor White
Write-Host ""
