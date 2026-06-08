@echo off
setlocal enabledelayedexpansion
title ACHME CRM - Employee Device Setup
color 0A

:: ================================================================
:: ACHME CRM - EMPLOYEE DEVICE HOSTS SETUP
::
:: Run this on each EMPLOYEE's PC to access the CRM via domain name.
:: Right-click -> Run as Administrator (interactive mode)
::
:: SILENT MODE (used by start-servers.bat on the server):
::   employee-hosts-setup.bat /silent
::   No windows, no prompts, logs to logs\
:: ================================================================

:: ---- UNC PATH WORKAROUND ----
set "CURRENT_PATH=%~dp0"
if "%CURRENT_PATH:~0,2%"=="\\" (
  echo [INFO] Running from network share. Copying to local TEMP directory...
  copy /y "%~f0" "%TEMP%\employee-hosts-setup.bat" >nul
  start "" "%TEMP%\employee-hosts-setup.bat" /localrun "%~dp0" %*
  exit /b 0
)

set "ROOT=%~dp0"
set "LOCALRUN_ARGS="
if "%~1"=="/localrun" (
  set "ROOT=%~2"
  set "LOCALRUN_ARGS=/localrun ""%~2"""
)
set "ROOT=%ROOT:~0,-1%"

set "SILENT_MODE=0"
if /I "%~1"=="/silent" set "SILENT_MODE=1"
if /I "%~3"=="/silent" set "SILENT_MODE=1"

:: ---- SERVER IP CONFIGURATION ----
echo [INFO] Auto-detecting CRM Server IP address...

set "TARGET_HOSTNAME=IBM-SERVER"
set "FALLBACK_IP=192.168.50.251"

if exist "%TEMP%\achme_ip.txt" del "%TEMP%\achme_ip.txt" >nul 2>&1

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$TargetHostname = '%TARGET_HOSTNAME%';" ^
  "$FallbackIP = '%FALLBACK_IP%';" ^
  "if (-not $FallbackIP) {" ^
  "    try {" ^
  "        $hf = \"$env:SystemRoot\System32\drivers\etc\hosts\";" ^
  "        if (Test-Path $hf) {" ^
  "            $ln = (Get-Content $hf | Where-Object { $_ -match '\b' + [regex]::Escape($TargetHostname) + '\b' -and $_.Trim() -notlike '#*' } | Select-Object -First 1);" ^
  "            if ($ln) {" ^
  "                $pt = $ln.Trim() -split '\s+';" ^
  "                if ($pt[0] -match '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$' -and $pt[0] -ne '127.0.0.1') { $FallbackIP = $pt[0] };" ^
  "            }" ^
  "        }" ^
  "    } catch {}" ^
  "};" ^
  "$Root = '%ROOT%';" ^
  "function Test-Nginx([string]$ip) {" ^
  "    if (-not $ip -or $ip -eq '127.0.0.1' -or $ip -eq '0.0.0.0') { return $false };" ^
  "    try {" ^
  "        $tcp = New-Object System.Net.Sockets.TcpClient;" ^
  "        $ar = $tcp.BeginConnect($ip, 82, $null, $null);" ^
  "        if ($ar.AsyncWaitHandle.WaitOne(300)) {" ^
  "            $tcp.EndConnect($ar);" ^
  "            $tcp.Close();" ^
  "            $resp = Invoke-RestMethod -Uri \"http://$($ip):82/nginx-health\" -TimeoutSec 1 -ErrorAction SilentlyContinue;" ^
  "            if ($resp -match 'Nginx OK') { return $true };" ^
  "        } else {" ^
  "            $tcp.Close();" ^
  "        }" ^
  "    } catch {}" ^
  "    return $false;" ^
  "};" ^
  "[Console]::Error.WriteLine('   [1/4] Checking local cache...');" ^
  "if (Test-Path \"$Root\.last-build-ip\") {" ^
  "    $ip = (Get-Content \"$Root\.last-build-ip\" -Raw).Trim();" ^
  "    if (Test-Nginx $ip) { $ip | Out-File -FilePath '%TEMP%\achme_ip.txt' -Encoding ascii; exit };" ^
  "};" ^
  "[Console]::Error.WriteLine('   [2/4] Checking network path...');" ^
  "$scriptPath = $MyInvocation.MyCommand.Path;" ^
  "if ($scriptPath -and $scriptPath.StartsWith('\\')) {" ^
  "    $serverName = $scriptPath.Split('\')[2];" ^
  "    if ($serverName -match '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$') {" ^
  "        if (Test-Nginx $serverName) { $serverName | Out-File -FilePath '%TEMP%\achme_ip.txt' -Encoding ascii; exit };" ^
  "    } else {" ^
  "        try {" ^
  "            $ips = [System.Net.Dns]::GetHostAddresses($serverName) | Where-Object { $_.AddressFamily -eq 'InterNetwork' };" ^
  "            foreach ($ipObj in $ips) {" ^
  "                $ip = $ipObj.ToString();" ^
  "                if (Test-Nginx $ip) { $ip | Out-File -FilePath '%TEMP%\achme_ip.txt' -Encoding ascii; exit };" ^
  "            }" ^
  "        } catch {}" ^
  "    }" ^
  "};" ^
  "[Console]::Error.WriteLine('   [3/4] Querying network name resolution...');" ^
  "$hostsFile = \"$env:SystemRoot\System32\drivers\etc\hosts\";" ^
  "$domains = @('achme.com', 'www.achme.com', $TargetHostname, \"$TargetHostname.achme.com\");" ^
  "if (Test-Path $hostsFile) {" ^
  "    try {" ^
  "        $content = [System.IO.File]::ReadAllLines($hostsFile);" ^
  "        $filtered = $content | Where-Object {" ^
  "            $line = $_.Trim(); $keep = $true;" ^
  "            foreach ($d in $domains) { if ($line -match ('(?i)\b' + [regex]::Escape($d) + '\b')) { $keep = $false; break } };" ^
  "            $keep" ^
  "        };" ^
  "        [System.IO.File]::WriteAllLines($hostsFile, $filtered);" ^
  "        ipconfig /flushdns | Out-Null;" ^
  "    } catch {}" ^
  "};" ^
  "try {" ^
  "    $ips = [System.Net.Dns]::GetHostAddresses($TargetHostname) | Where-Object { $_.AddressFamily -eq 'InterNetwork' };" ^
  "    foreach ($ipObj in $ips) { $ip = $ipObj.ToString(); if (Test-Nginx $ip) { $ip | Out-File -FilePath '%TEMP%\achme_ip.txt' -Encoding ascii; exit } };" ^
  "} catch {};" ^
  "try {" ^
  "    $ips = [System.Net.Dns]::GetHostAddresses(\"$TargetHostname.local\") | Where-Object { $_.AddressFamily -eq 'InterNetwork' };" ^
  "    foreach ($ipObj in $ips) { $ip = $ipObj.ToString(); if (Test-Nginx $ip) { $ip | Out-File -FilePath '%TEMP%\achme_ip.txt' -Encoding ascii; exit } };" ^
  "} catch {};" ^
  "[Console]::Error.WriteLine('   [4/4] Scanning local network subnet...');" ^
  "$myIp = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Ethernet*', 'Wi-Fi*', 'Local Area*' -Type Unicast | Select-Object -First 1).IPAddress;" ^
  "if (-not $myIp) { $myIp = (Get-NetIPAddress -AddressFamily IPv4 -Type Unicast | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1).IPAddress };" ^
  "if ($myIp) {" ^
  "    $octets = $myIp.Split('.');" ^
  "    $subnetPrefix = \"$($octets[0]).$($octets[1]).$($octets[2])\";" ^
  "    $ipsToScan = 1..254 | ForEach-Object { \"$subnetPrefix.$_\" } | Where-Object { $_ -ne $myIp };" ^
  "    $pool = [runspacefactory]::CreateRunspacePool(1, 30);" ^
  "    $pool.Open();" ^
  "    $jobs = @();" ^
  "    foreach ($ip in $ipsToScan) {" ^
  "        $ps = [powershell]::Create();" ^
  "        $ps.RunspacePool = $pool;" ^
  "        [void]$ps.AddScript({" ^
  "            param($ipToTest);" ^
  "            try {" ^
  "                $tcp = New-Object System.Net.Sockets.TcpClient;" ^
  "                $ar = $tcp.BeginConnect($ipToTest, 82, $null, $null);" ^
  "                if ($ar.AsyncWaitHandle.WaitOne(300)) {" ^
  "                    $tcp.EndConnect($ar); $tcp.Close();" ^
  "                    $wc = New-Object System.Net.WebClient;" ^
  "                    $html = $wc.DownloadString(\"http://$($ipToTest):82/nginx-health\");" ^
  "                    if ($html -match 'Nginx OK') { return $ipToTest };" ^
  "                } else { $tcp.Close() };" ^
  "            } catch {}" ^
  "            return $null;" ^
  "        });" ^
  "        [void]$ps.AddArgument($ip);" ^
  "        $jobs += [PSCustomObject]@{ PS = $ps; Handle = $ps.BeginInvoke() };" ^
  "    };" ^
  "    $foundIp = $null;" ^
  "    while ($jobs.Count -gt 0 -and -not $foundIp) {" ^
  "        $completed = $jobs | Where-Object { $_.Handle.IsCompleted };" ^
  "        foreach ($j in $completed) {" ^
  "            $res = $j.PS.EndInvoke($j.Handle);" ^
  "            if ($res) { $foundIp = $res; break };" ^
  "            $j.PS.Dispose();" ^
  "        };" ^
  "        $jobs = $jobs | Where-Object { -not $_.Handle.IsCompleted };" ^
  "        if (-not $foundIp) { Start-Sleep -Milliseconds 50 };" ^
  "    };" ^
  "    foreach ($j in $jobs) { $j.PS.Dispose() };" ^
  "    $pool.Close();" ^
  "    if ($foundIp) { $foundIp | Out-File -FilePath '%TEMP%\achme_ip.txt' -Encoding ascii; exit };" ^
  "};" ^
  "[Console]::Error.WriteLine('   [WARN] Auto-detection failed. Using fallback.');" ^
  "$FallbackIP | Out-File -FilePath '%TEMP%\achme_ip.txt' -Encoding ascii;"

if exist "%TEMP%\achme_ip.txt" (
  set /p SERVER_IP=<"%TEMP%\achme_ip.txt"
  del "%TEMP%\achme_ip.txt" >nul 2>&1
)
if "%SERVER_IP%"=="" set "SERVER_IP=%FALLBACK_IP%"

:: Trim spaces from SERVER_IP
set "SERVER_IP=%SERVER_IP: =%"

if "%SERVER_IP%"=="" set "SERVER_IP=192.168.50.251"
if "%SERVER_IP%"=="127.0.0.1" set "SERVER_IP=192.168.50.251"

if not "%SILENT_MODE%"=="1" (
  echo.
  echo  ================================================================
  echo   CRM Server IP detected: !SERVER_IP!
  echo  ================================================================
  echo.
  echo   If the IP above is correct, press [ENTER].
  echo   If the IP is incorrect, type the correct server IP manually.
  echo.
  set /p "USER_IP=Enter Server IP (or press ENTER for !SERVER_IP!): "
  if not "!USER_IP!"=="" set "SERVER_IP=!USER_IP!"
)

:: Trim spaces from SERVER_IP again in case of manual override
set "SERVER_IP=%SERVER_IP: =%"
echo [OK] Detected Server IP: %SERVER_IP%

:: Auto-elevate to Administrator if needed
net session >nul 2>&1
if not errorlevel 1 goto :admin_authenticated

if "%SILENT_MODE%"=="1" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -ArgumentList '%LOCALRUN_ARGS% /silent' -Verb RunAs -WindowStyle Hidden"
  exit /b 0
)

echo.
echo  ================================================================
echo   ELEVATING TO ADMINISTRATOR PRIVILEGES...
echo   Required to update the hosts file for ACHME CRM access.
echo  ================================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -ArgumentList '%LOCALRUN_ARGS%' -Verb RunAs"
exit /b 0

:admin_authenticated
cd /d "%~dp0"
set "LOG_DIR=%ROOT%\logs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
set "LOG=%LOG_DIR%\employee-hosts-setup.log"

if "%SILENT_MODE%"=="1" goto :silent_mode

:: ================================================================
:: INTERACTIVE MODE
:: ================================================================
cls
echo.
echo  ================================================================
echo   ACHME CRM - EMPLOYEE DEVICE SETUP UTILITY
echo  ================================================================
echo.
echo   This will configure your PC to access ACHME CRM using:
echo     http://achme.com
echo     http://www.achme.com
echo     http://IBM-SERVER:82
echo     http://%SERVER_IP%:82
echo.
echo   Server IP: %SERVER_IP%
echo.
echo  ================================================================
echo.

:: [1/4] Update hosts file
echo [1/4] Updating hosts file...
call :do_update_hosts
echo   [OK] Hosts file updated.
echo.

:: [2/4] Flush DNS
echo [2/4] Flushing DNS cache...
ipconfig /flushdns >nul
echo   [OK] DNS cache flushed.
echo.

:: [3/4] Connectivity test
echo [3/4] Testing connectivity to server...
echo.
echo   Testing http://%SERVER_IP%:82 ...
cmd /c "curl -s --max-time 5 http://%SERVER_IP%:82/nginx-health >nul 2>&1"
if errorlevel 1 (
  echo    [WARN] http://%SERVER_IP%:82 It's responding. Check server is running.
) else (
  echo    [OK]  http://%SERVER_IP%:82 is reachable!
)

echo.
echo   Testing http://achme.com:82 ...
cmd /c "curl -s --max-time 5 http://achme.com:82/nginx-health >nul 2>&1"
if errorlevel 1 (
  echo    [WARN] http://achme.com:82 It's responding (may need a moment).
) else (
  echo    [OK]  http://achme.com:82 is reachable!
)

echo.
echo   Testing http://IBM-SERVER:82 ...
cmd /c "curl -s --max-time 5 http://IBM-SERVER:82/nginx-health >nul 2>&1"
if errorlevel 1 (
  echo    [WARN] http://IBM-SERVER:82 It's responding (may need a moment).
) else (
  echo    [OK]  http://IBM-SERVER:82 is reachable!
)

echo.
echo  ================================================================

:: [4/4] Show current hosts entries
echo [4/4] Your hosts file now contains:
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content \"$env:SystemRoot\System32\drivers\etc\hosts\" | Where-Object { $_ -match 'achme|IBM-SERVER' -and $_.Trim() -notlike '#*' } | ForEach-Object { Write-Host ('    ' + $_) }"
echo.


echo  ================================================================
echo   [5/5] Enable Auto-Sync on Boot/Login
echo  ================================================================
echo.
echo   Would you like this PC to automatically update the mapping 
echo   every time you log in? (Recommended for dynamic/temporary IPs)
echo.
set /p "setup_task=Enable Auto-Sync on logon? (Y/N): "
if /I "%setup_task%"=="Y" (
  schtasks /delete /tn "ACHME_CRM_Client_Sync" /f >nul 2>&1
  schtasks /create /tn "ACHME_CRM_Client_Sync" /tr "\"%~f0\" /silent" /sc onlogon /rl HIGHEST /f >nul 2>&1
  if not errorlevel 1 (
    echo.
    echo   [OK] Auto-Sync registered! This PC will auto-update on login.
  ) else (
    echo.
    echo   [WARN] Could not register task. Make sure you ran this script as Administrator.
  )
)
echo.
echo  ================================================================
echo   SETUP COMPLETE!
echo  ================================================================
echo.
echo   You can now access ACHME CRM from this PC:
echo.
echo     http://achme.com         (recommended)
echo     http://www.achme.com     (recommended)
echo     http://%SERVER_IP%:82    (direct IP - always works)
echo     http://IBM-SERVER:82     (server name)
echo.
pause
exit /b 0

:: ================================================================
:: SILENT MODE — runs hidden, logs everything
:: ================================================================
:silent_mode
echo [%DATE% %TIME%] Silent employee-hosts-setup started >>"%LOG%"
call :do_update_hosts >>"%LOG%" 2>&1
ipconfig /flushdns >nul
echo [%DATE% %TIME%] Hosts file updated and DNS flushed for SERVER_IP=%SERVER_IP% >>"%LOG%"
exit /b 0

:: ================================================================
:: SHARED SUBROUTINE: DO_UPDATE_HOSTS
:: Maps achme.com, www.achme.com, IBM-SERVER to SERVER_IP
:: ================================================================
:do_update_hosts
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$hostsFile = \"$env:SystemRoot\System32\drivers\etc\hosts\";" ^
  "$domains = @('achme.com', 'www.achme.com', 'IBM-SERVER', 'IBM-SERVER.achme.com');" ^
  "$content = [System.IO.File]::ReadAllLines($hostsFile);" ^
  "$filtered = $content | Where-Object { $line = $_.Trim(); $keep = $true; foreach($d in $domains) { if ($line -match ('(?i)\b' + [regex]::Escape($d) + '\b')) { $keep = $false; break } }; $keep };" ^
  "$ip = '%SERVER_IP%';" ^
  "$newMappings = @(" ^
  "    ''," ^
  "    '# ACHME CRM Employee Setup (auto-updated %DATE%)'," ^
  "    ($ip + '    achme.com    www.achme.com')," ^
  "    ($ip + '    IBM-SERVER   IBM-SERVER.achme.com')" ^
  ");" ^
  "[System.IO.File]::WriteAllLines($hostsFile, ($filtered + $newMappings));" ^
  "Write-Host ('  [OK] Hosts mapped: achme.com + IBM-SERVER -> ' + $ip) -ForegroundColor Green;"
exit /b 0
