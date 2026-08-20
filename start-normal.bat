@echo off
setlocal EnableDelayedExpansion
title ACHME Normal Start

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

echo =====================================================
echo        ACHME CRM - NORMAL START
echo =====================================================

:: ---- Check Node.js ----
where node >nul 2>&1
if errorlevel 1 (
    echo [FAIL] Node.js is NOT installed.
    echo.
    echo Please install Node.js from: https://nodejs.org
    echo After installing, re-run this file.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node --version') do set "NODE_VER=%%v"
echo [OK]   Node.js %NODE_VER%
echo.

:: ---- Install backend dependencies if missing ----
if not exist "%ROOT%\backend\node_modules" (
    echo Installing backend dependencies...
    cd /d "%ROOT%\backend"
    call npm install
    echo.
)

:: ---- Install frontend dependencies if missing ----
if not exist "%ROOT%\frontend\node_modules" (
    echo Installing frontend dependencies...
    cd /d "%ROOT%\frontend"
    call npm install
    echo.
)

:: ---- Start Backend ----
echo Starting BACKEND on port 5000...
start "ACHME Backend" cmd /k "cd /d "%ROOT%\backend" && npm run dev"

:: ---- Start Frontend ----
echo Starting FRONTEND on port 82...
start "ACHME Frontend" cmd /k "cd /d "%ROOT%\frontend" && npm start"

echo.
echo =====================================================
echo              SERVERS STARTED
echo =====================================================
echo.
echo BACKEND : http://localhost:5000
echo FRONTEND: http://localhost:82
echo.
echo Close the CMD windows to stop the servers.
echo =====================================================
echo.

pause
