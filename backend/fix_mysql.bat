@echo off
:: Batch script to permanently fix duplicate MySQL services and start MySQL80
title Fix and Start MySQL Service - Madhura CRM

:: Check for administrative privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ===================================================
    echo Requesting Administrator privileges to start MySQL...
    echo ===================================================
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo [1/4] Stopping any conflicting MySQL instances...
net stop MySQL >nul 2>&1

echo [2/4] Disabling duplicate 'MySQL' service to prevent future conflicts...
sc.exe config MySQL start= disabled >nul 2>&1

echo [3/4] Configuring 'MySQL80' service with automatic startup and recovery...
sc.exe config MySQL80 start= auto
sc.exe failure MySQL80 reset= 86400 actions= restart/5000/restart/10000/restart/60000

echo [4/4] Starting MySQL80 service...
net start MySQL80

echo.
echo ===================================================
echo Verifying MySQL service status...
sc.exe query MySQL80 | findstr /I "STATE"
echo ===================================================
echo MySQL has been permanently fixed and started!
timeout /t 3 >nul
