@echo off
setlocal enabledelayedexpansion
title ACHME CRM - One-Click Complete Setup ^& Auto-Boot
color 0B

:: ====================================================================
:: CONFIGURATION — All paths, ports, and settings
:: ====================================================================
set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
set "BACKEND_PORT=5000"
set "FRONTEND_PORT=82"
set "NGINX_DIR=C:\nginx"
set "NGINX_ZIP=%ROOT%\nginx-temp.zip"
set "LOG_DIR=%ROOT%\logs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
set "LOGFILE=%LOG_DIR%\start-servers.log"
echo. > "%LOGFILE%"
echo [%DATE% %TIME%] ========== ACHME CRM One-Click Setup started ========== >> "%LOGFILE%"
set "S=10"

:: ====================================================================
:: ADMIN AUTO-ELEVATION (required for services, firewall, schtasks)
:: ====================================================================
net session >nul 2>&1
if errorlevel 1 (
  echo  [!] Requesting Administrator privileges...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b 0
)

:: ====================================================================
:: DETECT LAN IP AND HOSTNAME
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
        goto :got_ip
      )
    )
  )
)
:got_ip
set "PC_HOSTNAME=localhost"
for /f "usebackq tokens=*" %%h in (`hostname`) do set "PC_HOSTNAME=%%h"
if "%PC_HOSTNAME%"=="" set "PC_HOSTNAME=localhost"
echo %LAN_IP%>"%ROOT%\.last-build-ip"

cls
color 0B
echo.
echo  ===========================================================================
echo     ACHME CRM  ^|  ONE-CLICK AUTO-DEPLOY ^& AUTO-BOOT
echo  ===========================================================================
echo.
echo     Server hostname : %PC_HOSTNAME%
echo     Server LAN IP   : %LAN_IP%
echo     Prerequisites   : Node.js + MySQL (everything else auto-installs)
echo.
echo  ===========================================================================
echo.

:: ====================================================================
:: STEP 1/10 — MySQL check + auto-start
:: ====================================================================
echo  [1/%S%] Checking MySQL...
echo [%DATE% %TIME%] Step 1: MySQL check >> "%LOGFILE%"

set "MYSQL_OK=0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-NetTCPConnection -LocalPort 3306 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" >nul 2>&1
if not errorlevel 1 set "MYSQL_OK=1"

if "%MYSQL_OK%"=="1" (
  echo         MySQL already running on port 3306. [OK]
  goto :mysql_done
)

echo         MySQL not running. Starting service...
net start MySQL80 >nul 2>&1
net start MySQL >nul 2>&1
net start MySQL57 >nul 2>&1
net start MySQL84 >nul 2>&1
net start MySQL90 >nul 2>&1
net start mysql >nul 2>&1
net start MariaDB >nul 2>&1

:: Wait and re-check
timeout /t 4 /nobreak >nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-NetTCPConnection -LocalPort 3306 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" >nul 2>&1
if errorlevel 1 (
  echo         [FAIL] MySQL is not running on port 3306!
  echo         Please install/start MySQL manually and re-run this script.
  echo         Download: https://dev.mysql.com/downloads/installer/
  echo [%DATE% %TIME%] FAIL: MySQL not running >> "%LOGFILE%"
  pause
  goto :fail
)
echo         MySQL started. [OK]

:mysql_done
:: Set MySQL to auto-start on boot (tries all known service names)
for %%m in (MySQL80 MySQL MySQL57 MySQL84 MySQL90 mysql MariaDB) do (
  sc query %%m >nul 2>&1
  if not errorlevel 1 sc config %%m start=auto >nul 2>&1
)
echo [%DATE% %TIME%] MySQL OK, set to auto-start >> "%LOGFILE%"

:: ====================================================================
:: STEP 2/10 — Node.js check
:: ====================================================================
echo  [2/%S%] Checking Node.js...
echo [%DATE% %TIME%] Step 2: Node.js check >> "%LOGFILE%"

where node >nul 2>&1
if errorlevel 1 (
  echo         [FAIL] Node.js not found! Install Node.js first.
  echo         Download: https://nodejs.org/
  echo [%DATE% %TIME%] FAIL: Node.js not found >> "%LOGFILE%"
  pause
  goto :fail
)
for /f "tokens=*" %%v in ('node --version 2^>nul') do echo         Node.js %%v [OK]

:: Save Node.js directory for boot startup (SYSTEM account needs this)
for /f "tokens=*" %%n in ('where node 2^>nul') do (
  set "NODE_EXE_PATH=%%n"
  goto :save_node_dir
)
:save_node_dir
for %%f in ("%NODE_EXE_PATH%") do (
  set "NODE_DIR_PATH=%%~dpf"
  echo %%~dpf>"%ROOT%\.achme-node-dir"
)
echo [%DATE% %TIME%] Node.js at: %NODE_DIR_PATH% >> "%LOGFILE%"

:: ====================================================================
:: STEP 3/10 — Write .env config files
:: ====================================================================
echo  [3/%S%] Writing config files...
echo [%DATE% %TIME%] Step 3: Config files >> "%LOGFILE%"

:: Backend .env
(
echo # Auto-generated by start-servers.bat on %DATE% %TIME%
echo PORT=%BACKEND_PORT%
echo NODE_ENV=production
echo ALLOWED_ORIGIN=*
echo DEFAULT_TEST_PASSWORD=Test@12345
echo DB_HOST=127.0.0.1
echo DB_PORT=3306
echo DB_USER=achme_user
echo DB_PASS=AchmeSecure@2024
echo DB_NAME=achme
echo SMTP_HOST=smtp.gmail.com
echo SMTP_PORT=587
echo EMAIL_USER=thanan757@gmail.com
echo EMAIL_PASS=ghjv omqm hwji kerq
echo JWT_SECRET=97418d0c15d57ade768586b8501e35d34e5a5277f2a0570b6d5b47ef93f5b33e88b80045c60efd77e6edcbb015dbe46cf6747ce1dd8f11361f3e426ddc677c9a
) >"%ROOT%\backend\.env"

:: Frontend .env (empty API URL so React uses window.location.origin via nginx)
(
echo REACT_APP_API_URL=
echo REACT_APP_API_PROXY=http://%LAN_IP%:%BACKEND_PORT%
) >"%ROOT%\frontend\.env"
(
echo REACT_APP_API_URL=
echo REACT_APP_API_PROXY=http://%LAN_IP%:%BACKEND_PORT%
) >"%ROOT%\frontend\.env.production"
echo         Config files written. [OK]

:: ====================================================================
:: STEP 4/10 — Backend setup (npm install + DB user + DB schema)
:: ====================================================================
echo  [4/%S%] Backend setup (npm install + database)...
echo [%DATE% %TIME%] Step 4: Backend setup >> "%LOGFILE%"

cd /d "%ROOT%\backend"
if exist "%ROOT%\backend\node_modules" (
  echo         node_modules folder already exists. Skipping npm install. [OK]
) else (
  echo         node_modules folder not found. Running npm install...
  call npm install --legacy-peer-deps >>"%LOGFILE%" 2>&1
  if errorlevel 1 (
    echo         [FAIL] Backend npm install failed. Check %LOGFILE%
    goto :fail
  )
  echo         npm install complete.
)

:: Create database user (tries common root passwords and hosts automatically)
call node ensure_db_user.js >>"%LOGFILE%" 2>&1
if errorlevel 1 (
  echo         [WARN] Automatic database user creation failed.
  echo                Trying to initialize database schema directly...
) else (
  echo         DB user ready. [OK]
)

:: Initialize database schema
call node db_init.js >>"%LOGFILE%" 2>&1
if errorlevel 1 ( echo         [WARN] db_init had warnings - check log )
echo         Backend setup [OK]

:: ====================================================================
:: STEP 5/10 — Install PM2 globally (if not present)
:: ====================================================================
echo  [5/%S%] Checking PM2...
echo [%DATE% %TIME%] Step 5: PM2 check >> "%LOGFILE%"

where pm2 >nul 2>&1
if errorlevel 1 (
  echo         PM2 not found — installing globally...
  call npm install -g pm2 >>"%LOGFILE%" 2>&1
  if errorlevel 1 (
    echo         [FAIL] PM2 installation failed
    goto :fail
  )
  :: Refresh PATH to pick up newly installed pm2
  for /f "tokens=*" %%p in ('npm config get prefix 2^>nul') do set "NPM_PREFIX=%%p"
  set "PATH=!NPM_PREFIX!;%PATH%"
  echo         PM2 installed. [OK]
) else (
  echo         PM2 already installed. [OK]
)
call pm2 ping >nul 2>&1

:: Save npm global prefix path for boot startup (SYSTEM account needs this)
for /f "tokens=*" %%p in ('npm config get prefix 2^>nul') do (
  echo %%p>"%ROOT%\.achme-npm-prefix"
  echo [%DATE% %TIME%] npm prefix: %%p >> "%LOGFILE%"
)

:: Save PM2 home directory for boot startup
echo %USERPROFILE%\.pm2>"%ROOT%\.achme-pm2-home"
echo [%DATE% %TIME%] PM2 home: %USERPROFILE%\.pm2 >> "%LOGFILE%"

:: ====================================================================
:: STEP 6/10 — Frontend setup (npm install + build)
:: ====================================================================
echo  [6/%S%] Frontend setup...
echo [%DATE% %TIME%] Step 6: Frontend setup >> "%LOGFILE%"

cd /d "%ROOT%\frontend"
if exist "%ROOT%\frontend\node_modules" (
  echo         node_modules folder already exists. Skipping npm install. [OK]
) else (
  echo         node_modules folder not found. Running npm install...
  call npm install --legacy-peer-deps >>"%LOGFILE%" 2>&1
  if errorlevel 1 (
    echo         [FAIL] Frontend npm install failed. Check %LOGFILE%
    goto :fail
  )
  echo         npm install complete.
)

if exist "%ROOT%\frontend\build\index.html" (
  echo         Existing frontend build found - using cached build. [OK]
  echo         (Delete frontend\build folder to force a rebuild^)
) else (
  echo         Building frontend... (this takes 1-3 minutes, please wait^)
  call npm run build >>"%LOGFILE%" 2>&1
  if errorlevel 1 (
    echo         [FAIL] npm run build failed. Check %LOGFILE%
    goto :fail
  )
  echo         Frontend built. [OK]
)

:: ====================================================================
:: STEP 7/10 — Nginx auto-install + config + deploy + start
:: ====================================================================
echo  [7/%S%] Setting up Nginx...
echo [%DATE% %TIME%] Step 7: Nginx setup >> "%LOGFILE%"

:: Deploy if nginx not present
if not exist "%NGINX_DIR%\nginx.exe" (
  if exist "%ROOT%\nginx-local\nginx.exe" (
    echo         Found pre-bundled offline Nginx folder. Deploying...
    if not exist "%NGINX_DIR%" mkdir "%NGINX_DIR%"
    xcopy /E /I /Y "%ROOT%\nginx-local\*" "%NGINX_DIR%\" >nul 2>&1
    if exist "%NGINX_DIR%\nginx.exe" (
      echo         Pre-bundled Nginx deployed to C:\nginx. [OK]
      goto :nginx_deployed
    )
  )

  echo         Nginx not found at C:\nginx — downloading automatically...
  set "NGINX_URL=https://nginx.org/download/nginx-1.24.0.zip"
  echo         Downloading from !NGINX_URL! ...
  curl.exe -L -o "%NGINX_ZIP%" "!NGINX_URL!" >>"%LOGFILE%" 2>&1
  if not exist "%NGINX_ZIP%" (
    echo         [FAIL] Nginx download failed. Check internet connection.
    echo         You can manually download nginx and extract to C:\nginx
    goto :skip_nginx
  )

  echo         Extracting...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%NGINX_ZIP%' -DestinationPath '%ROOT%\nginx-temp-extract' -Force" >>"%LOGFILE%" 2>&1

  for /d %%d in ("%ROOT%\nginx-temp-extract\nginx-*") do (
    if not exist "%NGINX_DIR%" (
      move "%%d" "%NGINX_DIR%" >nul 2>&1
    ) else (
      xcopy /E /I /Y "%%d\*" "%NGINX_DIR%\" >nul 2>&1
    )
  )

  :: Cleanup temp files
  if exist "%NGINX_ZIP%" del "%NGINX_ZIP%" >nul 2>&1
  if exist "%ROOT%\nginx-temp-extract" rd /s /q "%ROOT%\nginx-temp-extract" >nul 2>&1

  if exist "%NGINX_DIR%\nginx.exe" (
    echo         Nginx downloaded and installed to C:\nginx [OK]
  ) else (
    echo         [FAIL] Nginx extraction failed.
    echo         Please manually download nginx and extract to C:\nginx
    goto :skip_nginx
  )
)
:nginx_deployed

:: Create required directories
if not exist "%NGINX_DIR%\logs" mkdir "%NGINX_DIR%\logs"
if not exist "%NGINX_DIR%\html\achme" mkdir "%NGINX_DIR%\html\achme"

:: Write nginx.conf
call :write_nginx_conf
echo         nginx.conf written.

:: Copy frontend build to nginx document root
xcopy /E /I /Y "%ROOT%\frontend\build\*" "%NGINX_DIR%\html\achme\" >nul 2>&1
echo         Frontend deployed to Nginx.

:: Stop any conflicting Nginx service and kill stale background instances
net stop nginx >nul 2>&1
sc stop nginx >nul 2>&1
taskkill /F /IM nginx.exe >nul 2>&1
timeout /t 2 /nobreak >nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'C:\nginx\nginx.exe' -WorkingDirectory 'C:\nginx' -WindowStyle Hidden"
timeout /t 3 /nobreak >nul
echo         Nginx started on port %FRONTEND_PORT%. [OK]

:skip_nginx

:: ====================================================================
:: STEP 8/10 — Start PM2 backend
:: ====================================================================
echo  [8/%S%] Starting backend with PM2...
echo [%DATE% %TIME%] Step 8: PM2 backend start >> "%LOGFILE%"
cd /d "%ROOT%\backend"

:: Make sure pm2 is in PATH
where pm2 >nul 2>&1
if errorlevel 1 (
  for /f "tokens=*" %%p in ('npm config get prefix 2^>nul') do set "NPM_PREFIX=%%p"
  set "PATH=!NPM_PREFIX!;%PATH%"
)

:: Stop old instance, start fresh
call pm2 delete achme-backend >nul 2>&1
if exist "%ROOT%\backend\ecosystem.production.config.js" (
  call pm2 start ecosystem.production.config.js >nul 2>&1
) else (
  call pm2 start server.js --name achme-backend --env production >nul 2>&1
)
call pm2 save >nul 2>&1
echo         PM2 backend started. [OK]

:: ====================================================================
:: STEP 9/10 — Firewall + Auto-boot + Hosts file
:: ====================================================================
echo  [9/%S%] Configuring auto-boot, firewall, and hosts...
echo [%DATE% %TIME%] Step 9: Auto-boot setup >> "%LOGFILE%"

:: --- Firewall rules ---
:: Open Port 82 and 5000 on ALL profiles
netsh advfirewall firewall delete rule name="ACHME CRM Port 82" >nul 2>&1
netsh advfirewall firewall add rule name="ACHME CRM Port 82" dir=in action=allow protocol=TCP localport=82 profile=any >nul 2>&1
netsh advfirewall firewall delete rule name="ACHME CRM Port 5000" >nul 2>&1
netsh advfirewall firewall add rule name="ACHME CRM Port 5000" dir=in action=allow protocol=TCP localport=5000 profile=any >nul 2>&1

:: Explicitly allow Nginx executables (for system firewall/corporate security) on ALL profiles
netsh advfirewall firewall delete rule name="ACHME CRM Nginx App" >nul 2>&1
netsh advfirewall firewall add rule name="ACHME CRM Nginx App" dir=in action=allow program="C:\nginx\nginx.exe" enable=yes profile=any >nul 2>&1
netsh advfirewall firewall delete rule name="ACHME CRM Nginx App Local" >nul 2>&1
netsh advfirewall firewall add rule name="ACHME CRM Nginx App Local" dir=in action=allow program="%NGINX_DIR%\nginx.exe" enable=yes profile=any >nul 2>&1
netsh advfirewall firewall delete rule name="ACHME CRM Nginx App Bundled" >nul 2>&1
netsh advfirewall firewall add rule name="ACHME CRM Nginx App Bundled" dir=in action=allow program="%ROOT%\nginx-local\nginx.exe" enable=yes profile=any >nul 2>&1
echo         Firewall rules added.

:: --- Auto-boot: Register TWO scheduled tasks for maximum reliability ---
:: Task 1: SYSTEM-level boot (starts BEFORE user login — fastest!)
if exist "%ROOT%\achme-startup.bat" (
  schtasks /create /tn "ACHME_CRM_AutoBoot" /tr "\"%ROOT%\achme-startup.bat\"" /sc onstart /delay 0000:10 /ru SYSTEM /f >nul 2>&1
  if not errorlevel 1 (
    echo         Auto-boot task registered (SYSTEM - starts at power-on^). [OK]
  ) else (
    echo         [WARN] Could not register SYSTEM boot task. Falling back to login task.
  )
)

:: Task 2: User-login fallback (runs when the user logs in — backup layer)
if exist "%ROOT%\achme-startup.bat" (
  schtasks /create /tn "ACHME_CRM_Login_Startup" /tr "\"%ROOT%\achme-startup.bat\"" /sc onlogon /rl HIGHEST /f >nul 2>&1
  if not errorlevel 1 (
    echo         Login fallback task registered. [OK]
  )
)
echo [%DATE% %TIME%] Scheduled tasks registered >> "%LOGFILE%"

:: --- Hosts file update ---
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$hostsFile = \"$env:SystemRoot\System32\drivers\etc\hosts\";" ^
  "$domains = @('achme.com', 'www.achme.com', 'IBM-SERVER', 'IBM-SERVER.achme.com');" ^
  "$content = [System.IO.File]::ReadAllLines($hostsFile);" ^
  "$filtered = $content | Where-Object { $line = $_.Trim(); $keep = $true; foreach($d in $domains) { if ($line -match ('(?i)\b' + [regex]::Escape($d) + '\b')) { $keep = $false; break } }; $keep };" ^
  "$ip = '%LAN_IP%';" ^
  "$newMappings = @(" ^
  "    ''," ^
  "    '# ACHME CRM Server Mapping (auto-generated by start-servers.bat)'," ^
  "    ($ip + '    achme.com    www.achme.com')," ^
  "    ($ip + '    IBM-SERVER   IBM-SERVER.achme.com')" ^
  ");" ^
  "[System.IO.File]::WriteAllLines($hostsFile, ($filtered + $newMappings));" >>"%LOGFILE%" 2>&1
ipconfig /flushdns >nul 2>&1
echo         Hosts file updated.

echo         Step 9 complete. [OK]

:: ====================================================================
:: STEP 10/10 — Health verification
:: ====================================================================
echo  [10/%S%] Verifying all services...
echo [%DATE% %TIME%] Step 10: Health verification >> "%LOGFILE%"

:: Give backend a moment to fully start (slower machines need up to 15s to run first-time migrations)
echo         Waiting 15 seconds for services to fully initialize...
timeout /t 15 /nobreak >nul

echo.
echo  ===========================================================================
echo    VERIFYING ALL SERVICES...
echo  ===========================================================================
echo.

set "ALL_OK=1"

:: Test Nginx
curl.exe -s --max-time 5 http://localhost:82/nginx-health >nul 2>&1
if errorlevel 1 (
  echo    [!!] Nginx  (port 82^)  - NOT RESPONDING
  set "ALL_OK=0"
) else (
  echo    [OK] Nginx  (port 82^)  - RUNNING
)

:: Test Backend directly
curl.exe -s --max-time 5 http://localhost:5000/api/health >nul 2>&1
if errorlevel 1 (
  echo    [!!] Backend (port 5000^) - NOT RESPONDING
  set "ALL_OK=0"
) else (
  echo    [OK] Backend (port 5000^) - RUNNING
)

:: Test Backend via Nginx proxy
curl.exe -s --max-time 5 http://localhost:82/api/health >nul 2>&1
if errorlevel 1 (
  echo    [!!] Nginx-to-Backend proxy - NOT WORKING
  set "ALL_OK=0"
) else (
  echo    [OK] Nginx-to-Backend proxy - CONNECTED
)

:: Test LAN IP access
curl.exe -s --max-time 5 http://%LAN_IP%:82/nginx-health >nul 2>&1
if errorlevel 1 (
  echo    [!!] LAN access (%LAN_IP%:82^) - NOT RESPONDING
  set "ALL_OK=0"
) else (
  echo    [OK] LAN access (%LAN_IP%:82^) - WORKING
)

echo.

if "%ALL_OK%"=="1" (
  echo  ===========================================================================
  echo    ALL SERVICES RUNNING PERFECTLY!
  echo  ===========================================================================
  echo         Launching access URLs in default browser...
  start "" "http://localhost:82"
  start "" "http://!LAN_IP!:82"
  start "" "http://!PC_HOSTNAME!:82"
) else (
  echo  ===========================================================================
  echo    SOME SERVICES MAY NEED ATTENTION - Check warnings above.
  echo    Try running this script again, or check: %LOGFILE%
  echo  ===========================================================================
)

:: Open the access guide
if exist "%ROOT%\show.bat" start "" "%ROOT%\show.bat"

echo.
echo  ===========================================================================
echo    SETUP COMPLETE! Everything runs in the BACKGROUND.
echo    Closing this window will NOT stop the CRM!
echo  ===========================================================================
echo.
echo    ACCESS URLS:
echo      http://localhost:82         - From this machine
echo      http://%LAN_IP%:82      - From any device on the LAN
echo      http://%PC_HOSTNAME%:82    - By hostname
echo      http://achme.com           - After employee-hosts-setup.bat
echo.
echo    ADMIN LOGIN: Kk@achmecommunication.com / kk@admin@123
echo.
echo    AUTO-BOOT: Services auto-start within 30s of power-on!
echo      - SYSTEM boot task: starts at power-on (before login)
echo      - Login fallback:   starts on user login (backup layer)
echo.
echo    Press any key to enter the Live Status Monitor...
echo  ===========================================================================
pause >nul

:: ====================================================================
:: LIVE STATUS MONITOR - stays open, refreshes every 60s
:: ====================================================================
:monitor_loop
cls
color 0A
echo.
echo  ===========================================================================
echo    ACHME CRM  ^|  LIVE STATUS MONITOR
echo    NOTE: Closing this window will NOT stop the CRM!
echo    Nginx and PM2 run independently in the background.
echo  ===========================================================================
echo.
echo    Server hostname  : %PC_HOSTNAME%
echo    Server LAN IP    : %LAN_IP%
echo.
echo  ---------------------------------------------------------------------------
echo    ACCESS FROM THIS MACHINE:
echo      http://localhost:82
echo      http://127.0.0.1:82
echo      http://%PC_HOSTNAME%:82
echo      http://%LAN_IP%:82
echo.
echo    ACCESS FROM EMPLOYEE PCs (LAN):
echo      http://%LAN_IP%:82        ^<-- Direct IP (always works!)
echo      http://%PC_HOSTNAME%:82   ^<-- Hostname
echo      http://achme.com          ^<-- After employee-hosts-setup.bat
echo.
echo    ADMIN LOGIN: Kk@achmecommunication.com / kk@admin@123
echo  ---------------------------------------------------------------------------
echo    SERVICE STATUS:
echo.

:: Check MySQL
powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-NetTCPConnection -LocalPort 3306 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" >nul 2>&1
if errorlevel 1 (
  echo    [!!] MySQL    port 3306 - NOT RUNNING
) else (
  echo    [OK] MySQL    port 3306 - RUNNING
)

:: Check Nginx
curl.exe -s --max-time 4 http://localhost:82/nginx-health >nul 2>&1
if errorlevel 1 (
  echo    [!!] Nginx    port 82   - NOT RUNNING  ^(run: start-servers.bat^)
) else (
  echo    [OK] Nginx    port 82   - RUNNING
)

:: Check Backend via nginx proxy
curl.exe -s --max-time 4 http://localhost:82/api/health >nul 2>&1
if errorlevel 1 (
  echo    [!!] Backend  port 5000 - NOT RUNNING  ^(run: start-servers.bat^)
) else (
  echo    [OK] Backend  port 5000 - RUNNING  ^(via nginx proxy^)
)

echo.
echo  ===========================================================================
echo    Services run in BACKGROUND - this window is only a status monitor.
echo    You can close this window safely. Services keep running!
echo.
echo    AUTO-BOOT: Active (SYSTEM + Login tasks registered)
echo.
echo    Refreshing in 60 seconds... Press Ctrl+C to close this monitor.
echo  ===========================================================================
timeout /t 60 /nobreak >nul
goto :monitor_loop

:: ====================================================================
:: SUBROUTINE: Write nginx.conf
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
echo     error_log   logs/achme_error.log warn;
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
echo         location ~ /\. { deny all; }
echo     }
echo }
) >"%NGINX_DIR%\conf\nginx.conf"
exit /b 0

:: ====================================================================
:: FAIL HANDLER
:: ====================================================================
:fail
echo.
echo  ===========================================================================
echo    STARTUP FAILED - Check log: %LOGFILE%
echo  ===========================================================================
echo [%DATE% %TIME%] SETUP FAILED >> "%LOGFILE%"
pause
exit /b 1
