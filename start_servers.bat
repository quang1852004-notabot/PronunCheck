@echo off
echo ==========================================
echo Starting DT3 PronunCheck Services
echo ==========================================

echo [1/2] Starting Backend (FastAPI Gateway)...
start "Backend - FastAPI" cmd /k "cd /d %~dp0 && call venv\Scripts\activate && uvicorn main:app --reload --port 8000"

echo [2/2] Starting Frontend (Next.js)...
start "Frontend - Next.js" cmd /k "cd /d %~dp0frontend-pronuncheck && npm run dev"

echo All services are starting up in separate windows!
echo You can close this window now.
