@echo off
title ACHME - Start Nginx
color 0B

:: ---- Must run as Administrator ----
net session >nul 2>&1
if errorlevel 1 (
    echo Requesting Admin rights...
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs" 2>nul
    if errorlevel 1 (
        :: PowerShell broken - use alternative elevation
        mshta vbscript:CreateObject("Shell.Application").ShellExecute("""%~f0""","","","runas",1)(window.close)
    )
    exit /b 0
)

set "NGINX_DIR=C:\nginx"

echo.
echo  ============================================================
echo    ACHME CRM - Nginx Fix ^& Start
echo  ============================================================
echo.

:: Step 1: Kill any stale nginx
echo  [1] Stopping any old Nginx instances...
taskkill /F /IM nginx.exe >nul 2>&1
ping -n 3 127.0.0.1 >nul

:: Step 2: Verify nginx exists
if not exist "%NGINX_DIR%\nginx.exe" (
    echo  [FAIL] nginx.exe not found at C:\nginx
    echo         Please run start-servers.bat first to install Nginx.
    pause
    exit /b 1
)

:: Step 3: Test config first
echo  [2] Testing nginx configuration...
"%NGINX_DIR%\nginx.exe" -t -p "%NGINX_DIR%" >nul 2>&1
if errorlevel 1 (
    echo  [FAIL] nginx.conf has errors!
    "%NGINX_DIR%\nginx.exe" -t -p "%NGINX_DIR%"
    pause
    exit /b 1
)
echo       Config OK.

:: Step 4: Start nginx (use start /B so it runs in background)
echo  [3] Starting Nginx on port 82...
start "nginx" /B "%NGINX_DIR%\nginx.exe" -p "%NGINX_DIR%"

:: Step 5: Wait and confirm
ping -n 4 127.0.0.1 >nul
netstat -ano | findstr ":82 " | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo  [FAIL] Nginx did not bind to port 82!
    echo         Check: C:\nginx\logs\error.log
    type "%NGINX_DIR%\logs\error.log" 2>nul
    pause
    exit /b 1
)
echo       Nginx is LISTENING on port 82. [OK]

:: Step 6: Health check
curl.exe -s --max-time 5 http://localhost:82/nginx-health >nul 2>&1
if errorlevel 1 (
    echo  [WARN] Nginx running but health check failed. Check config.
) else (
    echo       Health check PASSED. [OK]
)

:: Step 7: Register auto-start task so nginx restarts on boot
echo  [4] Registering Nginx auto-start task...
schtasks /delete /tn "ACHME_Nginx_AutoStart" /f >nul 2>&1
schtasks /create /tn "ACHME_Nginx_AutoStart" /tr "\"%NGINX_DIR%\nginx.exe\" -p \"%NGINX_DIR%\"" /sc onstart /delay 0000:20 /ru SYSTEM /f >nul 2>&1
if not errorlevel 1 (
    echo       Auto-start task registered (runs at boot^). [OK]
) else (
    echo       [WARN] Could not register auto-start task - run as Admin.
)

echo.
echo  ============================================================
echo    NGINX IS RUNNING!
echo.
echo    Access your CRM at:
echo      http://localhost:82
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /R /C:"IPv4 Address" ^| findstr /V "127" ^| findstr /V "169.254"') do (
    set "LAN=%%i"
    set "LAN=!LAN: =!"
    echo      http://!LAN!:82   ^(LAN access^)
    goto :show_done
)
:show_done
echo  ============================================================
echo.
echo  Press any key to close this window (Nginx keeps running!)
pause >nul
exit /b 0
