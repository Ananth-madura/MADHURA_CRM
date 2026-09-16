@echo off
title Start MySQL Server (Madhura CRM)
color 0A

:: Request Administrator Privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ========================================================
    echo Requesting Administrator permission to start MySQL80...
    echo ========================================================
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo [1/3] Disabling conflicting duplicate MySQL service...
sc.exe config MySQL start= disabled >nul 2>&1

echo [2/3] Setting MySQL80 to Automatic startup with Auto-Recovery...
sc.exe config MySQL80 start= auto >nul 2>&1
sc.exe failure MySQL80 reset= 86400 actions= restart/5000/restart/10000/restart/60000 >nul 2>&1

echo [3/3] Starting MySQL80 service...
net start MySQL80

echo.
echo ========================================================
sc.exe query MySQL80 | findstr /I "STATE"
echo ========================================================
echo MySQL is now RUNNING!
echo You can run 'npm run dev' in your backend now.
echo ========================================================
timeout /t 5
