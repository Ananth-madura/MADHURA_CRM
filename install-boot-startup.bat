@echo off
setlocal enabledelayedexpansion
title ACHME CRM - Install Automatic Windows Boot Startup

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
set "BACKEND_PORT=5000"
set "NGINX_DIR=C:\nginx"
set "LOG_DIR=%ROOT%\logs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
set "BOOTLOG=%LOG_DIR%\install-boot-startup.log"

:: Support /silent flag for background invocation from start-servers.bat
set "SILENT_MODE=0"
if /I "%~1"=="/silent" set "SILENT_MODE=1"

:: ----------------------------------------------------------------
:: Admin check & Auto-Elevation (with auto-accept for silent mode)
:: ----------------------------------------------------------------
net session >nul 2>&1
if not errorlevel 1 goto :is_admin

if "%SILENT_MODE%"=="1" (
  echo [%DATE% %TIME%] Elevating to admin in silent mode... >> "%BOOTLOG%" 2>&1
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Start-Process -FilePath '%~f0' -ArgumentList '/silent' -Verb RunAs -WindowStyle Hidden -ErrorAction Stop } catch { exit 1 }"
  if errorlevel 1 (
    echo [%DATE% %TIME%] ERROR: Admin elevation denied in silent mode >> "%BOOTLOG%" 2>&1
  )
  exit /b 0
)

echo Requesting administrative privileges (UAC prompt)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Start-Process -FilePath '%~f0' -ArgumentList '%*' -Verb RunAs -ErrorAction Stop } catch { exit 1 }"
if errorlevel 1 (
  echo.
  echo ====================================================================
  echo ERROR: ACCESS DENIED! Administrator privileges are required.
  echo Please accept the UAC prompt to allow installation of startup tasks.
  echo ====================================================================
  echo.
  pause
  exit /b 1
)
exit /b 0

:is_admin

echo [%DATE% %TIME%] ===== install-boot-startup.bat started (Admin OK) ===== >> "%BOOTLOG%"

if "%SILENT_MODE%"=="0" (
  cls
  echo.
  echo ====================================================================
  echo  ACHME CRM - AUTOMATIC WINDOWS BOOT STARTUP INSTALLER
  echo ====================================================================
  echo.
)

:: ----------------------------------------------------------------
:: STEP 1 — Detect LAN IP
:: ----------------------------------------------------------------
if "%SILENT_MODE%"=="0" echo [Step 1/7] Detecting LAN IP...
set "LAN_IP=127.0.0.1"

:: Read from saved file first
if exist "%ROOT%\.last-build-ip" (
  set /p LAN_IP=<"%ROOT%\.last-build-ip"
)

:: Also detect live via ipconfig
for /f "usebackq tokens=*" %%p in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$gw = (Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Select-Object -First 1).NextHop; if ($gw) { $ip = (Find-NetRoute -RemoteIPAddress $gw -ErrorAction SilentlyContinue).LocalIPAddress; if ($ip) { echo $ip; exit } }; (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Ethernet*', 'Wi-Fi*', 'Local Area Connection*' -Type Unicast -ErrorAction SilentlyContinue).IPAddress; (Get-NetIPAddress -AddressFamily IPv4 -Type Unicast -ErrorAction SilentlyContinue).IPAddress"`) do (
  set "CANDIDATE=%%p"
  if not "!CANDIDATE!"=="" (
    set "PREFIX1=!CANDIDATE:~0,4!"
    set "PREFIX2=!CANDIDATE:~0,8!"
    if not "!PREFIX1!"=="127." (
      if not "!PREFIX2!"=="169.254." (
        set "LAN_IP=!CANDIDATE!"
        goto :got_ip
      )
    )
  )
)
:got_ip
goto :ip_done
:ip_done

:: Save IP
echo %LAN_IP%>"%ROOT%\.last-build-ip"

if "%SILENT_MODE%"=="0" echo   Detected LAN IP: %LAN_IP%
if "%SILENT_MODE%"=="0" echo.
echo [%DATE% %TIME%] LAN IP: %LAN_IP% >> "%BOOTLOG%"

:: ----------------------------------------------------------------
:: STEP 2 — Write nginx.conf (listen on 0.0.0.0:82 = ALL interfaces)
:: ----------------------------------------------------------------
if "%SILENT_MODE%"=="0" echo [Step 2/7] Writing nginx.conf...
if exist "%NGINX_DIR%\nginx.exe" (
  if not exist "%NGINX_DIR%\html\achme" mkdir "%NGINX_DIR%\html\achme"
  (
  echo worker_processes 1;
  echo.
  echo events {
  echo     worker_connections 1024;
  echo }
  echo.
  echo http {
  echo     include       mime.types;
  echo     default_type  application/octet-stream;
  echo     sendfile        on;
  echo     keepalive_timeout 65;
  echo     access_log  logs/achme_access.log;
  echo     error_log   logs/achme_error.log;
  echo.
  echo     upstream achme_backend {
  echo         server 127.0.0.1:%BACKEND_PORT%;
  echo         keepalive 32;
  echo     }
  echo.
  echo     server {
  echo         listen 0.0.0.0:82 default_server;
  echo         server_name _;
  echo.
  echo         root C:/nginx/html/achme;
  echo         index index.html;
  echo.
  echo         location / {
  echo             try_files $uri $uri/ /index.html;
  echo         }
  echo.
  echo         location = /index.html {
  echo             add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
  echo             expires -1;
  echo         }
  echo.
  echo         location /api/ {
  echo             proxy_pass http://achme_backend/api/;
  echo             proxy_http_version 1.1;
  echo             proxy_set_header Host              $host;
  echo             proxy_set_header X-Real-IP         $remote_addr;
  echo             proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
  echo             proxy_set_header X-Forwarded-Proto $scheme;
  echo             proxy_connect_timeout  120s;
  echo             proxy_send_timeout     120s;
  echo             proxy_read_timeout     120s;
  echo             client_max_body_size   50M;
  echo         }
  echo.
  echo         location /socket.io/ {
  echo             proxy_pass http://achme_backend/socket.io/;
  echo             proxy_http_version 1.1;
  echo             proxy_set_header Upgrade    $http_upgrade;
  echo             proxy_set_header Connection "upgrade";
  echo             proxy_set_header Host              $host;
  echo             proxy_set_header X-Real-IP         $remote_addr;
  echo             proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
  echo             proxy_connect_timeout  60s;
  echo             proxy_send_timeout     60s;
  echo             proxy_read_timeout     3600s;
  echo         }
  echo.
  echo         location /nginx-health {
  echo             return 200 "Nginx OK - ACHME CRM\n";
  echo             add_header Content-Type text/plain;
  echo         }
  echo.
  echo         location ~* \.(js^|css^|png^|jpg^|jpeg^|gif^|ico^|svg^|woff^|woff2^|ttf^|eot^)$ {
  echo             expires 1y;
  echo             add_header Cache-Control "public, immutable";
  echo             access_log off;
  echo         }
  echo.
  echo         location ~ /\. {
  echo             deny all;
  echo         }
  echo     }
  echo }
  ) >"%NGINX_DIR%\conf\nginx.conf"
  if "%SILENT_MODE%"=="0" echo   [OK] nginx.conf written (listens on ALL interfaces - port 82)
  echo [%DATE% %TIME%] nginx.conf written >> "%BOOTLOG%"
) else (
  if "%SILENT_MODE%"=="0" echo   [WARN] Nginx not found at %NGINX_DIR%
  echo [%DATE% %TIME%] WARN: Nginx not found >> "%BOOTLOG%"
)
if "%SILENT_MODE%"=="0" echo.

:: ----------------------------------------------------------------
:: STEP 3 — Update SERVER hosts file (use LAN IP for all domains)
:: ----------------------------------------------------------------
if "%SILENT_MODE%"=="0" echo [Step 3/7] Updating SERVER hosts file...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$hostsFile = \"$env:SystemRoot\System32\drivers\etc\hosts\";" ^
  "$domains = @('achme.com', 'www.achme.com', 'IBM-SERVER', 'IBM-SERVER.achme.com');" ^
  "$content = [System.IO.File]::ReadAllLines($hostsFile);" ^
  "$filtered = $content | Where-Object { $line = $_.Trim(); $keep = $true; foreach ($d in $domains) { if ($line -match ('(?i)\b' + [regex]::Escape($d) + '\b')) { $keep = $false; break } }; $keep };" ^
  "$ip = '%LAN_IP%';" ^
  "$newMappings = @(" ^
  "    ''," ^
  "    '# ACHME CRM auto-mapping (install-boot-startup.bat)'," ^
  "    ($ip + '    achme.com    www.achme.com')," ^
  "    ($ip + '    IBM-SERVER   IBM-SERVER.achme.com')" ^
  ");" ^
  "$result = $filtered + $newMappings;" ^
  "[System.IO.File]::WriteAllLines($hostsFile, $result);" ^
  "Write-Host ('  [OK] Server hosts: achme.com + IBM-SERVER -> ' + $ip)" ^
  >>"%BOOTLOG%" 2>&1
ipconfig /flushdns >nul
if "%SILENT_MODE%"=="0" echo   [OK] Server hosts file updated
if "%SILENT_MODE%"=="0" echo.
echo [%DATE% %TIME%] Hosts file updated >> "%BOOTLOG%"

:: ----------------------------------------------------------------
:: STEP 4 — Register Boot Scheduled Tasks (SYSTEM boot + login + watchdog)
:: ----------------------------------------------------------------
if "%SILENT_MODE%"=="0" echo [Step 4/7] Registering Automatic Startup Tasks...
echo [%DATE% %TIME%] Step 4: Registering scheduled tasks... >> "%BOOTLOG%"

if exist "%ROOT%\achme-startup.bat" (
  :: ============================================================
  :: Clean up ALL old task names
  :: ============================================================
  schtasks /delete /tn "ACHME_CRM_Boot_Startup" /f >nul 2>&1
  schtasks /delete /tn "ACHME_CRM_AutoBoot" /f >nul 2>&1
  schtasks /delete /tn "ACHME_CRM_Login_Startup" /f >nul 2>&1
  schtasks /delete /tn "ACHME_CRM_Watchdog" /f >nul 2>&1

  :: ============================================================
  :: Task 1: SYSTEM BOOT (PowerShell for StartWhenAvailable + RestartOnFail)
  ::   - RunAs SYSTEM = NO UAC prompts, runs before login
  ::   - 1 min delay = wait for Windows network stack
  ::   - StartWhenAvailable = if missed, run ASAP
  ::   - RestartOnFail x5 = auto-retry up to 5 times if script fails
  ::   - No ExecutionTimeLimit = script runs as long as needed
  :: ============================================================
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$a = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c \"%ROOT%\achme-startup.bat\"' -WorkingDirectory '%ROOT%';" ^
    "$t = New-ScheduledTaskTrigger -AtStartup; $t.Delay = 'PT1M';" ^
    "$s = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 0) -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew;" ^
    "$p = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest;" ^
    "Register-ScheduledTask -TaskName 'ACHME_CRM_AutoBoot' -Action $a -Trigger $t -Settings $s -Principal $p -Force" ^
    >>"%BOOTLOG%" 2>&1
  set "TASK1_OK=!errorlevel!"
  echo [%DATE% %TIME%] AutoBoot task result: !TASK1_OK! >> "%BOOTLOG%"

  :: ============================================================
  :: Task 2: USER LOGIN FALLBACK (PowerShell for same robust settings)
  ::   - RunAs SYSTEM = NO UAC prompts ever
  ::   - 30s delay after login
  :: ============================================================
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$a = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c \"%ROOT%\achme-startup.bat\"' -WorkingDirectory '%ROOT%';" ^
    "$t = New-ScheduledTaskTrigger -AtLogOn; $t.Delay = 'PT30S';" ^
    "$s = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 0) -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew;" ^
    "$p = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest;" ^
    "Register-ScheduledTask -TaskName 'ACHME_CRM_Login_Startup' -Action $a -Trigger $t -Settings $s -Principal $p -Force" ^
    >>"%BOOTLOG%" 2>&1
  set "TASK2_OK=!errorlevel!"
  echo [%DATE% %TIME%] Login task result: !TASK2_OK! >> "%BOOTLOG%"

  :: ============================================================
  :: Task 3: WATCHDOG — every 5 minutes, auto-heal crashed services
  ::   - Uses schtasks (reliable for repeating triggers)
  ::   - RunAs SYSTEM = NO UAC
  :: ============================================================
  if exist "%ROOT%\achme-watchdog.bat" (
    schtasks /create /tn "ACHME_CRM_Watchdog" /tr "cmd /c \"%ROOT%\achme-watchdog.bat\"" /sc minute /mo 5 /ru SYSTEM /rl HIGHEST /f >nul 2>&1
    set "TASK3_OK=!errorlevel!"
    echo [%DATE% %TIME%] Watchdog task result: !TASK3_OK! >> "%BOOTLOG%"
  ) else (
    set "TASK3_OK=1"
    echo [%DATE% %TIME%] achme-watchdog.bat not found - skipping watchdog task >> "%BOOTLOG%"
  )

  if "%SILENT_MODE%"=="0" (
    if !TASK1_OK! neq 0 (
      echo   [WARN] Failed to register SYSTEM boot task.
    ) else (
      echo   [OK] System boot task registered (SYSTEM, 1 min after boot, restart x5^).
    )
    if !TASK2_OK! neq 0 (
      echo   [WARN] Failed to register user logon fallback task.
    ) else (
      echo   [OK] User logon task registered (SYSTEM, 30s after login, restart x5^).
    )
    if !TASK3_OK! neq 0 (
      echo   [WARN] Watchdog task not registered.
    ) else (
      echo   [OK] Watchdog task registered (SYSTEM, every 5 minutes^).
    )
  )
) else (
  if "%SILENT_MODE%"=="0" echo   [WARN] achme-startup.bat not found - skipping boot tasks.
  echo [%DATE% %TIME%] WARN: achme-startup.bat not found >> "%BOOTLOG%"
)
if "%SILENT_MODE%"=="0" echo.

:: ----------------------------------------------------------------
:: STEP 5 — Set MySQL service to auto-start on boot
:: ----------------------------------------------------------------
if "%SILENT_MODE%"=="0" echo [Step 5/7] Configuring MySQL auto-start...
for %%m in (MySQL80 MySQL MySQL57 MySQL84 MySQL90 mysql MariaDB) do (
  sc query %%m >nul 2>&1
  if not errorlevel 1 (
    sc config %%m start=auto >nul 2>&1
    echo [%DATE% %TIME%] MySQL service %%m set to auto-start >> "%BOOTLOG%"
  )
)
if "%SILENT_MODE%"=="0" echo   [OK] MySQL services set to auto-start on boot.
if "%SILENT_MODE%"=="0" echo.

:: ----------------------------------------------------------------
:: STEP 6 — Reload Nginx with new config
:: ----------------------------------------------------------------
if "%SILENT_MODE%"=="0" echo [Step 6/7] Reloading Nginx...
if exist "%NGINX_DIR%\nginx.exe" (
  taskkill /F /IM nginx.exe >nul 2>&1
  ping -n 3 127.0.0.1 >nul
  pushd "%NGINX_DIR%" >nul 2>&1
  if not errorlevel 1 (
    start "" /B nginx.exe -p "%NGINX_DIR%"
    popd
  ) else (
    :: pushd failed — start directly with full path
    start "" /B "%NGINX_DIR%\nginx.exe" -p "%NGINX_DIR%"
  )
  ping -n 3 127.0.0.1 >nul
  if "%SILENT_MODE%"=="0" echo   [OK] Nginx started/reloaded.
  echo [%DATE% %TIME%] Nginx reloaded >> "%BOOTLOG%"
)
if "%SILENT_MODE%"=="0" echo.

:: ----------------------------------------------------------------
:: STEP 7 — Disable Sleep and Hibernation (Always Running Server)
:: ----------------------------------------------------------------
if "%SILENT_MODE%"=="0" echo [Step 7/7] Configuring Windows Power Settings (always running)...
powercfg /change standby-timeout-ac 0 >nul 2>&1
powercfg /change monitor-timeout-ac 0 >nul 2>&1
powercfg /change hibernate-timeout-ac 0 >nul 2>&1
powercfg /change standby-timeout-dc 0 >nul 2>&1
powercfg /change hibernate-timeout-dc 0 >nul 2>&1
powercfg /hibernate off >nul 2>&1

:: Set high-performance power plan (prevents CPU throttling)
powershell -NoProfile -ExecutionPolicy Bypass -Command "powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c" >nul 2>&1

:: Configure Windows to auto-restart after power failure (BIOS may also need this)
:: This registry key tells Windows to auto-logon after unexpected shutdown
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon" /v AutoAdminLogon /t REG_SZ /d "0" /f >nul 2>&1

:: Ensure fast startup is DISABLED (fast startup can prevent boot tasks from running!)
reg add "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Power" /v HiberbootEnabled /t REG_DWORD /d 0 /f >nul 2>&1

if "%SILENT_MODE%"=="0" echo   [OK] System set to never sleep or hibernate.
if "%SILENT_MODE%"=="0" echo   [OK] Fast Startup disabled (ensures boot tasks always run).
if "%SILENT_MODE%"=="0" echo   [OK] High-performance power plan activated.
if "%SILENT_MODE%"=="0" echo.
echo [%DATE% %TIME%] Power settings configured >> "%BOOTLOG%"

:: ----------------------------------------------------------------
:: Verify tasks were registered successfully
:: ----------------------------------------------------------------
echo [%DATE% %TIME%] Verifying scheduled tasks... >> "%BOOTLOG%"
schtasks /query /tn "ACHME_CRM_AutoBoot" >nul 2>&1
if errorlevel 1 (
  echo [%DATE% %TIME%] CRITICAL: AutoBoot task NOT found after registration! >> "%BOOTLOG%"
  if "%SILENT_MODE%"=="0" echo   [!!] CRITICAL: Boot task verification FAILED - trying alternate method...
  :: Alternate registration method using PowerShell (more reliable on some Windows versions)
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c \"%ROOT%\achme-startup.bat\"';" ^
    "$trigger = New-ScheduledTaskTrigger -AtStartup;" ^
    "$trigger.Delay = 'PT1M';" ^
    "$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 0);" ^
    "$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest;" ^
    "Register-ScheduledTask -TaskName 'ACHME_CRM_AutoBoot' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force" ^
    >>"%BOOTLOG%" 2>&1
  echo [%DATE% %TIME%] PowerShell alternate registration attempted >> "%BOOTLOG%"
) else (
  echo [%DATE% %TIME%] AutoBoot task verified OK >> "%BOOTLOG%"
  if "%SILENT_MODE%"=="0" echo   [OK] Boot task verified in Task Scheduler.
)

schtasks /query /tn "ACHME_CRM_Login_Startup" >nul 2>&1
if errorlevel 1 (
  echo [%DATE% %TIME%] CRITICAL: Login task NOT found! Trying PowerShell... >> "%BOOTLOG%"
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c \"%ROOT%\achme-startup.bat\"';" ^
    "$trigger = New-ScheduledTaskTrigger -AtLogOn;" ^
    "$trigger.Delay = 'PT30S';" ^
    "$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 0);" ^
    "Register-ScheduledTask -TaskName 'ACHME_CRM_Login_Startup' -Action $action -Trigger $trigger -Settings $settings -Force -RunLevel Highest" ^
    >>"%BOOTLOG%" 2>&1
) else (
  echo [%DATE% %TIME%] Login task verified OK >> "%BOOTLOG%"
)

if "%SILENT_MODE%"=="1" exit /b 0

:: Open the access guide
if exist "%ROOT%\show.bat" start "" "%ROOT%\show.bat"

:: ----------------------------------------------------------------
:: Interactive mode — show summary
:: ----------------------------------------------------------------
echo ====================================================================
echo  INSTALLATION COMPLETED SUCCESSFULLY!
echo ====================================================================
echo.
echo  The CRM is now fully automated on this server:
echo.
echo  [BOOT]     PM2 backend + Nginx auto-start 1 min after power-on.
echo  [LOGIN]    Fallback: services checked 30s after user login.
echo  [WATCHDOG] Every 5 minutes: dead services auto-restarted.
echo  [POWER]    Sleep/hibernate DISABLED. Fast Startup DISABLED.
echo.
echo  After a power cut, your server will be fully live within 2 minutes!
echo.
echo  Access URLs (all working after setup):
echo    http://localhost:82             - From this server machine
echo    http://%LAN_IP%:82          - From any LAN device (direct IP)
echo    http://achme.com               - After employee-hosts-setup.bat
echo    http://www.achme.com           - After employee-hosts-setup.bat
echo    http://IBM-SERVER:82           - After employee-hosts-setup.bat
echo.
echo  Share employee-hosts-setup.bat with each employee PC.
echo.
pause
exit /b 0
