@echo off
setlocal enabledelayedexpansion
title ACHME CRM - Quick Restart All Services
color 0B

:: Must be Admin
net session >nul 2>&1
if errorlevel 1 (
    echo Requesting Administrator privileges...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b 0
)

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
set "NGINX_DIR=C:\nginx"
set "BACKEND_DIR=%ROOT%\backend"
set "BACKEND_PORT=5000"

echo.
echo  ============================================================
echo    ACHME CRM - Quick Restart All Services
echo  ============================================================
echo.

:: ---- STEP 1: Start Nginx ----
echo  [1/3] Starting Nginx on port 82...
taskkill /F /IM nginx.exe >nul 2>&1
ping -n 3 127.0.0.1 >nul
start "nginx" /B "%NGINX_DIR%\nginx.exe" -p "%NGINX_DIR%"
ping -n 5 127.0.0.1 >nul
netstat -ano | findstr ":82 " | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo       [FAIL] Nginx not on port 82!
    echo       Check: C:\nginx\logs\error.log
    type "%NGINX_DIR%\logs\error.log" 2>nul
) else (
    echo       Nginx running on port 82. [OK]
)

:: ---- STEP 2: Start Backend via PM2 ----
echo  [2/3] Starting Backend with PM2...
where pm2 >nul 2>&1
if errorlevel 1 (
    echo       PM2 not found! Installing...
    call npm install -g pm2 >nul 2>&1
)

:: Kill any stuck PM2 daemons and restart clean
pm2 kill >nul 2>&1
:: Free backend port if occupied (e.g. by boot task running as SYSTEM)
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":%BACKEND_PORT% .*LISTENING" 2^>nul') do (
    taskkill /F /PID %%P >nul 2>&1
)
ping -n 3 127.0.0.1 >nul

:: Start fresh
cd /d "%BACKEND_DIR%"
pm2 start server.js --name achme-backend --env production >nul 2>&1
pm2 save >nul 2>&1
ping -n 8 127.0.0.1 >nul
pm2 list

:: ---- STEP 3: Verify everything ----
echo.
echo  [3/3] Verifying services...
echo.

:: Nginx
curl.exe -s --max-time 5 http://localhost:82/nginx-health >nul 2>&1
if errorlevel 1 (
    echo    [!!] Nginx (port 82)  - NOT RESPONDING
) else (
    echo    [OK] Nginx (port 82)  - RUNNING
)

:: Backend direct
curl.exe -s --max-time 8 http://localhost:5000/api/health >nul 2>&1
if errorlevel 1 (
    echo    [!!] Backend (port 5000) - NOT RESPONDING
) else (
    echo    [OK] Backend (port 5000) - RUNNING
)

:: Backend via Nginx
curl.exe -s --max-time 8 http://localhost:82/api/health >nul 2>&1
if errorlevel 1 (
    echo    [!!] Nginx-to-Backend proxy - NOT WORKING
) else (
    echo    [OK] Nginx-to-Backend proxy - CONNECTED
)

echo.
echo  ============================================================
echo    Access your CRM: http://localhost:82
echo    Admin Login: Kk@achmecommunication.com / kk@admin@123
echo  ============================================================
echo.
echo  Press any key to close (services keep running in background)
pause >nul
