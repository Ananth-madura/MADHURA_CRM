@echo off
setlocal enabledelayedexpansion
title ACHME CRM - Convert Device to Client
color 0A

:: STEP 1: Verify and request Administrator privileges
net session >nul 2>&1
if not errorlevel 1 (
    goto :admin_authenticated
)

echo.
echo  ================================================================
echo   ELEVATING TO ADMINISTRATOR PRIVILEGES...
echo   Required to restore DHCP, disable local tasks, and configure DNS.
echo  ================================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Start-Process -FilePath '%~f0' -Verb RunAs -ErrorAction Stop } catch { exit 1 }"
if errorlevel 1 (
    echo.
    echo ====================================================================
    echo ERROR: ACCESS DENIED! Administrator privileges are required.
    echo Please accept the UAC prompt to run this script.
    echo ====================================================================
    echo.
    pause
    exit /b 1
)
exit /b 0

:admin_authenticated
cd /d "%~dp0"
set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

echo ====================================================================
echo  ACHME CRM - CLIENT CONVERSION UTILITY
echo ====================================================================
echo.
echo  This tool will convert this computer into a Client machine. 
echo  It will restore your dynamic network settings, clean up background 
echo  server tasks, and map http://achme.com to the main server PC.
echo.

:: Get Server IP from user
set "DEFAULT_IP=192.168.0.115"
set /p "SERVER_IP=Enter the CRM Server's Static IP (Default: %DEFAULT_IP%): "
if "%SERVER_IP%"=="" set "SERVER_IP=%DEFAULT_IP%"

echo.
echo  --------------------------------------------------------------------
echo  Converting this machine to Client for Server IP: %SERVER_IP%
echo  --------------------------------------------------------------------
echo.

:: 1. Revert Adapter to DHCP
echo  [1/5] Reverting local network adapter to Dynamic (DHCP)...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$adapter = Get-NetIPInterface -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback|vEthernet|Virtual|Bluetooth' } | Select-Object -First 1;" ^
  "if ($adapter) {" ^
  "  Set-NetIPInterface -InterfaceIndex $adapter.InterfaceIndex -Dhcp Enabled -ErrorAction SilentlyContinue;" ^
  "  Set-DnsClientServerAddress -InterfaceIndex $adapter.InterfaceIndex -ResetServerAddresses -ErrorAction SilentlyContinue;" ^
  "  Restart-NetAdapter -InterfaceIndex $adapter.InterfaceIndex -Confirm:$false -ErrorAction SilentlyContinue;" ^
  "  Write-Host '  [OK] Network adapter reverted to dynamic DHCP!' -ForegroundColor Green;" ^
  "} else {" ^
  "  Write-Host '  [WARN] Active adapter not found to revert.' -ForegroundColor Yellow;" ^
  "}"
echo.

:: 2. Stop and Delete local Server Services
echo  [2/5] Stopping and cleaning up local server services (PM2 & Nginx)...
:: Kill local Nginx
taskkill /f /im nginx.exe >nul 2>&1
echo   [OK] Local Nginx stopped.

:: Delete local PM2 process
set "PM2_EXEC=pm2"
where pm2 >nul 2>&1
if not errorlevel 1 (
    call pm2 stop achme-backend >nul 2>&1
    call pm2 delete achme-backend >nul 2>&1
    call pm2 save --silent >nul 2>&1
    echo   [OK] Local PM2 backend service cleared.
) else (
    echo   [OK] PM2 is not installed or not running.
)
echo.

:: 3. Disable Scheduled Startup Tasks
echo  [3/5] Disabling Windows startup auto-run tasks...
schtasks /delete /tn "ACHME_CRM_Boot_Startup" /f >nul 2>&1
schtasks /delete /tn "ACHME_CRM_Logon_Dashboard" /f >nul 2>&1
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
if exist "%STARTUP_DIR%\ACHME CRM Startup.cmd" del "%STARTUP_DIR%\ACHME CRM Startup.cmd" >nul 2>&1
echo   [OK] Windows Boot and Logon tasks completely disabled on this PC.
echo.

:: 4. Update Hosts Mappings to point to Server IP
echo  [4/5] Mapping http://achme.com to CRM Server (%SERVER_IP%)...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$hostsFile = \"$env:SystemRoot\System32\drivers\etc\hosts\"; ^
  $domains = @('achme.com', 'www.achme.com', 'achme-vignesh.local', 'api-achme-vignesh.local'); ^
  $content = Get-Content $hostsFile; ^
  $filtered = $content | Where-Object { $line = $_.Trim(); $match = $false; foreach($d in $domains) { if ($line -match \"\\b$d\\b\") { $match = $true } }; -not $match }; ^
  $newMappings = @( ^
  \"%SERVER_IP%    achme.com    www.achme.com\" ^
  ); ^
  $filtered + $newMappings | Set-Content $hostsFile -Force; ^
  Write-Host '  [OK] Hosts file mapped to CRM server IP successfully!' -ForegroundColor Green;"
echo.

:: 5. Flush DNS resolver cache
echo  [5/5] Flushing DNS resolver cache...
ipconfig /flushdns >nul
echo   [OK] Windows DNS cache flushed.
echo.

echo ====================================================================
echo  SUCCESS! CONVERSION TO CLIENT COMPLETE.
echo ====================================================================
echo.
echo  This machine is now configured as a CLIENT:
echo  1. Local server background services have been stopped.
echo  2. Scheduled auto-start tasks have been removed.
echo  3. Your network card is back in dynamic DHCP mode.
echo  4. Mapped achme.com -> %SERVER_IP%
echo.
echo  You can now access the CRM on the server at:
echo  http://achme.com
echo.
pause
exit /b 0
