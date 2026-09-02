@echo off
setlocal EnableDelayedExpansion
title Madhura Tech CRM - Quickstart

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

echo =====================================================
echo        MADHURA TECH CRM - QUICKSTART LAUNCHER
echo =====================================================
echo.

:: ---- Check Node.js ----
where node >nul 2>&1
if errorlevel 1 (
    echo [FAIL] Node.js is NOT installed.
    echo.
    echo Please install Node.js (LTS version) from: https://nodejs.org
    echo After installing, re-run this file.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node --version') do set "NODE_VER=%%v"
echo [OK]   Node.js %NODE_VER% detected.
echo.

:: ---- Ensure Runtime Directories Exist ----
if not exist "%ROOT%\backend\uploads" mkdir "%ROOT%\backend\uploads"
if not exist "%ROOT%\backend\uploads\wa-media" mkdir "%ROOT%\backend\uploads\wa-media"
if not exist "%ROOT%\whatsapp-sessions" mkdir "%ROOT%\whatsapp-sessions"
if not exist "%ROOT%\logs" mkdir "%ROOT%\logs"

:: ---- Ensure Backend .env Exists ----
if not exist "%ROOT%\backend\.env" (
    echo [INFO] Backend .env not found. Creating from .env.example...
    if exist "%ROOT%\backend\.env.example" (
        copy "%ROOT%\backend\.env.example" "%ROOT%\backend\.env" >nul
        echo [OK]   Backend .env created successfully.
    ) else (
        (
        echo PORT=5000
        echo NODE_ENV=development
        echo DB_HOST=127.0.0.1
        echo DB_PORT=3306
        echo DB_USER=root
        echo DB_PASS=
        echo DB_NAME=madhura_crm
        echo JWT_SECRET=madhura_tech_super_secret_jwt_key_2026
        ) > "%ROOT%\backend\.env"
        echo [OK]   Default backend .env generated.
    )
    echo.
)

:: ---- Ensure Frontend .env Exists ----
if not exist "%ROOT%\frontend\.env" (
    (
    echo REACT_APP_API_URL=
    echo REACT_APP_API_PROXY=http://127.0.0.1:5000
    ) > "%ROOT%\frontend\.env"
)

:: ---- Install backend dependencies if missing ----
if not exist "%ROOT%\backend\node_modules" (
    echo Installing backend dependencies (this may take a minute)...
    cd /d "%ROOT%\backend"
    call npm install --legacy-peer-deps
    if errorlevel 1 (
        echo [WARN] Initial npm install had warnings, applying patches...
    )
    call npx patch-package
    echo [OK]   Backend dependencies installed.
    echo.
) else (
    echo [OK]   Backend node_modules found.
    cd /d "%ROOT%\backend"
    call npx patch-package
)

:: ---- Install frontend dependencies if missing ----
if not exist "%ROOT%\frontend\node_modules" (
    echo Installing frontend dependencies...
    cd /d "%ROOT%\frontend"
    call npm install --legacy-peer-deps
    echo [OK]   Frontend dependencies installed.
    echo.
) else (
    echo [OK]   Frontend node_modules found.
)

echo.
echo =====================================================
echo              STARTING APPLICATION SERVERS
echo =====================================================
echo.

:: ---- Start Backend ----
echo Starting BACKEND on port 5000...
start "Madhura Tech Backend" cmd /k "cd /d "%ROOT%\backend" && npm run dev"

:: ---- Start Frontend ----
echo Starting FRONTEND on port 3000...
start "Madhura Tech Frontend" cmd /k "cd /d "%ROOT%\frontend" && npm start"

echo.
echo =====================================================
echo              MADHURA TECH CRM ONLINE
echo =====================================================
echo.
echo   ► FRONTEND UI : http://localhost:3000
echo   ► BACKEND API : http://localhost:5000
echo.
echo Keep the opened CMD windows running while using the CRM.
echo =====================================================
echo.

pause
