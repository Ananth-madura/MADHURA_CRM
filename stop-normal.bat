@echo off
setlocal EnableDelayedExpansion
title ACHME Normal Stop

echo =====================================================
echo        Stopping ACHME Servers
echo =====================================================
echo.

:: Kill backend (port 5000)
echo Stopping BACKEND (port 5000)...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":5000 .*LISTENING"') do (
    taskkill /F /PID %%P >nul 2>&1 && echo [OK] Killed PID %%P
)

:: Kill frontend (port 82)
echo Stopping FRONTEND (port 82)...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":82 .*LISTENING"') do (
    taskkill /F /PID %%P >nul 2>&1 && echo [OK] Killed PID %%P
)

echo.
echo Done.
echo.

pause
