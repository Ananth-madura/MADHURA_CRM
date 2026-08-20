@echo off
setlocal enabledelayedexpansion
title ACHME CRM - Local IP and DNS Manager
color 0B

:: ====================================================================
:: ACHME CRM — LOCAL IP & DNS MANAGEMENT UTILITY
::
:: Usage:
::   manage-local-ip.bat                  — Interactive menu
::   manage-local-ip.bat /silent          — Auto freeze + update everything
::   manage-local-ip.bat /update-hosts-only — Only update hosts file silently
:: ====================================================================

set "SILENT_MODE=0"
set "HOSTS_ONLY=0"
if /I "%~1"=="/silent" set "SILENT_MODE=1"
if /I "%~1"=="/update-hosts-only" set "HOSTS_ONLY=1"

:: ----------------------------------------------------------------
:: Admin check - silently elevate if needed
:: ----------------------------------------------------------------
net session >nul 2>&1
if not errorlevel 1 (
  goto :admin_authenticated
)

if "%SILENT_MODE%"=="1" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Start-Process -FilePath '%~f0' -ArgumentList '/silent' -Verb RunAs -WindowStyle Hidden -ErrorAction Stop } catch { exit 1 }"
  if errorlevel 1 (
    echo ERROR: Administrator privileges are required, but elevation was denied or failed. >> "%LOG_DIR%\manage-local-ip-silent.log" 2>&1
  )
  exit /b 0
)
if "%HOSTS_ONLY%"=="1" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Start-Process -FilePath '%~f0' -ArgumentList '/update-hosts-only' -Verb RunAs -WindowStyle Hidden -ErrorAction Stop } catch { exit 1 }"
  if errorlevel 1 (
    echo ERROR: Administrator privileges are required, but elevation was denied or failed. >> "%LOG_DIR%\manage-local-ip-silent.log" 2>&1
  )
  exit /b 0
)

echo.
echo  ================================================================
echo   ELEVATING TO ADMINISTRATOR PRIVILEGES...
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
set "LOG_DIR=%ROOT%\logs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

:: ---- Route based on mode ----
if "%SILENT_MODE%"=="1" goto :silent_freeze
if "%HOSTS_ONLY%"=="1" goto :hosts_only_mode

:: ====================================================================
:: INTERACTIVE MENU MODE
:: ====================================================================
:menu
cls
echo ==========================================================================================
echo   ACHME CRM - LOCAL IP STATIC FREEZER & DNS MANAGER
echo ==========================================================================================
echo.
echo   Dynamic IPs change every time you switch or reconnect Wi-Fi/LAN.
echo   Freeze your current IP to Static so employees always access CRM at the same IP.
echo.
echo   [1] Freeze Current Active Local IP as STATIC (Recommended)
echo   [2] Revert to DYNAMIC (DHCP - Standard Mode)
echo   [3] Update Hosts File DNS Mappings Only
echo   [4] Update Backend & Frontend .env Files to Active IP
echo   [5] Run FULL SYSTEM OPTIMIZATION (Freeze + Hosts + .env + DNS flush)
echo   [6] Show Current Network & IP Status
echo   [7] Exit
echo.
set /p "choice=Enter option (1-7): "

if "%choice%"=="1" goto freeze_ip
if "%choice%"=="2" goto dynamic_dhcp
if "%choice%"=="3" goto update_hosts_only
if "%choice%"=="4" goto update_env_only
if "%choice%"=="5" goto full_optimization
if "%choice%"=="6" goto show_status
if "%choice%"=="7" exit /b 0
goto menu

:: ====================================================================
:: OPTION 1: FREEZE DYNAMIC IP TO STATIC
:: ====================================================================
:freeze_ip
cls
echo ====================================================================
echo  FREEZING CURRENT DYNAMIC IP TO STATIC IP
echo ====================================================================
echo.
echo  Checking current network settings...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$adapter = Get-NetIPInterface -AddressFamily IPv4 | Where-Object { $_.ConnectionState -eq 'Connected' -and $_.InterfaceAlias -notmatch 'Loopback|vEthernet|Virtual|Bluetooth' } | Select-Object -First 1;" ^
  "if (-not $adapter) { Write-Host '  [FAIL] No active network adapter found!' -ForegroundColor Red; exit 1 };" ^
  "$ipConf = Get-NetIPAddress -InterfaceIndex $adapter.InterfaceIndex -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1;" ^
  "$gw = (Get-NetRoute -InterfaceIndex $adapter.InterfaceIndex -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Select-Object -First 1).NextHop;" ^
  "$dns = (Get-DnsClientServerAddress -InterfaceIndex $adapter.InterfaceIndex -AddressFamily IPv4).ServerAddresses;" ^
  "Write-Host 'Active Adapter: ' $adapter.InterfaceAlias -ForegroundColor Cyan;" ^
  "Write-Host 'Detected Local IP: ' $ipConf.IPAddress -ForegroundColor Green;" ^
  "Write-Host 'Subnet Prefix:     /' $ipConf.PrefixLength -ForegroundColor Green;" ^
  "Write-Host 'Default Gateway:   ' $gw -ForegroundColor Green;" ^
  "Write-Host 'DNS Servers:       ' ($dns -join ', ') -ForegroundColor Green;"
if errorlevel 1 pause & goto menu

echo.
echo  WARNING: Your network connection might blink/reconnect for a split second.
echo.
set /p "confirm=Freeze this configuration as STATIC? (Y/N): "
if /I not "%confirm%"=="Y" goto menu

echo.
echo  Configuring Static IP Address in progress...
call :sub_freeze_ip
echo.
pause
goto menu

:: ====================================================================
:: OPTION 2: REVERT STATIC IP BACK TO DYNAMIC DHCP
:: ====================================================================
:dynamic_dhcp
cls
echo ====================================================================
echo  REVERTING LOCAL IP NETWORK CARD TO DYNAMIC (DHCP)
echo ====================================================================
echo.
echo  Detecting adapter...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$adapter = Get-NetIPInterface -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback|vEthernet|Virtual|Bluetooth' } | Select-Object -First 1;" ^
  "Write-Host 'Active Adapter: ' $adapter.InterfaceAlias -ForegroundColor Cyan;"
if errorlevel 1 pause & goto menu

echo.
set /p "confirm=Revert network adapter to DHCP? (Y/N): "
if /I not "%confirm%"=="Y" goto menu

echo.
echo  Reverting and obtaining dynamic lease...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$adapter = Get-NetIPInterface -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback|vEthernet|Virtual|Bluetooth' } | Select-Object -First 1;" ^
  "Set-NetIPInterface -InterfaceIndex $adapter.InterfaceIndex -Dhcp Enabled -ErrorAction SilentlyContinue;" ^
  "Set-DnsClientServerAddress -InterfaceIndex $adapter.InterfaceIndex -ResetServerAddresses -ErrorAction SilentlyContinue;" ^
  "Restart-NetAdapter -InterfaceIndex $adapter.InterfaceIndex -Confirm:$false -ErrorAction SilentlyContinue;" ^
  "Write-Host '  [OK] Reverted adapter to DHCP successfully!' -ForegroundColor Green;"
echo.
pause
goto menu

:: ====================================================================
:: OPTION 3: UPDATE HOSTS FILE DNS MAPPINGS
:: ====================================================================
:update_hosts_only
cls
echo ====================================================================
echo  UPDATING LOCAL DNS (C:\Windows\System32\drivers\etc\hosts)
echo ====================================================================
echo.
call :sub_update_hosts_server
echo.
pause
goto menu

:: ====================================================================
:: OPTION 4: UPDATE BACKEND & FRONTEND .ENV FILES
:: ====================================================================
:update_env_only
cls
echo ====================================================================
echo  UPDATING BACKEND & FRONTEND ENVIRONMENT FILES (.env)
echo ====================================================================
echo.
call :sub_update_env
echo.
pause
goto menu

:: ====================================================================
:: OPTION 5: FULL SYSTEM OPTIMIZATION
:: ====================================================================
:full_optimization
cls
echo ====================================================================
echo  RUNNING FULL SYSTEM OPTIMIZATION
echo ====================================================================
echo.
echo [1/4] Freezing Dynamic IP to Static...
call :sub_freeze_ip
echo.
echo [2/4] Updating Local Hosts DNS file...
call :sub_update_hosts_server
echo.
echo [3/4] Updating Backend & Frontend .env variables...
call :sub_update_env
echo.
echo [4/4] Flushing local DNS cache...
ipconfig /flushdns >nul
echo   [OK] Windows DNS resolver cache flushed successfully.
echo.
echo ====================================================================
echo  FULL SYSTEM OPTIMIZATION COMPLETED SUCCESSFULLY!
echo ====================================================================
echo.
pause
goto menu

:: ====================================================================
:: OPTION 6: SHOW NETWORK AND IP STATUS
:: ====================================================================
:show_status
cls
echo ====================================================================
echo  CURRENT NETWORK & IP CONFIGURATION STATUS
echo ====================================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$adapter = Get-NetIPInterface -AddressFamily IPv4 | Where-Object { $_.ConnectionState -eq 'Connected' -and $_.InterfaceAlias -notmatch 'Loopback|vEthernet|Virtual|Bluetooth' } | Select-Object -First 1;" ^
  "if (-not $adapter) { Write-Host '  [!] No active connection detected.' -ForegroundColor Yellow; exit 0 };" ^
  "$ipConf = Get-NetIPAddress -InterfaceIndex $adapter.InterfaceIndex -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1;" ^
  "$gw = (Get-NetRoute -InterfaceIndex $adapter.InterfaceIndex -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Select-Object -First 1).NextHop;" ^
  "$dns = (Get-DnsClientServerAddress -InterfaceIndex $adapter.InterfaceIndex -AddressFamily IPv4).ServerAddresses;" ^
  "Write-Host '  Network Adapter:  ' $adapter.InterfaceAlias -ForegroundColor Cyan;" ^
  "if ($adapter.Dhcp -eq 'Enabled') { Write-Host '  DHCP (IP Mode):   DYNAMIC - IP may change on reconnect' -ForegroundColor Yellow } else { Write-Host '  DHCP (IP Mode):   STATIC - IP is frozen, safe for employees' -ForegroundColor Green };" ^
  "Write-Host '  Active IPv4 IP:   ' $ipConf.IPAddress -ForegroundColor Cyan;" ^
  "Write-Host '  Subnet Mask:      /' $ipConf.PrefixLength -ForegroundColor Cyan;" ^
  "Write-Host '  Default Gateway:  ' $gw -ForegroundColor Cyan;" ^
  "Write-Host '  Primary DNS:      ' ($dns -join ', ') -ForegroundColor Cyan;"
echo.
echo  Mapped Domains in hosts file:
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content \"$env:SystemRoot\System32\drivers\etc\hosts\" | Where-Object { $_ -match 'achme|IBM-SERVER' -and $_.Trim() -notlike '#*' } | ForEach-Object { Write-Host ('    ' + $_) -ForegroundColor Yellow }"
echo.
pause
goto menu

:: ====================================================================
:: SILENT AUTO-FREEZE MODE (/silent)
:: Called by start-servers.bat when IP is DYNAMIC
:: ====================================================================
:silent_freeze
set "LOG=%LOG_DIR%\manage-local-ip-silent.log"
echo [%DATE% %TIME%] Silent freeze started >> "%LOG%"

:: 1. Freeze IP to static
call :sub_freeze_ip_silent >> "%LOG%" 2>&1
echo [%DATE% %TIME%] IP frozen to static >> "%LOG%"

:: 2. Update SERVER hosts file (using LAN IP - NOT 127.0.0.1)
call :sub_update_hosts_server >> "%LOG%" 2>&1
echo [%DATE% %TIME%] Server hosts file updated >> "%LOG%"

:: 3. Update env files
call :sub_update_env >> "%LOG%" 2>&1
echo [%DATE% %TIME%] .env files updated >> "%LOG%"

:: 4. Flush DNS
ipconfig /flushdns >nul
echo [%DATE% %TIME%] DNS flushed >> "%LOG%"

echo [%DATE% %TIME%] Silent freeze completed >> "%LOG%"
exit /b 0

:: ====================================================================
:: HOSTS-ONLY MODE (/update-hosts-only)
:: Called by start-servers.bat when IP is already STATIC
:: ====================================================================
:hosts_only_mode
set "LOG=%LOG_DIR%\manage-local-ip-silent.log"
call :sub_update_hosts_server >> "%LOG%" 2>&1
ipconfig /flushdns >nul
exit /b 0

:: ====================================================================
:: REUSABLE SUBROUTINES
:: ====================================================================

:sub_freeze_ip
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$adapter = Get-NetIPInterface -AddressFamily IPv4 | Where-Object { $_.ConnectionState -eq 'Connected' -and $_.InterfaceAlias -notmatch 'Loopback|vEthernet|Virtual|Bluetooth' } | Select-Object -First 1;" ^
  "if (-not $adapter) { Write-Host '  [FAIL] No active adapter found!' -ForegroundColor Red; exit 1 };" ^
  "$ipConf = Get-NetIPAddress -InterfaceIndex $adapter.InterfaceIndex -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1;" ^
  "$gw = (Get-NetRoute -InterfaceIndex $adapter.InterfaceIndex -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Select-Object -First 1).NextHop;" ^
  "if (-not $gw) { $octets = $ipConf.IPAddress.Split('.'); $gw = ""$($octets[0]).$($octets[1]).$($octets[2]).1"" };" ^
  "$dns = (Get-DnsClientServerAddress -InterfaceIndex $adapter.InterfaceIndex -AddressFamily IPv4).ServerAddresses;" ^
  "if (-not $dns) { $dns = @('1.1.1.1', '8.8.8.8') };" ^
  "Set-NetIPInterface -InterfaceIndex $adapter.InterfaceIndex -Dhcp Disabled -ErrorAction SilentlyContinue;" ^
  "Remove-NetRoute -InterfaceIndex $adapter.InterfaceIndex -DestinationPrefix '0.0.0.0/0' -Confirm:$false -ErrorAction SilentlyContinue;" ^
  "Remove-NetIPAddress -InterfaceIndex $adapter.InterfaceIndex -AddressFamily IPv4 -Confirm:$false -ErrorAction SilentlyContinue;" ^
  "New-NetIPAddress -InterfaceIndex $adapter.InterfaceIndex -IPAddress $ipConf.IPAddress -PrefixLength $ipConf.PrefixLength -DefaultGateway $gw -ErrorAction SilentlyContinue | Out-Null;" ^
  "Set-DnsClientServerAddress -InterfaceIndex $adapter.InterfaceIndex -ServerAddresses $dns -ErrorAction SilentlyContinue;" ^
  "Write-Host ('  [OK] Static IP frozen: ' + $ipConf.IPAddress) -ForegroundColor Green;"
exit /b 0

:sub_freeze_ip_silent
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$adapter = Get-NetIPInterface -AddressFamily IPv4 | Where-Object { $_.ConnectionState -eq 'Connected' -and $_.InterfaceAlias -notmatch 'Loopback|vEthernet|Virtual|Bluetooth' } | Select-Object -First 1;" ^
  "if (-not $adapter) { exit 1 };" ^
  "$ipConf = Get-NetIPAddress -InterfaceIndex $adapter.InterfaceIndex -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1;" ^
  "$gw = (Get-NetRoute -InterfaceIndex $adapter.InterfaceIndex -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Select-Object -First 1).NextHop;" ^
  "if (-not $gw) { $octets = $ipConf.IPAddress.Split('.'); $gw = ""$($octets[0]).$($octets[1]).$($octets[2]).1"" };" ^
  "$dns = (Get-DnsClientServerAddress -InterfaceIndex $adapter.InterfaceIndex -AddressFamily IPv4).ServerAddresses;" ^
  "if (-not $dns) { $dns = @('1.1.1.1', '8.8.8.8') };" ^
  "Set-NetIPInterface -InterfaceIndex $adapter.InterfaceIndex -Dhcp Disabled -ErrorAction SilentlyContinue;" ^
  "Remove-NetRoute -InterfaceIndex $adapter.InterfaceIndex -DestinationPrefix '0.0.0.0/0' -Confirm:$false -ErrorAction SilentlyContinue;" ^
  "Remove-NetIPAddress -InterfaceIndex $adapter.InterfaceIndex -AddressFamily IPv4 -Confirm:$false -ErrorAction SilentlyContinue;" ^
  "New-NetIPAddress -InterfaceIndex $adapter.InterfaceIndex -IPAddress $ipConf.IPAddress -PrefixLength $ipConf.PrefixLength -DefaultGateway $gw -ErrorAction SilentlyContinue | Out-Null;" ^
  "Set-DnsClientServerAddress -InterfaceIndex $adapter.InterfaceIndex -ServerAddresses $dns -ErrorAction SilentlyContinue;" >nul 2>&1
exit /b 0

:: ====================================================================
:: SERVER HOSTS UPDATE — uses LAN IP (NOT 127.0.0.1) for all domains
:: This is for the SERVER machine itself. Employees use employee-hosts-setup.bat
:: ====================================================================
:sub_update_hosts_server
set "ACTIVE_IP=127.0.0.1"
if exist "%ROOT%\.last-build-ip" (
  set /p ACTIVE_IP=<"%ROOT%\.last-build-ip"
)
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
  set "CANDIDATE=%%a"
  set "CANDIDATE=!CANDIDATE: =!"
  set "PREFIX1=!CANDIDATE:~0,4!"
  set "PREFIX2=!CANDIDATE:~0,8!"
  if not "!PREFIX1!"=="127." (
    if not "!PREFIX2!"=="169.254." (
      set "ACTIVE_IP=!CANDIDATE!"
      goto :hosts_ip_done
    )
  )
)
:hosts_ip_done
if "%ACTIVE_IP%"=="" set "ACTIVE_IP=127.0.0.1"

:: CRITICAL: Map ALL names to the REAL LAN IP (not 127.0.0.1!)
:: This makes achme.com and IBM-SERVER work from employees AND from the server itself
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$hostsFile = ""$env:SystemRoot\System32\drivers\etc\hosts"";" ^
  "$domains = @('achme.com', 'www.achme.com', 'IBM-SERVER', 'IBM-SERVER.achme.com');" ^
  "$content = [System.IO.File]::ReadAllLines($hostsFile);" ^
  "$filtered = $content | Where-Object { $line = $_.Trim(); $keep = $true; foreach($d in $domains) { if ($line -match ('(?i)\b' + [regex]::Escape($d) + '\b')) { $keep = $false; break } }; $keep };" ^
  "$ip = '%ACTIVE_IP%';" ^
  "$newMappings = @(" ^
  "    ''," ^
  "    '# ACHME CRM Server Mapping (auto-updated by manage-local-ip.bat)'," ^
  "    ($ip + '    achme.com    www.achme.com')," ^
  "    ($ip + '    IBM-SERVER   IBM-SERVER.achme.com')" ^
  ");" ^
  "[System.IO.File]::WriteAllLines($hostsFile, ($filtered + $newMappings));" ^
  "Write-Host ('  [OK] Server hosts file mapped: achme.com + IBM-SERVER -> ' + $ip) -ForegroundColor Green;" >nul 2>&1

:: Update employee-hosts-setup.bat FALLBACK_IP variable to match (skip if loopback 127.0.0.1)
if not "%ACTIVE_IP%"=="127.0.0.1" if not "%ACTIVE_IP%"=="" (
  if exist "%ROOT%\employee-hosts-setup.bat" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "$f = '%ROOT%\employee-hosts-setup.bat';" ^
      "$c = [System.IO.File]::ReadAllText($f);" ^
      "$c = $c -replace '(?m)^set\s+""FALLBACK_IP=[^\r\n]*', 'set ""FALLBACK_IP=%ACTIVE_IP%""';" ^
      "[System.IO.File]::WriteAllText($f, $c);" >nul 2>&1
  )
)

ipconfig /flushdns >nul
exit /b 0

:sub_update_env
set "ACTIVE_IP=127.0.0.1"
if exist "%ROOT%\.last-build-ip" (
  set /p ACTIVE_IP=<"%ROOT%\.last-build-ip"
)
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
  set "CANDIDATE=%%a"
  set "CANDIDATE=!CANDIDATE: =!"
  set "PREFIX1=!CANDIDATE:~0,4!"
  set "PREFIX2=!CANDIDATE:~0,8!"
  if not "!PREFIX1!"=="127." (
    if not "!PREFIX2!"=="169.254." (
      set "ACTIVE_IP=!CANDIDATE!"
      goto :env_ip_done
    )
  )
)
:env_ip_done
if "%ACTIVE_IP%"=="" set "ACTIVE_IP=127.0.0.1"

if "%SILENT_MODE%"=="0" echo   Active Local IP detected: %ACTIVE_IP%

:: Update backend .env ALLOWED_ORIGIN
if exist "%ROOT%\backend\.env" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$f = '%ROOT%\backend\.env';" ^
    "$c = Get-Content $f;" ^
    "$ip = '%ACTIVE_IP%';" ^
    "$u = $c | ForEach-Object { if ($_ -match '^ALLOWED_ORIGIN=') { 'ALLOWED_ORIGIN=http://localhost:82,http://127.0.0.1:82,http://' + $ip + ':82,http://achme.com,http://achme.com:82,http://www.achme.com,http://www.achme.com:82,http://IBM-SERVER:82,http://IBM-SERVER.achme.com:82' } else { $_ } };" ^
    "$u | Set-Content $f -Force;" ^
    "Write-Host '  [OK] backend\.env ALLOWED_ORIGIN updated.' -ForegroundColor Green;" >nul 2>&1
)

:: Update frontend .env API URL
if exist "%ROOT%\frontend\.env" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$f = '%ROOT%\frontend\.env';" ^
    "$ip = '%ACTIVE_IP%';" ^
    "$c = Get-Content $f;" ^
    "$u = $c | ForEach-Object { if ($_ -match '^REACT_APP_API_URL=') { 'REACT_APP_API_URL=http://' + $ip + ':5000' } elseif ($_ -match '^REACT_APP_API_PROXY=') { 'REACT_APP_API_PROXY=http://' + $ip + ':5000' } else { $_ } };" ^
    "$u | Set-Content $f -Force;" ^
    "Write-Host '  [OK] frontend\.env updated.' -ForegroundColor Green;" >nul 2>&1
)
exit /b 0
