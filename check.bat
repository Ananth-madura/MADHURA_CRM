@echo off
setlocal enabledelayedexpansion
title ACHME CRM - Backend Diagnostic
color 0E

:: ---- PREVENT AUTO-CLOSE: pause at very top ----
echo  ACHME CRM Diagnostic starting... (window will stay open)
echo.

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
set "BACKEND=%ROOT%\backend"
set "ENV_FILE=%BACKEND%\.env"

cls
echo.
echo  ================================================================
echo    ACHME CRM - BACKEND DIAGNOSTIC
echo    Running 10 checks... please wait
echo  ================================================================
echo.

:: ================================================================
:: CHECK 1 - MySQL port 3306
:: ================================================================
echo  [1] MySQL on port 3306...
netstat -ano | findstr ":3306 " | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo      [FAIL] MySQL NOT running on port 3306
    echo             Fix: Open Services.msc and start MySQL80 or MySQL
) else (
    echo      [OK]   MySQL is running on port 3306
)
echo.

:: ================================================================
:: CHECK 2 - .env file
:: ================================================================
echo  [2] backend\.env file...
if not exist "%ENV_FILE%" (
    echo      [FAIL] backend\.env NOT FOUND
    echo             Fix: Run db.bat first
) else (
    echo      [OK]   backend\.env exists
)
echo.

:: ================================================================
:: CHECK 3 - Show .env values
:: ================================================================
echo  [3] Current backend\.env settings:
if exist "%ENV_FILE%" (
    for /f "usebackq tokens=1,* delims==" %%a in ("%ENV_FILE%") do (
        set "_K=%%a"
        set "_V=%%b"
        if /I "!_K!"=="JWT_SECRET" (
            echo      !_K! = [hidden]
        ) else if /I "!_K!"=="EMAIL_PASS" (
            echo      !_K! = [hidden]
        ) else (
            if not "!_K!"=="" echo      !_K! = !_V!
        )
    )
) else (
    echo      [SKIP] No .env found
)
echo.

:: ================================================================
:: CHECK 4 - Node.js
:: ================================================================
echo  [4] Node.js installed...
where node >nul 2>&1
if errorlevel 1 (
    echo      [FAIL] Node.js NOT found
    echo             Fix: Install from https://nodejs.org
) else (
    for /f "tokens=*" %%v in ('node --version 2^>nul') do echo      [OK]   Node.js %%v
)
echo.

:: ================================================================
:: CHECK 5 - node_modules
:: ================================================================
echo  [5] backend\node_modules...
if not exist "%BACKEND%\node_modules" (
    echo      [FAIL] node_modules NOT found
    echo             Fix: Open CMD in %BACKEND% and run: npm install
) else (
    echo      [OK]   node_modules exists
)
echo.

:: ================================================================
:: CHECK 6 - DB connection test (write a temp .js file - safer than inline)
:: ================================================================
echo  [6] Database connection test (achme_user)...
where node >nul 2>&1
if not errorlevel 1 (
    if exist "%BACKEND%\node_modules" (
        :: Write a tiny test script to temp file
        set "DBTEST=%TEMP%\achme_dbtest_%RANDOM%.js"
        (
            echo var path = require('path');
            echo require('dotenv').config({path: path.join('%BACKEND:\=\\%', '.env')});
            echo var mysql = require('mysql2');
            echo var c = mysql.createConnection({
            echo   host: process.env.DB_HOST || '127.0.0.1',
            echo   port: process.env.DB_PORT || 3306,
            echo   user: process.env.DB_USER,
            echo   password: process.env.DB_PASS,
            echo   database: process.env.DB_NAME,
            echo   connectTimeout: 5000
            echo });
            echo c.connect(function(err) {
            echo   if (err) {
            echo     console.log('DBFAIL: ' + err.message);
            echo     process.exit(1);
            echo   }
            echo   console.log('DBOK: Connected as ' + process.env.DB_USER + ' to database: ' + process.env.DB_NAME);
            echo   c.end();
            echo   process.exit(0);
            echo });
        ) > "!DBTEST!"
        
        cd /d "%BACKEND%"
        node "!DBTEST!" > "%TEMP%\achme_dbresult.txt" 2>&1
        set "DBERRCODE=!errorlevel!"
        del "!DBTEST!" >nul 2>&1
        
        set /p DBOUT=<"%TEMP%\achme_dbresult.txt"
        del "%TEMP%\achme_dbresult.txt" >nul 2>&1
        
        echo !DBOUT! | findstr "DBOK" >nul 2>&1
        if not errorlevel 1 (
            echo      [OK]   !DBOUT!
        ) else (
            echo      [FAIL] !DBOUT!
            echo.
            echo      Common fixes:
            echo        - Run db.bat to create DB user
            echo        - Check DB_USER and DB_PASS in backend\.env
            echo        - Make sure DB_NAME=achme in backend\.env
        )
    ) else (
        echo      [SKIP] node_modules missing
    )
) else (
    echo      [SKIP] Node.js not found
)
echo.

:: ================================================================
:: CHECK 7 - Port 5000 (backend)
:: ================================================================
echo  [7] Backend on port 5000...
netstat -ano | findstr ":5000 " | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo      [FAIL] Nothing on port 5000 - backend NOT running
    echo             Fix: Run start-servers.bat
    echo             OR:  Open CMD in %BACKEND% and run: node server.js
) else (
    echo      [OK]   Port 5000 is LISTENING
)
echo.

:: ================================================================
:: CHECK 8 - Backend HTTP health check
:: ================================================================
echo  [8] Backend API health (http://localhost:5000/api/health)...
curl.exe -s --max-time 6 http://localhost:5000/api/health > "%TEMP%\achme_hc.txt" 2>nul
if errorlevel 1 (
    echo      [FAIL] Backend did not respond
    echo             Fix: Start backend first (check 7)
) else (
    set /p HC=<"%TEMP%\achme_hc.txt"
    echo      [OK]   Response: !HC!
)
del "%TEMP%\achme_hc.txt" >nul 2>&1
echo.

:: ================================================================
:: CHECK 9 - PM2
:: ================================================================
echo  [9] PM2 backend status...
where pm2 >nul 2>&1
if errorlevel 1 (
    echo      [INFO] PM2 not installed (OK if using start-servers.bat)
) else (
    pm2 list 2>nul | findstr "achme-backend" >nul 2>&1
    if errorlevel 1 (
        echo      [WARN] achme-backend not in PM2
        echo             Fix: cd %BACKEND% and run: pm2 start server.js --name achme-backend
    ) else (
        pm2 list 2>nul | findstr "achme-backend" | findstr "online" >nul 2>&1
        if not errorlevel 1 (
            echo      [OK]   achme-backend is ONLINE in PM2
        ) else (
            echo      [FAIL] achme-backend is in PM2 but NOT online
            echo             Fix: pm2 restart achme-backend
        )
    )
)
echo.

:: ================================================================
:: CHECK 10 - PM2 error logs
:: ================================================================
echo  [10] Recent backend error logs...
where pm2 >nul 2>&1
if not errorlevel 1 (
    echo       --- PM2 logs (last 10 lines) ---
    pm2 logs achme-backend --lines 10 --nostream 2>nul
) else (
    if exist "%BACKEND%\logs\err.log" (
        echo       --- backend\logs\err.log ---
        type "%BACKEND%\logs\err.log" 2>nul
    ) else (
        echo      [INFO] No log files found
    )
)
echo.

:: ================================================================
:: SUMMARY
:: ================================================================
echo.
echo  ================================================================
echo    QUICK FIX ORDER (if things are failing):
echo.
echo    STEP 1: Double-click db.bat        (creates database)
echo    STEP 2: Double-click start-servers.bat  (starts everything)
echo    STEP 3: Double-click check.bat     (verify all OK)
echo.
echo    If DB connection fails specifically:
echo      Open CMD as Admin in %BACKEND%
echo      Run: node ensure_db_user.js
echo      Then: node server.js
echo      Look at the RED error text - that is the exact problem.
echo  ================================================================
echo.
echo  Press any key to close...
pause >nul
