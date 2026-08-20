@echo off
setlocal EnableDelayedExpansion
title ACHME CRM Smart Starter

REM =========================================================
REM ACHME CONFIG
REM =========================================================

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

set "FRONTEND_PORT=82"
set "BACKEND_PORT=5000"

set "FRONTEND_DOMAIN=achme.com"
set "BACKEND_DOMAIN=www.achme.com"

REM =========================================================
REM ADMIN CHECK
REM =========================================================

net session >nul 2>&1
if errorlevel 1 (
    echo.
    echo =====================================================
    echo RUN THIS FILE AS ADMINISTRATOR
    echo =====================================================
    echo.
    pause
    exit /b 1
)

cls

echo.
echo =====================================================
echo        ACHME CRM SMART DEV STARTER
echo =====================================================
echo.

call :detect_ip
if errorlevel 1 goto fail

call :update_hosts
if errorlevel 1 goto fail

call :flush_dns

call :write_backend_env
if errorlevel 1 goto fail

call :write_frontend_env
if errorlevel 1 goto fail

call :kill_port %BACKEND_PORT%
call :kill_port %FRONTEND_PORT%

call :open_firewall

echo.
echo =====================================================
echo STARTING BACKEND
echo =====================================================
echo.

start "ACHME Backend" cmd /k ^
"cd /d ""%ROOT%\backend"" && npm install && npm run dev"

ping -n 6 127.0.0.1 >nul

echo.
echo =====================================================
echo STARTING FRONTEND
echo =====================================================
echo.

start "ACHME Frontend" cmd /k ^
"cd /d ""%ROOT%\frontend"" && npm install && npx cross-env HOST=0.0.0.0 PORT=%FRONTEND_PORT% react-scripts start"

echo.
echo =====================================================
echo              SERVERS STARTED
echo =====================================================
echo.
echo FRONTEND URL:
echo    http://%FRONTEND_DOMAIN%:%FRONTEND_PORT%
echo.
echo BACKEND URL:
echo    http://%BACKEND_DOMAIN%:%BACKEND_PORT%
echo.
echo LAN IP:
echo    %LAN_IP%
echo.
echo LOGIN:
echo    Kk@achmecommunication.com
echo    kk@admin@123
echo.
echo =====================================================
echo.

pause
exit /b 0

REM =====================================================
REM DETECT CURRENT ACTIVE IP
REM =====================================================

:detect_ip

echo [1/7] Detecting active LAN IP...

set "LAN_IP="

for /f %%i in ('
powershell -NoProfile -ExecutionPolicy Bypass ^
"(Get-NetIPAddress -AddressFamily IPv4 ^| Where-Object {$_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.InterfaceAlias -notmatch 'vEthernet^|Loopback^|Bluetooth'} ^| Select-Object -First 1 -ExpandProperty IPAddress)"
') do (
    set "LAN_IP=%%i"
)

if "%LAN_IP%"=="" (
    echo FAILED TO DETECT IP
    exit /b 1
)

echo.
echo ACTIVE IP: %LAN_IP%

:: Query and display network IP static vs dynamic status
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$adapter = Get-NetIPInterface -AddressFamily IPv4 | Where-Object { $_.ConnectionState -eq 'Connected' -and $_.InterfaceAlias -notmatch 'Loopback|vEthernet|Virtual|Bluetooth' } | Select-Object -First 1;" ^
  "if ($adapter.Dhcp -eq 'Disabled') {" ^
  "  Write-Host 'IP STATUS: STATIC (IP Frozen - Safe for Employees)' -ForegroundColor Green" ^
  "} else {" ^
  "  Write-Host 'IP STATUS: DYNAMIC (DHCP - Might change! Run manage-local-ip.bat as Admin to freeze it)' -ForegroundColor Yellow" ^
  "}"
echo.

exit /b 0

REM =====================================================
REM UPDATE HOSTS FILE
REM =====================================================

:update_hosts

echo [2/7] Updating hosts file...

set "HOSTS=%SystemRoot%\System32\drivers\etc\hosts"
set "TEMP=%TEMP%\hosts_temp"

powershell -Command ^
"(Get-Content '%HOSTS%') ^| Where-Object {$_ -notmatch '\bachme\.com\b'} ^| Set-Content '%TEMP%'"

copy /Y "%TEMP%" "%HOSTS%" >nul
del "%TEMP%" >nul 2>&1

echo. >> "%HOSTS%"
echo %LAN_IP% %FRONTEND_DOMAIN% %BACKEND_DOMAIN% >> "%HOSTS%"

echo.
echo HOSTS UPDATED:
echo    %FRONTEND_DOMAIN% %BACKEND_DOMAIN%  -> %LAN_IP%
echo.

exit /b 0

REM =====================================================
REM FLUSH DNS
REM =====================================================

:flush_dns

echo [3/7] Flushing DNS...

ipconfig /flushdns >nul

echo DNS cache cleared.
echo.

exit /b 0

REM =====================================================
REM BACKEND ENV
REM =====================================================

:write_backend_env

echo [4/7] Writing backend .env...

(
echo PORT=%BACKEND_PORT%
echo HOST=0.0.0.0
echo NODE_ENV=development
echo.
echo ALLOWED_ORIGIN=http://%FRONTEND_DOMAIN%:%FRONTEND_PORT%
echo.
echo DB_HOST=127.0.0.1
echo DB_PORT=3306
echo DB_USER=achme_user
echo DB_PASS=AchmeSecure@2024
echo DB_NAME=achme
echo.
echo JWT_SECRET=CHANGE_THIS_SECRET
echo.
echo SMTP_HOST=smtp.gmail.com
echo SMTP_PORT=587
echo EMAIL_USER=yourmail@gmail.com
echo EMAIL_PASS=yourpassword
) > "%ROOT%\backend\.env"

echo Backend .env updated.
echo.

exit /b 0

REM =====================================================
REM FRONTEND ENV
REM =====================================================

:write_frontend_env

echo [5/7] Writing frontend .env...

(
echo HOST=0.0.0.0
echo PORT=%FRONTEND_PORT%
echo.
echo REACT_APP_API_URL=http://%BACKEND_DOMAIN%:%BACKEND_PORT%
echo REACT_APP_API_PROXY=http://%BACKEND_DOMAIN%:%BACKEND_PORT%
) > "%ROOT%\frontend\.env"

echo Frontend .env updated.
echo.

exit /b 0

REM =====================================================
REM OPEN FIREWALL
REM =====================================================

:open_firewall

echo [6/7] Opening firewall ports...

netsh advfirewall firewall add rule ^
name="ACHME Backend %BACKEND_PORT%" ^
dir=in action=allow protocol=TCP localport=%BACKEND_PORT% >nul 2>&1

netsh advfirewall firewall add rule ^
name="ACHME Frontend %FRONTEND_PORT%" ^
dir=in action=allow protocol=TCP localport=%FRONTEND_PORT% >nul 2>&1

echo Firewall updated.
echo.

exit /b 0

REM =====================================================
REM KILL EXISTING PORTS
REM =====================================================

:kill_port

set "PORT=%~1"

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
    taskkill /F /PID %%P >nul 2>&1
)

exit /b 0

REM =====================================================
REM FAIL
REM =====================================================

:fail

echo.
echo =====================================================
echo SETUP FAILED
echo =====================================================
echo.

pause
exit /b 1