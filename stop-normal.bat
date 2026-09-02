@echo off
setlocal EnableDelayedExpansion
title Madhura Tech CRM - Stop Servers
color 0C

echo =====================================================
echo          Stopping Madhura Tech CRM Servers
echo =====================================================
echo.

:: Kill backend (port 5000)
echo Stopping BACKEND (port 5000)...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":5000 .*LISTENING"') do (
    taskkill /F /PID %%P >nul 2>&1 && echo [OK] Stopped Backend PID %%P
)

:: Kill frontend (port 3000)
echo Stopping FRONTEND (port 3000)...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":3000 .*LISTENING"') do (
    taskkill /F /PID %%P >nul 2>&1 && echo [OK] Stopped Frontend PID %%P
)

:: Kill frontend (port 82)
echo Stopping FRONTEND (port 82)...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":82 .*LISTENING"') do (
    taskkill /F /PID %%P >nul 2>&1 && echo [OK] Stopped Frontend PID %%P
)

echo.
echo [OK] All CRM servers stopped.
echo.

pause
