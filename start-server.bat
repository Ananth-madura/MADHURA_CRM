@echo off
setlocal enabledelayedexpansion
title ACHME CRM - Live Server Auto-Launcher
color 0B

:: STEP 1: Verify and request Administrator privileges
net session >nul 2>&1
if not errorlevel 1 (
    goto :admin_authenticated
)

echo.
echo  ================================================================
echo   ELEVATING TO ADMINISTRATOR PRIVILEGES...
echo   Required to check IP status, lock Static IP, and start Nginx/PM2.
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

echo.
echo ====================================================================
echo  ACHME CRM AUTO-LAUNCHER (WITH STATIC IP FREEZER)
echo ====================================================================
echo.

:: 1. Detect and Freeze LAN IP to Static if Dynamic
echo  [1/4] Checking network adapter IP configuration...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$adapter = Get-NetIPInterface -AddressFamily IPv4 | Where-Object { $_.ConnectionState -eq 'Connected' -and $_.InterfaceAlias -notmatch 'Loopback|vEthernet|Virtual|Bluetooth' } | Select-Object -First 1;" ^
  "if (-not $adapter) { Write-Host '  [FAIL] No active network adapter found!' -ForegroundColor Red; exit 1 };" ^
  "$ipConf = Get-NetIPAddress -InterfaceIndex $adapter.InterfaceIndex -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1;" ^
  "Write-Host '  ➜ Active Adapter:  ' $adapter.InterfaceAlias -ForegroundColor Cyan;" ^
  "Write-Host '  ➜ Active IPv4 IP:  ' $ipConf.IPAddress -ForegroundColor Cyan;" ^
  "if ($adapter.Dhcp -eq 'Enabled') {" ^
  "  Write-Host '  [!] IP is Dynamic (DHCP). Automatically freezing to STATIC to stabilize connections...' -ForegroundColor Yellow;" ^
  "  $gw = (Get-NetRoute -InterfaceIndex $adapter.InterfaceIndex -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Select-Object -First 1).NextHop;" ^
  "  if (-not $gw) { $octets = $ipConf.IPAddress.Split('.'); $gw = \"$($octets[0]).$($octets[1]).$($octets[2]).1\" };" ^
  "  $dns = (Get-DnsClientServerAddress -InterfaceIndex $adapter.InterfaceIndex -AddressFamily IPv4).ServerAddresses;" ^
  "  if (-not $dns) { $dns = @('1.1.1.1', '8.8.8.8') };" ^
  "  Set-NetIPInterface -InterfaceIndex $adapter.InterfaceIndex -Dhcp Disabled -ErrorAction SilentlyContinue;" ^
  "  Remove-NetRoute -InterfaceIndex $adapter.InterfaceIndex -DestinationPrefix '0.0.0.0/0' -Confirm:$false -ErrorAction SilentlyContinue;" ^
  "  Remove-NetIPAddress -InterfaceIndex $adapter.InterfaceIndex -AddressFamily IPv4 -Confirm:$false -ErrorAction SilentlyContinue;" ^
  "  New-NetIPAddress -InterfaceIndex $adapter.InterfaceIndex -IPAddress $ipConf.IPAddress -PrefixLength $ipConf.PrefixLength -DefaultGateway $gw -ErrorAction SilentlyContinue | Out-Null;" ^
  "  Set-DnsClientServerAddress -InterfaceIndex $adapter.InterfaceIndex -ServerAddresses $dns -ErrorAction SilentlyContinue;" ^
  "  Write-Host '  [OK] IP frozen successfully as Static!' -ForegroundColor Green;" ^
  "} else {" ^
  "  Write-Host '  [OK] IP is already STATIC (IP Frozen - Safe for Employees)' -ForegroundColor Green;" ^
  "}"
if errorlevel 1 (
    echo   [WARN] Failed to configure/validate static IP settings. Continuing with active IP...
)

:: 2. Update Hosts DNS Mappings
echo.
echo  [2/4] Updating local DNS hosts mappings...
:: Resolve active LAN IP dynamically
set "ACTIVE_IP="
for /f "usebackq tokens=*" %%I in (
  `powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ip = (Find-NetRoute -RemoteIPAddress '8.8.8.8' -ErrorAction SilentlyContinue | Select-Object -First 1).LocalIPAddress; if (-not $ip) { $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.InterfaceAlias -notmatch 'vEthernet|Loopback|Bluetooth' } | Select-Object -First 1).IPAddress }; $ip"`
) do set "ACTIVE_IP=%%I"

if "%ACTIVE_IP%"=="" set "ACTIVE_IP=127.0.0.1"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$hostsFile = \"$env:SystemRoot\System32\drivers\etc\hosts\";" ^
  "$domains = @('achme.com', 'www.achme.com');" ^
  "$content = Get-Content $hostsFile;" ^
  "$filtered = $content | Where-Object { $line = $_.Trim(); $match = $false; foreach($d in $domains) { if ($line -match \"\\b$d\\b\") { $match = $true } }; -not $match };" ^
  "$newMappings = @(" ^
  "  \"%ACTIVE_IP%    achme.com    www.achme.com\"" ^
  ");" ^
  "$filtered + $newMappings | Set-Content $hostsFile -Force;" ^
  "Write-Host '  [OK] Hosts file mapped to active IP successfully!' -ForegroundColor Green;"

:: Update the employee hosts setup file dynamically with the current active IP
if exist "%ROOT%\employee-hosts-setup.bat" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "(Get-Content '%ROOT%\employee-hosts-setup.bat') -replace 'set \"SERVER_IP=.*\"', 'set \"SERVER_IP=%ACTIVE_IP%\"' | Set-Content '%ROOT%\employee-hosts-setup.bat' -Force;" ^
      "Write-Host '  [OK] employee-hosts-setup.bat updated with active IP.' -ForegroundColor Green;"
)

:: 3. Update Environment .env variables
echo.
echo  [3/4] Updating backend/frontend environment configurations...
:: 1. Update backend env
if exist "%ROOT%\backend\.env" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "$envFile = '%ROOT%\backend\.env';" ^
      "$content = Get-Content $envFile;" ^
      "$updated = $content | ForEach-Object {" ^
      "  if ($_ -match '^ALLOWED_ORIGIN=') {" ^
      "    'ALLOWED_ORIGIN=http://localhost:82,http://%ACTIVE_IP%:82,http://achme.com,http://www.achme.com'" ^
      "  } else {" ^
      "    $_" ^
      "  }" ^
      "};" ^
      "$updated | Set-Content $envFile -Force;" ^
      "Write-Host '  [OK] backend\.env written.' -ForegroundColor Green;"
)

:: 2. Update frontend env
if exist "%ROOT%\frontend\.env" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "$envFile = '%ROOT%\frontend\.env';" ^
      "$content = Get-Content $envFile;" ^
      "$updated = $content | ForEach-Object {" ^
      "  if ($_ -match '^REACT_APP_API_URL=') {" ^
      "    'REACT_APP_API_URL=http://%ACTIVE_IP%:5000'" ^
      "  } elseif ($_ -match '^REACT_APP_API_PROXY=') {" ^
      "    'REACT_APP_API_PROXY=http://%ACTIVE_IP%:5000'" ^
      "  } else {" ^
      "    $_" ^
      "  }" ^
      "};" ^
      "$updated | Set-Content $envFile -Force;" ^
      "Write-Host '  [OK] frontend\.env written.' -ForegroundColor Green;"
)

:: 4. Flush local DNS cache
echo.
echo  [4/4] Flushing local Windows DNS cache...
ipconfig /flushdns >nul
echo   [OK] DNS Cache flushed.
echo.

:: 5. Auto Start Live Nginx & PM2 services
echo ====================================================================
echo  LAUNCHING ACHME CRM PRODUCTION SERVICES...
echo ====================================================================
echo.

if not exist "%ROOT%\start_live_nginx_pm2.bat" (
  echo.
  echo  [FAIL] start_live_nginx_pm2.bat was not found in:
  echo         %ROOT%\start_live_nginx_pm2.bat
  echo.
  pause
  exit /b 1
)

call "%ROOT%\start_live_nginx_pm2.bat"
if errorlevel 1 (
    echo.
    echo  [FAIL] Live Launcher finished with error code %ERRORLEVEL%
    pause
)
exit /b %ERRORLEVEL%
