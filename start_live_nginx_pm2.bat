@echo off
setlocal enabledelayedexpansion
title ACHME CRM — Live Production (Nginx + PM2 + MySQL)
color 0A

:: ================================================================
:: ACHME CRM — ONE-CLICK LIVE LAUNCHER
:: Nginx :82 + PM2 (Node :5000) + MySQL + React Build
::
:: DROP THIS FILE IN YOUR PROJECT ROOT (where backend\ and frontend\ are)
:: Right-click → Run as Administrator  OR  just double-click
:: The script auto-elevates if needed.
::
:: What this does (in order):
::   1.  Auto-detect LAN IP
::   2.  Elevate to Administrator
::   3.  Check / install Node.js (via winget)
::   4.  Check MySQL service (start or guide install)
::   5.  Install PM2 globally
::   6.  Download / verify Nginx for Windows
::   7.  Write backend/.env (PORT=5000, correct CORS)
::   8.  Write frontend/.env.production
::   9.  npm install backend
::  10.  Install Puppeteer Chrome (PDF support)
::  11.  Ensure MySQL DB user: achme_user
::  12.  Initialize DB tables + seed default users
::  13.  npm install + build frontend (React)
::  14.  Copy build → C:\nginx\html\achme\
::  15.  Write C:\nginx\conf\nginx.conf
::  16.  Stop old PM2 / Node / Nginx if running
::  17.  Start backend with PM2
::  18.  Start Nginx on port 82
::  19.  Open Windows Firewall ports 80 and 82
::  20.  Update hosts file: achme.com → LAN IP
::  21.  Print access URLs + health check
:: ================================================================

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
set "BACKEND_PORT=5000"
set "NGINX_PORT=82"
set "DB_NAME=achme"
set "DB_USER=achme_user"
set "DB_PASS=AchmeSecure@2024"
set "DB_ROOT_PASS=admin@123"

echo.
echo  ================================================================
echo   ACHME CRM — LIVE PRODUCTION LAUNCHER
echo   Nginx + PM2 + React Build + MySQL
echo  ================================================================
echo.

:: ================================================================
:: STEP 1: Check for Administrator privileges
:: ================================================================
:check_admin
net session >nul 2>&1
if not errorlevel 1 (
    echo  [OK] Running as Administrator.
    set "NGINX_DIR=C:\nginx"
    goto setup_nginx_html
)
echo  [WARN] Running as Standard User (No Administrator privileges).
echo         Dynamic fallback to local project folder for Nginx setup:
echo         %ROOT%\nginx
echo.
echo         Firewall adjustments and local hosts file updates will be skipped.
echo         Please make sure MySQL is already installed and running.
echo  ----------------------------------------------------------------
set "NGINX_DIR=%ROOT%\nginx"

:setup_nginx_html
set "NGINX_HTML=%NGINX_DIR%\html\achme"
goto detect_ip

:: ================================================================
:: STEP 2: Detect LAN IP
:: ================================================================
:detect_ip
echo.
echo  [1/12] Detecting LAN IP address...
set "LAN_IP="
for /f "usebackq tokens=*" %%I in (
  `powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ip = (Find-NetRoute -RemoteIPAddress '8.8.8.8' -ErrorAction SilentlyContinue | Select-Object -First 1).LocalIPAddress; if (-not $ip) { $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.InterfaceAlias -notmatch 'vEthernet|Loopback|Bluetooth' } | Sort-Object -Property InterfaceIndex | Select-Object -First 1).IPAddress }; $ip"` ^
) do set "LAN_IP=%%I"

if "!LAN_IP!"=="" set "LAN_IP=127.0.0.1"
echo  [OK] LAN IP detected: !LAN_IP!
echo       Employees will access: http://!LAN_IP!:%NGINX_PORT%

:: Query and display network IP static vs dynamic status
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$adapter = Get-NetIPInterface -AddressFamily IPv4 | Where-Object { $_.ConnectionState -eq 'Connected' -and $_.InterfaceAlias -notmatch 'Loopback|vEthernet|Virtual|Bluetooth' } | Select-Object -First 1;" ^
  "if ($adapter.Dhcp -eq 'Disabled') {" ^
  "  Write-Host '      IP Status: STATIC (IP Frozen - Safe for Employees)' -ForegroundColor Green" ^
  "} else {" ^
  "  Write-Host '      IP Status: DYNAMIC (DHCP - Might change! Run manage-local-ip.bat to freeze it)' -ForegroundColor Yellow" ^
  "}"

:: ================================================================
:: STEP 3: Check / Install Node.js
:: ================================================================
echo.
echo  [2/12] Checking Node.js...
where node >nul 2>&1
if not errorlevel 1 (
    for /f "tokens=*" %%V in ('node --version') do echo  [OK] Node.js %%V found.
    goto check_npm
)
echo  [!] Node.js not found. Installing via winget...
where winget >nul 2>&1
if errorlevel 1 (
    echo  [FAIL] winget not available.
    echo         Download Node.js 20 LTS from https://nodejs.org and run this file again.
    pause & exit /b 1
)
winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
    echo  [FAIL] Node.js install failed. Install manually from https://nodejs.org
    pause & exit /b 1
)
:: Refresh PATH after install
for /f "tokens=*" %%P in (
  'powershell -NoProfile -Command "[System.Environment]::GetEnvironmentVariable(\"PATH\",\"Machine\")"'
) do set "PATH=%%P;%PATH%"
where node >nul 2>&1
if errorlevel 1 (
    echo  [WARN] Node.js installed but not in PATH yet.
    echo         Please close this window and run again after restarting your terminal.
    pause & exit /b 1
)
echo  [OK] Node.js installed successfully.

:check_npm
where npm >nul 2>&1
if errorlevel 1 (
    echo  [FAIL] npm not found. Reinstall Node.js from https://nodejs.org
    pause & exit /b 1
)
for /f "tokens=*" %%V in ('npm --version') do echo  [OK] npm %%V found.

:: ================================================================
:: STEP 4: Check / Start MySQL
:: ================================================================
echo.
echo  [3/12] Checking MySQL...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "if (Get-NetTCPConnection -LocalPort 3306 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if not errorlevel 1 (
    echo  [OK] MySQL is listening on port 3306.
    goto check_pm2
)
echo  [!] MySQL not listening on 3306. Trying to start MySQL service...
for %%S in (MySQL80 MySQL MySQL57 mysql) do (
    net start %%S >nul 2>&1
    if not errorlevel 1 (
        echo  [OK] MySQL service '%%S' started.
        goto check_pm2
    )
)
echo  [!] Could not start MySQL automatically.
net session >nul 2>&1
if errorlevel 1 (
    echo       Since you are running as a Standard User, please make sure your MySQL service
    echo       is running manually (e.g. via Windows Services console: services.msc) or run this file as Admin.
    echo.
)
echo.
where winget >nul 2>&1
if errorlevel 1 goto mysql_manual_install
echo      Trying to install MySQL Server using winget...
winget install -e --id Oracle.MySQL --accept-package-agreements --accept-source-agreements
echo      Checking MySQL service again after installer...
for %%S in (MySQL80 MySQL MySQL57 mysql) do (
    net start %%S >nul 2>&1
    if not errorlevel 1 (
        echo  [OK] MySQL service '%%S' started.
        goto check_pm2
    )
)

:mysql_manual_install
echo      MySQL must be installed and running before ACHME CRM can start.
echo      Install MySQL 8 from https://dev.mysql.com/downloads/mysql/
echo      Root password to use: %DB_ROOT_PASS%
echo.
echo      After MySQL is running, run this file again.
pause & exit /b 1

:: ================================================================
:: STEP 5: Install PM2 globally
:: ================================================================
:check_pm2
echo.
echo  [4/12] Checking PM2...
where pm2 >nul 2>&1
if not errorlevel 1 (
    for /f "tokens=*" %%V in ('pm2 --version') do echo  [OK] PM2 %%V found.
    goto check_nginx
)
echo  [!] PM2 not found. Installing globally...
npm install -g pm2
if errorlevel 1 (
    echo  [FAIL] PM2 install failed. Run: npm install -g pm2
    pause & exit /b 1
)
echo  [OK] PM2 installed.

:: ================================================================
:: STEP 6: Download / verify Nginx for Windows
:: ================================================================
:check_nginx
echo.
echo  [5/12] Checking Nginx...
if exist "%NGINX_DIR%\nginx.exe" (
    echo  [OK] Nginx found at %NGINX_DIR%\nginx.exe
    goto write_env
)
echo  [!] Nginx not found at %NGINX_DIR%. Downloading...
set "NGINX_ZIP=%TEMP%\nginx-win.zip"
set "NGINX_VERSION=1.27.4"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { Invoke-WebRequest -Uri 'https://nginx.org/download/nginx-%NGINX_VERSION%.zip' -OutFile '%NGINX_ZIP%' -UseBasicParsing; Write-Host 'Download OK' } catch { Write-Host 'Download FAILED: ' $_.Exception.Message; exit 1 }"
if errorlevel 1 (
    echo  [FAIL] Could not download Nginx automatically.
    echo         Please download nginx-windows from https://nginx.org/en/download.html
    echo         Extract and place nginx.exe in %NGINX_DIR%\nginx.exe
    echo         Then run this file again.
    pause & exit /b 1
)

echo  [!] Extracting Nginx to %NGINX_DIR%...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "if (Test-Path '%NGINX_DIR%') { Remove-Item '%NGINX_DIR%' -Recurse -Force }; New-Item -ItemType Directory -Path (Split-Path '%NGINX_DIR%') -Force | Out-Null; Expand-Archive -Path '%NGINX_ZIP%' -DestinationPath '%TEMP%\nginx_extract' -Force; Move-Item -Path '%TEMP%\nginx_extract\nginx-%NGINX_VERSION%' -Destination '%NGINX_DIR%' -Force; Remove-Item '%TEMP%\nginx_extract' -Recurse -Force"

if not exist "%NGINX_DIR%\nginx.exe" (
    echo  [FAIL] Nginx extraction failed. Please extract manually to %NGINX_DIR%
    pause & exit /b 1
)
echo  [OK] Nginx installed at %NGINX_DIR%

:: ================================================================
:: STEP 7: Write backend/.env
:: ================================================================
:write_env
echo.
echo  [6/12] Writing backend production .env...
if not exist "%ROOT%\backend" (
    echo  [FAIL] backend\ folder not found in %ROOT%
    echo         Make sure you placed this .bat file in your project root folder.
    pause & exit /b 1
)
(
echo # ================================================================
echo # ACHME CRM Backend — Production .env
echo # Auto-generated by start_live_nginx_pm2.bat
echo # ================================================================
echo PORT=%BACKEND_PORT%
echo NODE_ENV=production
echo ALLOWED_ORIGIN=http://localhost:%NGINX_PORT%,http://!LAN_IP!:%NGINX_PORT%,http://achme.com,http://www.achme.com
echo DEFAULT_TEST_PASSWORD=Test@12345
echo DB_HOST=127.0.0.1
echo DB_PORT=3306
echo DB_USER=%DB_USER%
echo DB_PASS=%DB_PASS%
echo DB_NAME=%DB_NAME%
echo SMTP_HOST=smtp.gmail.com
echo SMTP_PORT=587
echo EMAIL_USER=thanan757@gmail.com
echo EMAIL_PASS=ghjv omqm hwji kerq
echo JWT_SECRET=97418d0c15d57ade768586b8501e35d34e5a5277f2a0570b6d5b47ef93f5b33e88b80045c60efd77e6edcbb015dbe46cf6747ce1dd8f11361f3e426ddc677c9a
) > "%ROOT%\backend\.env"
echo  [OK] backend\.env written.

:: Write frontend .env.production (blank API URL = auto-detect from window.location)
echo  [OK] Writing frontend .env.production...
(
echo # ACHME CRM Frontend — Production
echo # REACT_APP_API_URL left blank so config.js auto-detects from window.location
echo # This means the build works for ANY IP without rebuilding
echo REACT_APP_API_URL=
echo REACT_APP_API_PROXY=
) > "%ROOT%\frontend\.env.production"
echo  [OK] frontend\.env.production written.

:: ================================================================
:: STEP 8: Install backend dependencies
:: ================================================================
echo.
echo  [7/12] Installing backend dependencies...
cd /d "%ROOT%\backend"
call npm install
if errorlevel 1 (
    echo  [FAIL] npm install failed in backend\
    pause & exit /b 1
)
echo  [OK] Backend dependencies installed.

echo  [!] Installing Puppeteer Chrome browser (for PDF generation)...
call npx puppeteer browsers install chrome
if errorlevel 1 (
    echo  [WARN] Puppeteer Chrome install failed. PDF features may not work.
    echo         Run manually: cd backend ^&^& npx puppeteer browsers install chrome
) else (
    echo  [OK] Puppeteer Chrome installed.
)

:: ================================================================
:: STEP 9: Setup MySQL DB user and initialize tables
:: ================================================================
echo.
echo  [8/12] Setting up MySQL database user...
cd /d "%ROOT%\backend"
set "MYSQL_ROOT_PASSWORD=%DB_ROOT_PASS%"
call node ensure_db_user.js
if errorlevel 1 (
    echo.
    echo  [FAIL] Could not create MySQL user '%DB_USER%' automatically.
    echo.
    echo         Please run these SQL commands manually:
    echo           mysql -u root -p
    echo           CREATE DATABASE IF NOT EXISTS `%DB_NAME%` DEFAULT CHARACTER SET utf8mb4;
    echo           CREATE USER IF NOT EXISTS '%DB_USER%'@'localhost' IDENTIFIED BY '%DB_PASS%';
    echo           GRANT ALL PRIVILEGES ON `%DB_NAME%`.* TO '%DB_USER%'@'localhost';
    echo           FLUSH PRIVILEGES;
    echo           EXIT;
    echo.
    echo         Then run this file again.
    pause & exit /b 1
)
echo  [OK] Database user ready.

echo  [!] Initializing database tables and seeding default users...
call node db_init.js
if errorlevel 1 (
    echo  [FAIL] Database initialization failed.
    echo         Check that MySQL is running and '%DB_USER%' has access to '%DB_NAME%'.
    echo         View error above for details.
    pause & exit /b 1
)
echo  [OK] Database tables initialized. Default users seeded.

:: ================================================================
:: STEP 10: Build React frontend
:: ================================================================
echo.
echo  [9/12] Building React frontend (this takes 2-5 minutes)...
cd /d "%ROOT%\frontend"
if not exist "package.json" (
    echo  [FAIL] frontend\package.json not found. Wrong project root?
    pause & exit /b 1
)
call npm install
if errorlevel 1 (
    echo  [FAIL] npm install failed in frontend\
    pause & exit /b 1
)
call npm run build
if errorlevel 1 (
    echo  [FAIL] React build failed. Check errors above.
    pause & exit /b 1
)
if not exist "%ROOT%\frontend\build\index.html" (
    echo  [FAIL] Build succeeded but index.html not found.
    pause & exit /b 1
)
echo  [OK] React frontend built successfully.

:: Copy build to Nginx html directory
echo  [!] Copying build to %NGINX_HTML%...
if not exist "%NGINX_HTML%" mkdir "%NGINX_HTML%"
xcopy /E /I /Y "%ROOT%\frontend\build\*" "%NGINX_HTML%\" >nul
if errorlevel 1 (
    echo  [FAIL] Could not copy build files to %NGINX_HTML%
    pause & exit /b 1
)
echo  [OK] Frontend build deployed to Nginx at %NGINX_HTML%

:: ================================================================
:: STEP 11: Write Nginx config
:: ================================================================
echo.
echo  [10/12] Writing Nginx configuration...
if not exist "%NGINX_DIR%\conf" mkdir "%NGINX_DIR%\conf"
set "NGINX_CONF=%NGINX_DIR%\conf\nginx.conf"

:: Convert backslashes to forward slashes for Nginx (Nginx needs forward slashes)
set "NGINX_HTML_FWD=%NGINX_HTML:\=/%"

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
echo.
echo     sendfile        on;
echo     keepalive_timeout 65;
echo.
echo     access_log  logs/achme_access.log;
echo     error_log   logs/achme_error.log;
echo.
echo     upstream achme_backend {
echo         server 127.0.0.1:%BACKEND_PORT%;
echo         keepalive 32;
echo     }
echo.
echo     server {
echo         listen %NGINX_PORT%;
echo         server_name achme.com www.achme.com !LAN_IP! localhost _;
echo.
echo         root %NGINX_HTML_FWD%;
echo         index index.html;
echo.
echo         # React Router SPA fallback
echo         location / {
echo             try_files $uri $uri/ /index.html;
echo         }
echo.
echo         # API Proxy to Node.js backend
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
echo         location /uploads/ {
echo             proxy_pass http://achme_backend/uploads/;
echo             proxy_http_version 1.1;
echo             proxy_set_header Host              $host;
echo             proxy_set_header X-Real-IP         $remote_addr;
echo             proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
echo             proxy_read_timeout     120s;
echo         }
echo.
echo         # Socket.IO WebSocket proxy (chat + notifications)
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
echo         # Health check endpoint
echo         location /nginx-health {
echo             return 200 "Nginx OK - ACHME CRM\n";
echo             add_header Content-Type text/plain;
echo         }
echo.
echo         # Static asset caching
echo         location ~* \.(js^|css^|png^|jpg^|jpeg^|gif^|ico^|svg^|woff^|woff2^|ttf^|eot)$ {
echo             expires 1y;
echo             add_header Cache-Control "public, immutable";
echo             access_log off;
echo         }
echo.
echo         # Block hidden files (.env, .git, etc.)
echo         location ~ /\. {
echo             deny all;
echo         }
echo     }
echo.
echo }
) > "%NGINX_CONF%"
echo  [OK] Nginx config written to %NGINX_CONF%

:: Validate nginx config
echo  [!] Validating Nginx configuration...
cd /d "%NGINX_DIR%"
nginx.exe -t >nul 2>&1
if errorlevel 1 (
    echo  [FAIL] Nginx config validation failed. Check %NGINX_CONF%
    echo         Run: cd %NGINX_DIR% ^&^& nginx.exe -t
    pause & exit /b 1
)
echo  [OK] Nginx configuration is valid.

:: ================================================================
:: STEP 12: Stop old PM2 / Nginx / processes on target ports
:: ================================================================
echo.
echo  [11/12] Stopping any old processes...

:: Stop existing PM2 achme-backend if running
pm2 stop achme-backend >nul 2>&1
pm2 delete achme-backend >nul 2>&1
echo  [OK] Old PM2 instance cleared (if any).

:: Do not kill every nginx.exe on the machine; other projects may use it.
:: Clear only ACHME's live port below.
echo  [OK] Existing non-ACHME Nginx instances left untouched.

:: Free port 5000 if something else is using it
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":%BACKEND_PORT% .*LISTENING" 2^>nul') do (
    taskkill /f /pid %%P >nul 2>&1
)
:: Free port 82 if something is using it
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":%NGINX_PORT% .*LISTENING" 2^>nul') do (
    taskkill /f /pid %%P >nul 2>&1
)
echo  [OK] Ports cleared.

:: ================================================================
:: Write PM2 ecosystem config
:: ================================================================
echo.
echo  [!] Writing PM2 ecosystem config...
if not exist "%ROOT%\logs" mkdir "%ROOT%\logs"
(
echo module.exports = {
echo   apps: [{
echo     name: 'achme-backend',
echo     script: './server.js',
echo     cwd: '%ROOT:\=\\%\\backend',
echo     instances: 1,
echo     exec_mode: 'fork',
echo     autorestart: true,
echo     max_restarts: 10,
echo     min_uptime: '5s',
echo     restart_delay: 3000,
echo     watch: false,
echo     max_memory_restart: '1G',
echo     env: { NODE_ENV: 'production', PORT: %BACKEND_PORT% },
echo     error_file: '%ROOT:\=\\%\\logs\\pm2-error.log',
echo     out_file:   '%ROOT:\=\\%\\logs\\pm2-out.log',
echo     log_date_format: 'YYYY-MM-DD HH:mm:ss',
echo     merge_logs: true,
echo     time: true
echo   }]
echo };
) > "%ROOT%\backend\ecosystem.production.config.js"
echo  [OK] PM2 ecosystem config written.

:: ================================================================
:: STEP 12a: Start backend with PM2
:: ================================================================
echo  [!] Starting backend with PM2...
cd /d "%ROOT%\backend"
pm2 start ecosystem.production.config.js
if errorlevel 1 (
    echo  [FAIL] PM2 failed to start. Check logs: pm2 logs achme-backend
    pause & exit /b 1
)
echo  [OK] Backend started with PM2 on port %BACKEND_PORT%.
pm2 save >nul 2>&1
if errorlevel 1 (
    echo  [WARN] PM2 process list was not saved. You can run: pm2 save
) else (
    echo  [OK] PM2 process list saved.
)

:: Wait for Node to be ready (up to 15s)
echo  [!] Waiting for backend to be ready...
set /a WAIT_TRIES=0
:wait_backend
timeout /t 2 /nobreak >nul
set /a WAIT_TRIES+=1
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:%BACKEND_PORT%/api/health' -UseBasicParsing -TimeoutSec 3; exit 0 } catch { exit 1 }"
if not errorlevel 1 goto backend_ready
if %WAIT_TRIES% lss 8 goto wait_backend
echo  [FAIL] Backend health check timed out. Check: pm2 logs achme-backend
pause & exit /b 1

:backend_ready
echo  [OK] Backend is responding on http://localhost:%BACKEND_PORT%/api/health

:: ================================================================
:: STEP 13: Start Nginx
:: ================================================================
:start_nginx
echo.
echo  [!] Starting Nginx on port %NGINX_PORT%...
cd /d "%NGINX_DIR%"
start /b nginx.exe -p "%NGINX_DIR%"
:: Give it a moment to start
timeout /t 2 /nobreak >nul
tasklist /fi "imagename eq nginx.exe" 2>nul | findstr /i "nginx.exe" >nul
if errorlevel 1 (
    echo  [FAIL] Nginx did not start. Check %NGINX_DIR%\logs\achme_error.log
    pause & exit /b 1
)
echo  [OK] Nginx started on port %NGINX_PORT%.

:: ================================================================
:: STEP 14: Open Windows Firewall
:: ================================================================
echo.
echo  [12/12] Opening Windows Firewall...
net session >nul 2>&1
if not errorlevel 1 (
    netsh advfirewall firewall delete rule name="ACHME CRM Nginx %NGINX_PORT%" >nul 2>&1
    netsh advfirewall firewall add rule name="ACHME CRM Nginx %NGINX_PORT%" ^
      dir=in action=allow protocol=TCP localport=%NGINX_PORT% >nul 2>&1
    echo  [OK] Firewall port %NGINX_PORT% open.

    echo  [OK] Port 80 redirect is optional and is not required for live access.

    :: Keep backend behind Nginx. Do not add a hard block here because it can
    :: break the development launcher later on the same client machine.
    netsh advfirewall firewall delete rule name="ACHME Backend Block 5000" >nul 2>&1
    echo  [OK] Removed old hard block for backend port %BACKEND_PORT% if it existed.
) else (
    echo  [WARN] Not running as Administrator. Skipping Windows Firewall port mapping.
    echo         If other devices on your LAN cannot connect, please manually allow port %NGINX_PORT%
    echo         in Windows Defender Firewall.
)

:: ================================================================
:: STEP 15: Update hosts file
:: ================================================================
echo.
echo  [!] Mapping achme.com to !LAN_IP! in hosts file...
net session >nul 2>&1
if not errorlevel 1 (
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "$hostsFile = \"$env:SystemRoot\System32\drivers\etc\hosts\"; $line = \"!LAN_IP!    achme.com    www.achme.com\"; try { $content = Get-Content $hostsFile; $filtered = $content | Where-Object { $_ -notmatch '\bachme\.com\b' }; $filtered + $line | Set-Content $hostsFile -Force; Write-Host 'Hosts file updated.' } catch { throw $_ }"
    if not errorlevel 1 (
        echo  [OK] achme.com -> !LAN_IP! mapped in hosts file.
    ) else (
        echo  [WARN] Failed to update hosts file automatically.
    )
) else (
    echo  [WARN] Not running as Administrator. Skipping hosts file domain mapping.
    echo         To access using http://achme.com on this machine, please manually add
    echo         the following line to C:\Windows\System32\drivers\etc\hosts (Run Notepad as Administrator):
    echo         !LAN_IP!    achme.com    www.achme.com
)

echo.
echo  [!] Installing startup restore for this Windows user...
call "%ROOT%\install-startup.bat" --silent
if errorlevel 1 (
    echo  [WARN] Startup restore was not installed automatically.
) else (
    echo  [OK] Startup restore installed.
)

:: ================================================================
:: FINAL HEALTH CHECK
:: ================================================================
echo.
echo  [!] Running final health checks...
timeout /t 1 /nobreak >nul

set "FINAL_CHECK_FAILED=0"

:: Test Nginx
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { $r = Invoke-WebRequest -Uri 'http://localhost:%NGINX_PORT%/nginx-health' -UseBasicParsing -TimeoutSec 5; Write-Host '  [OK] Nginx responding on port %NGINX_PORT%'; exit 0 } catch { Write-Host '  [FAIL] Nginx health check failed on port %NGINX_PORT%'; exit 1 }"
if errorlevel 1 set "FINAL_CHECK_FAILED=1"

:: Test API via Nginx
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { $r = Invoke-WebRequest -Uri 'http://localhost:%NGINX_PORT%/api/health' -UseBasicParsing -TimeoutSec 5; Write-Host '  [OK] API reachable via Nginx (/api/health)'; exit 0 } catch { Write-Host '  [FAIL] API not reachable via Nginx'; exit 1 }"
if errorlevel 1 set "FINAL_CHECK_FAILED=1"

if "%FINAL_CHECK_FAILED%"=="1" (
    echo.
    echo  [FAIL] Live deployment checks did not fully pass.
    echo         PM2 logs:   %ROOT%\logs\pm2-out.log
    echo         PM2 errors: %ROOT%\logs\pm2-error.log
    echo         Nginx log:  %NGINX_DIR%\logs\achme_error.log
    echo.
    call "%ROOT%\show-live-logs.bat"
    pause
    exit /b 1
)

echo.
echo  [OK] Opening persistent log windows...
call "%ROOT%\show-live-logs.bat"

:: ================================================================
:: SUCCESS SCREEN
:: ================================================================
echo.
echo  ================================================================
echo   ACHME CRM IS LIVE!
echo  ================================================================
echo.
echo   *** OPEN IN BROWSER ***
echo.
echo   From THIS machine:
echo     http://localhost:%NGINX_PORT%
echo     http://achme.com              (hosts file mapped)
echo.
echo   From EMPLOYEE devices on same WiFi:
echo     http://!LAN_IP!:%NGINX_PORT%
echo.
echo   IP FREEZER (RECOMMENDED):
echo     If your Wi-Fi reconnects or switches, this IP will change and employees will lose connection!
echo     To freeze this local IP permanently so it never changes, run:
echo       manage-local-ip.bat (as Administrator)
echo.
echo   To make http://achme.com work on employee PCs too:
echo   Add this line to C:\Windows\System32\drivers\etc\hosts
echo   on each employee's PC (run Notepad as Admin):
echo     !LAN_IP!    achme.com    www.achme.com
echo.
echo  ----------------------------------------------------------------
echo   HEALTH CHECKS
echo     Backend:  http://localhost:%BACKEND_PORT%/api/health
echo     Nginx:    http://localhost:%NGINX_PORT%/nginx-health
echo     Full API: http://localhost:%NGINX_PORT%/api/health
echo.
echo  ----------------------------------------------------------------
echo   LOGIN CREDENTIALS
echo     Admin Email:     Kk@achmecommunication.com
echo     Admin Password:  kk@admin@123
echo.
echo  ----------------------------------------------------------------
echo   MANAGEMENT COMMANDS
echo     View backend logs:    pm2 logs achme-backend
echo     Restart backend:      pm2 restart achme-backend
echo     Backend status:       pm2 status
echo     Reload Nginx config:  cd %NGINX_DIR% ^&^& nginx.exe -s reload
echo     Stop Nginx:           cd %NGINX_DIR% ^&^& nginx.exe -s stop
echo     PM2 monitor:          pm2 monit
echo.
echo  ----------------------------------------------------------------
echo   PM2 AUTO-START ON WINDOWS BOOT
echo     Run: pm2 save
echo     Run: pm2 startup
echo     Then follow the instructions printed.
echo.
echo  ================================================================
echo   Keep this window open or close it — both are fine.
echo   Your backend is managed by PM2 in the background.
echo  ================================================================
echo.

pm2 status
echo.
echo  Nginx logs: %NGINX_DIR%\logs\achme_error.log
echo  PM2 logs:   %ROOT%\logs\pm2-out.log
echo.
pause
exit /b 0

:fail
echo.
echo  ================================================================
echo  [FAIL] Something went wrong. Check the error above.
echo         Fix the issue and run this file again.
echo  ================================================================
pause
exit /b 1
