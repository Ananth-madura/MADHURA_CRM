@echo off
:: Run as Administrator to fix the hosts file and nginx immediately
net session >nul 2>&1
if errorlevel 1 (
  echo Requesting Administrator privileges - UAC prompt...
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
)

set "LAN_IP=127.0.0.1"
for /f "usebackq tokens=*" %%p in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$gw = (Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Select-Object -First 1).NextHop; if ($gw) { $ip = (Find-NetRoute -RemoteIPAddress $gw -ErrorAction SilentlyContinue).LocalIPAddress; if ($ip) { echo $ip; exit } }; (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Ethernet*', 'Wi-Fi*', 'Local Area*' -Type Unicast -ErrorAction SilentlyContinue).IPAddress"`) do (
  set "LAN_IP=%%p"
)
if "%LAN_IP%"=="" set "LAN_IP=192.168.1.110"
set "NGINX_DIR=C:\nginx"

echo Fixing hosts file...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0fix-hosts-now.ps1"

echo.
echo Writing nginx.conf with IP %LAN_IP%...
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
echo     client_max_body_size 100M;
echo     access_log  logs/achme_access.log;
echo     error_log   logs/achme_error.log;
echo.
echo     upstream achme_backend {
echo         server 127.0.0.1:5000;
echo         keepalive 32;
echo     }
echo.
echo     server {
echo         listen 0.0.0.0:82;
echo         server_name achme.com www.achme.com IBM-SERVER IBM-SERVER.achme.com %LAN_IP% 127.0.0.1 localhost _;
echo.
echo         root %NGINX_DIR%/html/achme;
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
echo         location ^^~ /api/ {
echo             proxy_pass http://achme_backend/api/;
echo             proxy_http_version 1.1;
echo             proxy_set_header Host              $host;
echo             proxy_set_header X-Real-IP         $remote_addr;
echo             proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
echo             proxy_set_header X-Forwarded-Proto $scheme;
echo             proxy_connect_timeout  300s;
echo             proxy_send_timeout     300s;
echo             proxy_read_timeout     300s;
echo             client_max_body_size   100M;
echo         }
echo.
echo         location ^^~ /uploads/ {
echo             proxy_pass http://achme_backend/uploads/;
echo             proxy_http_version 1.1;
echo             proxy_set_header Host              $host;
echo             proxy_set_header X-Real-IP         $remote_addr;
echo             proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
echo             proxy_connect_timeout  300s;
echo             proxy_send_timeout     300s;
echo             proxy_read_timeout     300s;
echo             client_max_body_size   100M;
echo         }
echo.
echo         location ^^~ /socket.io/ {
echo             proxy_pass http://achme_backend/socket.io/;
echo             proxy_http_version 1.1;
echo             proxy_set_header Upgrade    $http_upgrade;
echo             proxy_set_header Connection "upgrade";
echo             proxy_set_header Host              $host;
echo             proxy_set_header X-Real-IP         $remote_addr;
echo             proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
echo             proxy_connect_timeout  120s;
echo             proxy_send_timeout     3600s;
echo             proxy_read_timeout     3600s;
echo             proxy_buffering        off;
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
) > "%NGINX_DIR%\conf\nginx.conf"
echo nginx.conf written.

echo.
echo Reloading Nginx...
powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-NetTCPConnection -State Listen -LocalPort 82 -ErrorAction SilentlyContinue) { Start-Process 'C:\nginx\nginx.exe' -ArgumentList '-s','reload' -WorkingDirectory 'C:\nginx' -WindowStyle Hidden; Write-Host 'Nginx reloaded' -ForegroundColor Green } else { Start-Process 'C:\nginx\nginx.exe' -WorkingDirectory 'C:\nginx' -WindowStyle Hidden; Start-Sleep 3; Write-Host 'Nginx started' -ForegroundColor Green }"

echo.
echo Testing all URLs...
timeout /t 2 /nobreak >nul

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri 'http://localhost:82/nginx-health' -UseBasicParsing -TimeoutSec 4 | Out-Null; Write-Host '  [OK]  localhost:82' -ForegroundColor Green } catch { Write-Host '  [FAIL] localhost:82' -ForegroundColor Red }"
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri 'http://%LAN_IP%:82/nginx-health' -UseBasicParsing -TimeoutSec 4 | Out-Null; Write-Host '  [OK]  %LAN_IP%:82' -ForegroundColor Green } catch { Write-Host '  [FAIL] %LAN_IP%:82' -ForegroundColor Red }"
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri 'http://IBM-SERVER:82/nginx-health' -UseBasicParsing -TimeoutSec 4 | Out-Null; Write-Host '  [OK]  IBM-SERVER:82' -ForegroundColor Green } catch { Write-Host '  [FAIL] IBM-SERVER:82' -ForegroundColor Red }"
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri 'http://achme.com:82/nginx-health' -UseBasicParsing -TimeoutSec 4 | Out-Null; Write-Host '  [OK]  achme.com:82' -ForegroundColor Green } catch { Write-Host '  [FAIL] achme.com:82' -ForegroundColor Red }"

echo.
echo Done! Press any key to close.
pause >nul
