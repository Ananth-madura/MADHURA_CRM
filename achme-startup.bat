@echo off
setlocal enabledelayedexpansion
:: ====================================================================
:: ACHME CRM - Headless Boot Startup Script
:: ====================================================================
:: This script runs automatically via Windows Task Scheduler.
:: It is triggered TWICE for maximum reliability:
::   1. At SYSTEM boot (before login) — via ACHME_CRM_AutoBoot task
::   2. At user login (fallback)      — via ACHME_CRM_Login_Startup task
::
:: It restores MySQL + Nginx + PM2 backend — NO user interaction needed.
:: Target: All services running within 30 seconds of power-on.
:: ====================================================================

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
set "NGINX_DIR=C:\nginx"
set "BACKEND_PORT=5000"
set "LOG_DIR=%ROOT%\logs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
set "LOGFILE=%LOG_DIR%\startup-restore.log"

echo [%DATE% %TIME%] ===== ACHME Boot Startup (PID: %RANDOM%) ===== >> "%LOGFILE%"
cd /d "%ROOT%"

:: ====================================================================
:: PHASE 0: Load saved paths (critical for SYSTEM account)
:: ====================================================================
:: These path files are written by start-servers.bat during initial setup.
:: When running as SYSTEM, the normal user PATH may not include Node/PM2.

:: Add Node.js to PATH
if exist "%ROOT%\.achme-node-dir" (
  for /f "usebackq tokens=*" %%a in ("%ROOT%\.achme-node-dir") do set "ACHME_NODE_DIR=%%a"
  set "PATH=!ACHME_NODE_DIR!;!PATH!"
  echo [%DATE% %TIME%] Loaded Node dir: !ACHME_NODE_DIR! >> "%LOGFILE%"
)

:: Add npm global prefix (where pm2.cmd lives) to PATH
if exist "%ROOT%\.achme-npm-prefix" (
  for /f "usebackq tokens=*" %%a in ("%ROOT%\.achme-npm-prefix") do set "ACHME_NPM_PREFIX=%%a"
  set "PATH=!ACHME_NPM_PREFIX!;!PATH!"
  echo [%DATE% %TIME%] Loaded npm prefix: !ACHME_NPM_PREFIX! >> "%LOGFILE%"
)

:: Set PM2_HOME so PM2 can find its saved process list
if exist "%ROOT%\.achme-pm2-home" (
  for /f "usebackq tokens=*" %%a in ("%ROOT%\.achme-pm2-home") do set "PM2_HOME=%%a"
  echo [%DATE% %TIME%] Loaded PM2 home: !PM2_HOME! >> "%LOGFILE%"
)

:: Fallback: add common Node.js install locations to PATH
if exist "C:\Program Files\nodejs\node.exe" set "PATH=C:\Program Files\nodejs;!PATH!"
if exist "C:\Program Files (x86)\nodejs\node.exe" set "PATH=C:\Program Files (x86)\nodejs;!PATH!"

:: Fallback: scan user profiles for npm global prefix
if not defined ACHME_NPM_PREFIX (
  for /d %%u in ("C:\Users\*") do (
    if exist "%%u\AppData\Roaming\npm\pm2.cmd" (
      set "PATH=%%u\AppData\Roaming\npm;!PATH!"
      echo [%DATE% %TIME%] Found npm in: %%u\AppData\Roaming\npm >> "%LOGFILE%"
      goto :npm_path_done
    )
  )
)
:npm_path_done

:: ====================================================================
:: PHASE 1: Brief wait for system initialization
:: ====================================================================
:: At SYSTEM boot, Windows needs a moment to start network stack and
:: other services. 8 seconds is enough for most systems.
echo [%DATE% %TIME%] Waiting 8 seconds for system initialization... >> "%LOGFILE%"
timeout /t 8 /nobreak >nul

:: ====================================================================
:: PHASE 2: Start MySQL (with retry loop — max 6 attempts, 30s total)
:: ====================================================================
echo [%DATE% %TIME%] Phase 2: MySQL check... >> "%LOGFILE%"
set "MYSQL_READY=0"
set "MYSQL_RETRIES=0"

:mysql_retry
powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-NetTCPConnection -LocalPort 3306 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" >nul 2>&1
if not errorlevel 1 (
  set "MYSQL_READY=1"
  echo [%DATE% %TIME%] MySQL is running on port 3306. >> "%LOGFILE%"
  goto :mysql_done
)

if !MYSQL_RETRIES! GEQ 6 (
  echo [%DATE% %TIME%] WARNING: MySQL not responding after 6 retries. >> "%LOGFILE%"
  goto :mysql_done
)

set /a MYSQL_RETRIES+=1
echo [%DATE% %TIME%] MySQL not ready (attempt !MYSQL_RETRIES!/6). Trying to start... >> "%LOGFILE%"
net start MySQL80 >nul 2>&1
net start MySQL >nul 2>&1
net start MySQL57 >nul 2>&1
net start MySQL84 >nul 2>&1
net start MySQL90 >nul 2>&1
net start mysql >nul 2>&1
net start MariaDB >nul 2>&1
timeout /t 5 /nobreak >nul
goto :mysql_retry

:mysql_done

:: ====================================================================
:: PHASE 3: Detect current LAN IP
:: ====================================================================
set "LAN_IP=127.0.0.1"
for /f "usebackq tokens=*" %%p in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$gw = (Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Select-Object -First 1).NextHop; if ($gw) { $ip = (Find-NetRoute -RemoteIPAddress $gw -ErrorAction SilentlyContinue).LocalIPAddress; if ($ip) { echo $ip; exit } }; (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Ethernet*', 'Wi-Fi*', 'Local Area Connection*' -Type Unicast -ErrorAction SilentlyContinue).IPAddress; (Get-NetIPAddress -AddressFamily IPv4 -Type Unicast -ErrorAction SilentlyContinue).IPAddress"`) do (
  set "CANDIDATE=%%p"
  if not "!CANDIDATE!"=="" (
    set "PREFIX1=!CANDIDATE:~0,4!"
    set "PREFIX2=!CANDIDATE:~0,8!"
    if not "!PREFIX1!"=="127." (
      if not "!PREFIX2!"=="169.254." (
        set "LAN_IP=!CANDIDATE!"
        goto :boot_got_ip
      )
    )
  )
)
:boot_got_ip
echo [%DATE% %TIME%] Detected LAN IP: %LAN_IP% >> "%LOGFILE%"
echo %LAN_IP%>"%ROOT%\.last-build-ip"

:: --- Update Hosts file dynamically on boot to support dynamic IP changes ---
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$hostsFile = \"$env:SystemRoot\System32\drivers\etc\hosts\";" ^
  "$domains = @('achme.com', 'www.achme.com', 'IBM-SERVER', 'IBM-SERVER.achme.com');" ^
  "$content = [System.IO.File]::ReadAllLines($hostsFile);" ^
  "$filtered = $content | Where-Object { $line = $_.Trim(); $keep = $true; foreach($d in $domains) { if ($line -match ('(?i)\b' + [regex]::Escape($d) + '\b')) { $keep = $false; break } }; $keep };" ^
  "$ip = '%LAN_IP%';" ^
  "$newMappings = @(" ^
  "    ''," ^
  "    '# ACHME CRM Server Mapping (auto-generated by achme-startup.bat on boot)'," ^
  "    ($ip + '    achme.com    www.achme.com')," ^
  "    ($ip + '    IBM-SERVER   IBM-SERVER.achme.com')" ^
  ");" ^
  "[System.IO.File]::WriteAllLines($hostsFile, ($filtered + $newMappings));" >>"%LOGFILE%" 2>&1
ipconfig /flushdns >nul 2>&1
echo [%DATE% %TIME%] Server hosts file updated with active dynamic IP: %LAN_IP% >> "%LOGFILE%"

:: ====================================================================
:: PHASE 4: Write nginx.conf and start Nginx
:: ====================================================================
echo [%DATE% %TIME%] Phase 4: Nginx... >> "%LOGFILE%"

:: Also try local nginx folder as fallback
if not exist "%NGINX_DIR%\nginx.exe" (
  if exist "%ROOT%\nginx-local\nginx.exe" (
    set "NGINX_DIR=%ROOT%\nginx-local"
    echo [%DATE% %TIME%] Using local nginx at: !NGINX_DIR! >> "%LOGFILE%"
  ) else if exist "%ROOT%\nginx\nginx.exe" (
    set "NGINX_DIR=%ROOT%\nginx"
    echo [%DATE% %TIME%] Using local nginx at: !NGINX_DIR! >> "%LOGFILE%"
  )
)

if exist "%NGINX_DIR%\nginx.exe" (
  :: Stop any conflicting Nginx service first
  net stop nginx >nul 2>&1
  sc stop nginx >nul 2>&1

  :: Create directories
  if not exist "%NGINX_DIR%\html\achme" mkdir "%NGINX_DIR%\html\achme"
  if not exist "%NGINX_DIR%\logs" mkdir "%NGINX_DIR%\logs"

  :: Write nginx.conf
  call :write_nginx_conf
  echo [%DATE% %TIME%] nginx.conf written >> "%LOGFILE%"

  :: Check if nginx is already running
  tasklist /FI "IMAGENAME eq nginx.exe" 2>nul | findstr /i "nginx.exe" >nul 2>&1
  if errorlevel 1 (
    :: Not running — start it as a hidden background process
    pushd "%NGINX_DIR%"
    start "" /B nginx.exe
    popd
    echo [%DATE% %TIME%] Nginx started on port 82 >> "%LOGFILE%"
  ) else (
    :: Already running — reload config
    pushd "%NGINX_DIR%"
    nginx.exe -s reload >nul 2>&1
    popd
    echo [%DATE% %TIME%] Nginx reloaded >> "%LOGFILE%"
  )
) else (
  echo [%DATE% %TIME%] Nginx not found at %NGINX_DIR% - run start-servers.bat to install >> "%LOGFILE%"
)

:: ====================================================================
:: PHASE 5: Start PM2 backend
:: ====================================================================
echo [%DATE% %TIME%] Phase 5: PM2 backend... >> "%LOGFILE%"

:: --- Dynamically find PM2 executable ---
set "PM2_EXEC="

:: Method 1: Read saved npm prefix
if exist "%ROOT%\.achme-npm-prefix" (
  set /p SAVED_NPM_PREFIX=<"%ROOT%\.achme-npm-prefix"
  if exist "!SAVED_NPM_PREFIX!\pm2.cmd" (
    set "PM2_EXEC=!SAVED_NPM_PREFIX!\pm2.cmd"
    echo [%DATE% %TIME%] PM2 found via saved prefix: !PM2_EXEC! >> "%LOGFILE%"
  )
)

:: Method 2: Check PATH
if not defined PM2_EXEC (
  where pm2 >nul 2>&1
  if not errorlevel 1 (
    for /f "tokens=*" %%p in ('where pm2 2^>nul') do (
      if not defined PM2_EXEC set "PM2_EXEC=%%p"
    )
    echo [%DATE% %TIME%] PM2 found via PATH: !PM2_EXEC! >> "%LOGFILE%"
  )
)

:: Method 3: Try npm config get prefix
if not defined PM2_EXEC (
  where npm >nul 2>&1
  if not errorlevel 1 (
    for /f "tokens=*" %%p in ('npm config get prefix 2^>nul') do (
      if exist "%%p\pm2.cmd" (
        set "PM2_EXEC=%%p\pm2.cmd"
        echo [%DATE% %TIME%] PM2 found via npm prefix: !PM2_EXEC! >> "%LOGFILE%"
      )
    )
  )
)

:: Method 4: Scan all user profiles (for SYSTEM account compatibility)
if not defined PM2_EXEC (
  for /d %%u in ("C:\Users\*") do (
    if exist "%%u\AppData\Roaming\npm\pm2.cmd" (
      if not defined PM2_EXEC (
        set "PM2_EXEC=%%u\AppData\Roaming\npm\pm2.cmd"
        echo [%DATE% %TIME%] PM2 found by scanning: !PM2_EXEC! >> "%LOGFILE%"
      )
    )
  )
)

:: Method 5: Check common AppData path for current user
if not defined PM2_EXEC (
  if exist "%APPDATA%\npm\pm2.cmd" (
    set "PM2_EXEC=%APPDATA%\npm\pm2.cmd"
    echo [%DATE% %TIME%] PM2 found in APPDATA: !PM2_EXEC! >> "%LOGFILE%"
  )
)

:: --- Set PM2_HOME ---
if not defined PM2_HOME (
  :: Read saved PM2 home
  if exist "%ROOT%\.achme-pm2-home" (
    set /p PM2_HOME=<"%ROOT%\.achme-pm2-home"
  )
)

:: Fallback: scan user profiles for .pm2 directory with dump file
if not defined PM2_HOME (
  for /d %%u in ("C:\Users\*") do (
    if exist "%%u\.pm2\dump.pm2" (
      if not defined PM2_HOME (
        set "PM2_HOME=%%u\.pm2"
        echo [%DATE% %TIME%] PM2_HOME found by scanning: !PM2_HOME! >> "%LOGFILE%"
      )
    )
  )
)

:: Another fallback: use any .pm2 directory
if not defined PM2_HOME (
  for /d %%u in ("C:\Users\*") do (
    if exist "%%u\.pm2" (
      if not defined PM2_HOME (
        set "PM2_HOME=%%u\.pm2"
        echo [%DATE% %TIME%] PM2_HOME fallback: !PM2_HOME! >> "%LOGFILE%"
      )
    )
  )
)

echo [%DATE% %TIME%] Final PM2_EXEC: %PM2_EXEC% >> "%LOGFILE%"
echo [%DATE% %TIME%] Final PM2_HOME: %PM2_HOME% >> "%LOGFILE%"

:: --- Start PM2 ---
if defined PM2_EXEC (
  :: Spawn daemon cleanly with NUL handles
  call "%PM2_EXEC%" ping >nul 2>&1

  :: Try resurrect first (restores saved PM2 process list)
  call "%PM2_EXEC%" resurrect >nul 2>&1

  :: Verify achme-backend is running
  call "%PM2_EXEC%" describe achme-backend >nul 2>&1
  if errorlevel 1 (
    echo [%DATE% %TIME%] achme-backend not found after resurrect. Starting from config... >> "%LOGFILE%"
    :: Start from ecosystem config
    if exist "%ROOT%\backend\ecosystem.production.config.js" (
      cd /d "%ROOT%\backend"
      call "%PM2_EXEC%" start ecosystem.production.config.js >nul 2>&1
      call "%PM2_EXEC%" save >nul 2>&1
      cd /d "%ROOT%"
    ) else (
      :: Last resort: start server.js directly
      cd /d "%ROOT%\backend"
      call "%PM2_EXEC%" start server.js --name achme-backend >nul 2>&1
      call "%PM2_EXEC%" save >nul 2>&1
      cd /d "%ROOT%"
    )
  ) else (
    echo [%DATE% %TIME%] achme-backend successfully restored via PM2 resurrect >> "%LOGFILE%"
  )
  echo [%DATE% %TIME%] PM2 backend started >> "%LOGFILE%"
) else (
  echo [%DATE% %TIME%] PM2 NOT FOUND — run start-servers.bat to install PM2 >> "%LOGFILE%"
)

:: Dynamically open the Access Guide (show.bat) on user login (ignores SYSTEM account)
if not "%USERNAME%"=="SYSTEM" (
  if exist "%ROOT%\show.bat" start "" "%ROOT%\show.bat"
)

echo [%DATE% %TIME%] ===== Boot startup complete ===== >> "%LOGFILE%"
exit /b 0

:: ====================================================================
:: SUBROUTINE: Write nginx.conf (exact same config as start-servers.bat)
:: ====================================================================
:write_nginx_conf
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
echo             add_header Cache-Control "no-store, no-cache, must-revalidate, max-age=0";
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
echo             proxy_read_timeout  3600s;
echo         }
echo.
echo         location /nginx-health {
echo             return 200 "Nginx OK\n";
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
) > "%NGINX_DIR%\conf\nginx.conf"
exit /b 0
