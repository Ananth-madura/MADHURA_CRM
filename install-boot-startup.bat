@echo off
setlocal enabledelayedexpansion
title ACHME CRM - Install Automatic Windows Boot Startup

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
set "BACKEND_PORT=5000"
set "NGINX_DIR=C:\nginx"
set "LOG_DIR=%ROOT%\logs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

:: Support /silent flag for background invocation from start-servers.bat
set "SILENT_MODE=0"
if /I "%~1"=="/silent" set "SILENT_MODE=1"

:: ----------------------------------------------------------------
:: Admin check
:: ----------------------------------------------------------------
net session >nul 2>&1
if not errorlevel 1 goto :is_admin
if "%SILENT_MODE%"=="1" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -ArgumentList '/silent' -Verb RunAs -WindowStyle Hidden"
  exit /b 0
)
echo.
echo ERROR: Administrator privileges are required!
echo Please right-click "install-boot-startup.bat" and select "Run as Administrator".
echo.
pause
exit /b 1

:is_admin

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
if "%SILENT_MODE%"=="0" echo [Step 1/5] Detecting LAN IP...
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

:: ----------------------------------------------------------------
:: STEP 2 — Write nginx.conf (listen on 0.0.0.0:82 = ALL interfaces)
:: ----------------------------------------------------------------
if "%SILENT_MODE%"=="0" echo [Step 2/5] Writing nginx.conf...
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
) else (
  if "%SILENT_MODE%"=="0" echo   [WARN] Nginx not found at %NGINX_DIR%
)
if "%SILENT_MODE%"=="0" echo.

:: ----------------------------------------------------------------
:: STEP 3 — Update SERVER hosts file (use LAN IP for all domains)
:: ----------------------------------------------------------------
if "%SILENT_MODE%"=="0" echo [Step 3/5] Updating SERVER hosts file...
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
  >>"%LOG_DIR%\install-boot-startup.log" 2>&1
ipconfig /flushdns >nul
if "%SILENT_MODE%"=="0" echo   [OK] Server hosts file updated
if "%SILENT_MODE%"=="0" echo.

:: ----------------------------------------------------------------
:: STEP 4 — Register Boot Scheduled Task (SYSTEM account - headless)
:: ----------------------------------------------------------------
if "%SILENT_MODE%"=="0" echo [Step 4/5] Registering Boot Task (headless, SYSTEM account)...
if exist "%ROOT%\achme-startup.bat" (
  schtasks /create /tn "ACHME_CRM_Boot_Startup" /tr "\"%ROOT%\achme-startup.bat\"" /sc onlogon /rl HIGHEST /f >nul 2>&1
  if "%SILENT_MODE%"=="0" (
    if errorlevel 1 (
      echo   [WARN] Failed to register Boot Task. Try running manually as Administrator.
    ) else (
      echo   [OK] Boot Task registered - starts PM2 + Nginx on every OS boot.
    )
  )
) else (
  if "%SILENT_MODE%"=="0" echo   [WARN] achme-startup.bat not found - skipping boot task.
)
if "%SILENT_MODE%"=="0" echo.

:: ----------------------------------------------------------------
:: STEP 5 — Reload Nginx with new config
:: ----------------------------------------------------------------
if "%SILENT_MODE%"=="0" echo [Step 5/5] Reloading Nginx...
if exist "%NGINX_DIR%\nginx.exe" (
  taskkill /F /IM nginx.exe >nul 2>&1
  timeout /t 2 /nobreak >nul
  cd /d "%NGINX_DIR%"
  start "" /B nginx.exe
  cd /d "%ROOT%"
  timeout /t 2 /nobreak >nul
  if "%SILENT_MODE%"=="0" echo   [OK] Nginx started/reloaded.
)
if "%SILENT_MODE%"=="0" echo.

if "%SILENT_MODE%"=="1" exit /b 0

:: Open the access guide
start "" "%ROOT%\show.bat"

:: ----------------------------------------------------------------
:: Interactive mode — show summary
:: ----------------------------------------------------------------
echo ====================================================================
echo  INSTALLATION COMPLETED SUCCESSFULLY!
echo ====================================================================
echo.
echo  The CRM is now fully automated on this server:
echo.
echo  [BOOT]  PM2 (Node.js backend) + Nginx start automatically on OS boot.
echo.
echo  Access URLs (all working after setup):
echo    http://localhost:82             - From this server machine
echo    http://%LAN_IP%:82          - From any LAN device (direct IP)
echo    http://achme.com               - After employee-hosts-setup.bat on employee PC
echo    http://www.achme.com           - After employee-hosts-setup.bat on employee PC
echo    http://IBM-SERVER:82           - After employee-hosts-setup.bat on employee PC
echo.
echo  Share employee-hosts-setup.bat with each employee PC.
echo.
pause
exit /b 0
