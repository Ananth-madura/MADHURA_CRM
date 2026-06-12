@echo off
setlocal enabledelayedexpansion
title ACHME CRM - Employee Device Setup
color 0A

:: ================================================================
:: ACHME CRM - EMPLOYEE DEVICE SETUP (PowerShell-Free Version)
::
:: Run this on each EMPLOYEE's PC:
::   Right-click -> Run as Administrator
::
:: What this does:
::   1. Finds the ACHME server on your LAN automatically
::   2. Updates your hosts file so http://achme.com works
::   3. Tests connectivity to the server
:: ================================================================

cls
echo.
echo  ================================================================
echo   ACHME CRM - EMPLOYEE DEVICE SETUP
echo  ================================================================
echo.

:: ---- Auto-elevate to Admin if needed ----
net session >nul 2>&1
if errorlevel 1 (
    echo   Requesting Administrator privileges...
    mshta vbscript:CreateObject("Shell.Application").ShellExecute("""%~f0""","","","runas",1)(window.close)
    exit /b 0
)

:: ================================================================
:: STEP 1: Detect server IP
:: ================================================================
echo  [1/4] Finding ACHME CRM Server on your network...
echo.

:: The ACHME server's fixed IP on your LAN:
set "SERVER_IP=192.168.50.113"

:: Try to read the server IP from a cached file (if running from network share)
if exist "%~dp0.last-build-ip" (
    set /p CACHED_IP=<"%~dp0.last-build-ip"
    set "CACHED_IP=!CACHED_IP: =!"
    if not "!CACHED_IP!"=="" (
        if not "!CACHED_IP!"=="127.0.0.1" (
            set "SERVER_IP=192.168.50.113"
            echo   Using IP from server cache: !SERVER_IP!
            goto :test_server
        )
    )
)

:: Quick ping test to confirm server is reachable
:test_server
echo   Testing server at http://%SERVER_IP%:82 ...
curl.exe -s --max-time 5 http://%SERVER_IP%:82/nginx-health >nul 2>&1
if not errorlevel 1 (
    echo   Server found at %SERVER_IP% [OK]
    goto :update_hosts
)

echo   [WARN] Server not responding at %SERVER_IP%
echo.
echo   Scanning your local network for the ACHME server...

:: Scan the subnet - find which 192.168.x.x has port 82 open
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /R /C:"IPv4 Address" ^| findstr /V "127" ^| findstr /V "169.254"') do (
    set "MY_IP=%%i"
    set "MY_IP=!MY_IP: =!"
    if not "!MY_IP!"=="" goto :got_my_ip
)
:got_my_ip
if "%MY_IP%"=="" set "MY_IP=192.168.50.1"

:: Extract subnet prefix (first 3 octets)
for /f "tokens=1-3 delims=." %%a in ("%MY_IP%") do set "SUBNET=%%a.%%b.%%c"
echo   Scanning subnet %SUBNET%.1-254 (this takes ~20 seconds)...
echo.

set "FOUND_IP="
for /l %%i in (1,1,254) do (
    curl.exe -s --max-time 1 http://%SUBNET%.%%i:82/nginx-health 2>nul | findstr "Nginx OK" >nul 2>&1
    if not errorlevel 1 (
        if "!FOUND_IP!"=="" (
            set "FOUND_IP=%SUBNET%.%%i"
            echo   Found ACHME Server at: %SUBNET%.%%i [OK]
        )
    )
)

if not "%FOUND_IP%"=="" (
    set "SERVER_IP=192.168.50.113"
) else (
    echo.
    echo   [WARN] Auto-detection failed. Using default: %SERVER_IP%
    echo.
    echo   If this is wrong, type the correct server IP and press Enter.
    echo   (Ask your IT admin for the server IP address)
    echo.
    set /p "USER_IP=Server IP (press ENTER for %SERVER_IP%): "
    if not "!USER_IP!"=="" set "SERVER_IP=192.168.50.113"
)

:: ================================================================
:: STEP 2: Update hosts file
:: ================================================================
:update_hosts
echo.
echo  [2/4] Updating hosts file for Server IP: %SERVER_IP%

set "HOSTS=%SystemRoot%\System32\drivers\etc\hosts"

:: Remove old ACHME entries
set "TEMP_HOSTS=%TEMP%\achme_hosts_temp.txt"
if exist "%TEMP_HOSTS%" del "%TEMP_HOSTS%" >nul 2>&1

:: Filter out old ACHME entries and write to temp
for /f "delims=" %%l in ('type "%HOSTS%" ^| findstr /V /I /C:"achme.com" /C:"IBM-SERVER" /C:"ACHME CRM"') do (
    echo %%l>> "%TEMP_HOSTS%"
)

:: Append new entries
echo.>> "%TEMP_HOSTS%"
echo # ACHME CRM Employee Setup - %DATE%>> "%TEMP_HOSTS%"
echo %SERVER_IP%    achme.com    www.achme.com>> "%TEMP_HOSTS%"
echo %SERVER_IP%    IBM-SERVER   IBM-SERVER.achme.com>> "%TEMP_HOSTS%"

:: Replace hosts file
copy /y "%TEMP_HOSTS%" "%HOSTS%" >nul 2>&1
if errorlevel 1 (
    echo   [FAIL] Could not update hosts file. Make sure you ran as Administrator!
    pause
    exit /b 1
)
del "%TEMP_HOSTS%" >nul 2>&1
echo   Hosts file updated. [OK]

:: ================================================================
:: STEP 3: Flush DNS
:: ================================================================
echo.
echo  [3/4] Flushing DNS cache...
ipconfig /flushdns >nul 2>&1
echo   DNS cache flushed. [OK]

:: ================================================================
:: STEP 4: Test connectivity
:: ================================================================
echo.
echo  [4/4] Testing connectivity...
echo.

:: Direct IP test
curl.exe -s --max-time 8 http://%SERVER_IP%:82/nginx-health >nul 2>&1
if errorlevel 1 (
    echo   [!!] http://%SERVER_IP%:82  - NOT REACHABLE
    echo        Check: Is the server PC on? Is it on the same WiFi/LAN?
) else (
    echo   [OK] http://%SERVER_IP%:82  - REACHABLE
)

:: Domain name test
curl.exe -s --max-time 8 http://achme.com:82/nginx-health >nul 2>&1
if errorlevel 1 (
    echo   [!!] http://achme.com:82   - NOT REACHABLE (hosts may need flush)
) else (
    echo   [OK] http://achme.com:82   - REACHABLE
)

:: ================================================================
:: DONE
:: ================================================================
echo.
echo  ================================================================
echo   SETUP COMPLETE!
echo.
echo   Open your browser and go to:
echo.
echo     http://%SERVER_IP%:82        (Direct IP - ALWAYS works)
echo     http://achme.com             (After setup - works on this PC)
echo.
echo   Login: Ask your admin for username + password
echo  ================================================================
echo.

:: Register auto-sync task
echo   Would you like this to auto-update on every login?
echo   (Useful if the server IP changes)
echo.
set /p "DO_TASK=Enable auto-sync on logon? (Y/N): "
if /I "%DO_TASK%"=="Y" (
    schtasks /delete /tn "ACHME_CRM_Client_Sync" /f >nul 2>&1
    schtasks /create /tn "ACHME_CRM_Client_Sync" /tr "\"%~f0\"" /sc onlogon /rl HIGHEST /f >nul 2>&1
    if not errorlevel 1 (
        echo   [OK] Auto-sync registered - will update on every login.
    ) else (
        echo   [WARN] Could not register task.
    )
)

echo.
pause
exit /b 0
