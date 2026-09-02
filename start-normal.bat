@echo off
setlocal EnableDelayedExpansion
title Madhura Tech CRM - Quickstart Launcher
color 0B

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
cd /d "%ROOT%"

echo =====================================================
echo        MADHURA TECH CRM - QUICKSTART LAUNCHER
echo =====================================================
echo.

:: ---- Step 1: Check Node.js ----
echo [1/6] Checking Node.js runtime...
where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo [FAIL] Node.js is NOT installed or not in system PATH.
    echo.
    echo Please install Node.js LTS from: https://nodejs.org
    echo After installing, re-run this launcher.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node --version 2^>nul') do set "NODE_VER=%%v"
echo [OK]   Node.js %NODE_VER% detected.
echo.

:: ---- Step 2: Check MySQL Database ----
echo [2/6] Checking MySQL Database status...
set "MYSQL_ACTIVE=0"
netstat -ano | findstr ":3306 " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 set "MYSQL_ACTIVE=1"

if "%MYSQL_ACTIVE%"=="0" (
    echo [INFO] MySQL is not running on port 3306. Attempting to start service...
    net start MySQL80 >nul 2>&1
    net start MySQL >nul 2>&1
    net start MySQL84 >nul 2>&1
    net start MySQL57 >nul 2>&1
    net start MySQL90 >nul 2>&1
    net start mysql >nul 2>&1
    net start MariaDB >nul 2>&1
    
    ping -n 4 127.0.0.1 >nul
    netstat -ano | findstr ":3306 " | findstr "LISTENING" >nul 2>&1
    if not errorlevel 1 set "MYSQL_ACTIVE=1"
)

if "%MYSQL_ACTIVE%"=="1" (
    echo [OK]   MySQL is running on port 3306.
) else (
    echo [WARN] MySQL is not detected on port 3306.
    echo        Please ensure MySQL Server or XAMPP is running if database connection fails.
)
echo.

:: ---- Step 3: Ensure Directories & Environment Files ----
echo [3/6] Verifying project directories and configuration...
if not exist "%ROOT%\backend\uploads" mkdir "%ROOT%\backend\uploads"
if not exist "%ROOT%\backend\uploads\wa-media" mkdir "%ROOT%\backend\uploads\wa-media"
if not exist "%ROOT%\whatsapp-sessions" mkdir "%ROOT%\whatsapp-sessions"
if not exist "%ROOT%\logs" mkdir "%ROOT%\logs"

if not exist "%ROOT%\backend\.env" (
    echo [INFO] Backend .env not found. Creating from template...
    if exist "%ROOT%\backend\.env.example" (
        copy "%ROOT%\backend\.env.example" "%ROOT%\backend\.env" >nul
        echo [OK]   Backend .env created from .env.example.
    ) else (
        (
        echo PORT=5000
        echo NODE_ENV=development
        echo ALLOWED_ORIGIN=*
        echo DEFAULT_TEST_PASSWORD=Test@12345
        echo DB_HOST=127.0.0.1
        echo DB_PORT=3306
        echo DB_USER=achme_user
        echo DB_PASS=AchmeSecure@2024
        echo DB_NAME=achme
        echo JWT_SECRET=madhura_tech_super_secret_jwt_key_2026
        ) > "%ROOT%\backend\.env"
        echo [OK]   Default backend .env generated.
    )
) else (
    echo [OK]   Backend .env verified.
)

if not exist "%ROOT%\frontend\.env" (
    (
    echo REACT_APP_API_URL=
    echo REACT_APP_API_PROXY=http://127.0.0.1:5000
    ) > "%ROOT%\frontend\.env"
    echo [OK]   Frontend .env created.
) else (
    echo [OK]   Frontend .env verified.
)
echo.

:: ---- Step 4: Check and Install Dependencies ----
echo [4/6] Checking dependencies...
if not exist "%ROOT%\backend\node_modules" (
    echo [INFO] Installing backend dependencies - please wait...
    cd /d "%ROOT%\backend"
    call npm.cmd install --legacy-peer-deps
    if exist "%ROOT%\backend\patches" (
        call npx.cmd patch-package >nul 2>&1
    )
    echo [OK]   Backend dependencies installed.
) else (
    echo [OK]   Backend dependencies found.
    if exist "%ROOT%\backend\patches" (
        cd /d "%ROOT%\backend"
        call npx.cmd patch-package >nul 2>&1
    )
)

if not exist "%ROOT%\frontend\node_modules" (
    echo [INFO] Installing frontend dependencies - please wait...
    cd /d "%ROOT%\frontend"
    call npm.cmd install --legacy-peer-deps
    echo [OK]   Frontend dependencies installed.
) else (
    echo [OK]   Frontend dependencies found.
)
echo.

:: ---- Step 5: Free Ports 5000 and 3000 ----
echo [5/6] Checking and preparing network ports...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":5000 .*LISTENING"') do (
    echo [INFO] Releasing busy port 5000 ^(PID %%P^)...
    taskkill /F /PID %%P >nul 2>&1
)
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":3000 .*LISTENING"') do (
    echo [INFO] Releasing busy port 3000 ^(PID %%P^)...
    taskkill /F /PID %%P >nul 2>&1
)

:: Detect LAN IP
set "LAN_IP=127.0.0.1"
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /R /C:"IPv4 Address" ^| findstr /V "127\.0\." ^| findstr /V "169\.254\."') do (
    set "CANDIDATE=%%i"
    set "CANDIDATE=!CANDIDATE: =!"
    if not "!CANDIDATE!"=="" (
        set "LAN_IP=!CANDIDATE!"
        goto :got_lan_ip
    )
)
:got_lan_ip
echo [OK]   Ports 5000 and 3000 are ready.
echo.

:: ---- Step 6: Launch Servers ----
echo [6/6] Starting Application Servers...
echo Starting BACKEND on port 5000...
start "Madhura Tech Backend" /D "%ROOT%\backend" cmd /k "npm run dev"

ping -n 3 127.0.0.1 >nul

echo Starting FRONTEND on port 3000...
start "Madhura Tech Frontend" /D "%ROOT%\frontend" cmd /k "npm start"

echo.
echo =====================================================
echo              MADHURA TECH CRM ONLINE
echo =====================================================
echo.
echo   ► Local UI       : http://localhost:3000
if not "%LAN_IP%"=="127.0.0.1" (
    echo   ► LAN Network UI : http://%LAN_IP%:3000
)
echo   ► Backend API    : http://localhost:5000
echo.
echo   (Both Backend and Frontend servers are running in
echo    separate CMD windows. Keep them open while using CRM.)
echo.
echo =====================================================
echo.

pause
