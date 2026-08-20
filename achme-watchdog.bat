@echo off
setlocal enabledelayedexpansion
:: ====================================================================
:: ACHME CRM - Watchdog (Auto-Heal Service Monitor)
:: ====================================================================
:: This script runs every 5 minutes via Windows Task Scheduler.
:: It checks if MySQL, Nginx, and Backend are alive.
:: If any service is down, it restarts it automatically.
:: Exits immediately if everything is healthy (very lightweight).
:: ====================================================================

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
set "NGINX_DIR=C:\nginx"
set "BACKEND_PORT=5000"
set "LOG_DIR=%ROOT%\logs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
set "LOGFILE=%LOG_DIR%\watchdog.log"

:: Prevent log from growing forever (keep last 500 lines)
if exist "%LOGFILE%" (
  for %%A in ("%LOGFILE%") do (
    if %%~zA GTR 102400 (
      powershell -NoProfile -Command "Get-Content '%LOGFILE%' | Select-Object -Last 200 | Set-Content '%LOGFILE%.tmp'; Move-Item -Force '%LOGFILE%.tmp' '%LOGFILE%'" >nul 2>&1
    )
  )
)

set "NEED_FIX=0"

:: ====================================================================
:: CHECK 1: MySQL on port 3306
:: ====================================================================
netstat -ano | findstr ":3306 " | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
  echo [%DATE% %TIME%] WATCHDOG: MySQL DOWN - restarting... >> "%LOGFILE%"
  set "NEED_FIX=1"
  for %%m in (MySQL80 MySQL MySQL57 MySQL84 MySQL90 mysql MariaDB) do (
    net start %%m >nul 2>&1
  )
  :: Wait for MySQL to come up
  ping -n 6 127.0.0.1 >nul
  netstat -ano | findstr ":3306 " | findstr "LISTENING" >nul 2>&1
  if errorlevel 1 (
    echo [%DATE% %TIME%] WATCHDOG: MySQL STILL DOWN after restart attempt >> "%LOGFILE%"
  ) else (
    echo [%DATE% %TIME%] WATCHDOG: MySQL RECOVERED >> "%LOGFILE%"
  )
)

:: ====================================================================
:: CHECK 2: Nginx on port 82
:: ====================================================================
netstat -ano | findstr ":82 " | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
  echo [%DATE% %TIME%] WATCHDOG: Nginx DOWN - restarting... >> "%LOGFILE%"
  set "NEED_FIX=1"
  taskkill /F /IM nginx.exe >nul 2>&1
  ping -n 2 127.0.0.1 >nul
  
  :: Try C:\nginx first, then local nginx folder
  if exist "%NGINX_DIR%\nginx.exe" (
    pushd "%NGINX_DIR%"
    start "" /B nginx.exe -p "%NGINX_DIR%"
    popd
  ) else if exist "%ROOT%\nginx-local\nginx.exe" (
    pushd "%ROOT%\nginx-local"
    start "" /B nginx.exe -p "%ROOT%\nginx-local"
    popd
  )
  
  ping -n 4 127.0.0.1 >nul
  netstat -ano | findstr ":82 " | findstr "LISTENING" >nul 2>&1
  if errorlevel 1 (
    echo [%DATE% %TIME%] WATCHDOG: Nginx STILL DOWN after restart attempt >> "%LOGFILE%"
  ) else (
    echo [%DATE% %TIME%] WATCHDOG: Nginx RECOVERED >> "%LOGFILE%"
  )
)

:: ====================================================================
:: CHECK 3: Backend on port 5000
:: ====================================================================
netstat -ano | findstr ":%BACKEND_PORT% " | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
  echo [%DATE% %TIME%] WATCHDOG: Backend DOWN on port %BACKEND_PORT% - restarting... >> "%LOGFILE%"
  set "NEED_FIX=1"
  
  :: Load saved paths (needed when running as SYSTEM)
  if exist "%ROOT%\.achme-node-dir" (
    for /f "usebackq tokens=*" %%a in ("%ROOT%\.achme-node-dir") do set "PATH=%%a;!PATH!"
  )
  if exist "%ROOT%\.achme-npm-prefix" (
    for /f "usebackq tokens=*" %%a in ("%ROOT%\.achme-npm-prefix") do set "PATH=%%a;!PATH!"
  )
  :: Fallback Node paths
  if exist "C:\Program Files\nodejs\node.exe" set "PATH=C:\Program Files\nodejs;!PATH!"
  
  :: Try PM2 first
  set "PM2_EXEC="
  if exist "%ROOT%\.achme-npm-prefix" (
    set /p SAVED_NPM_PREFIX=<"%ROOT%\.achme-npm-prefix"
    if exist "!SAVED_NPM_PREFIX!\pm2.cmd" set "PM2_EXEC=!SAVED_NPM_PREFIX!\pm2.cmd"
  )
  if not defined PM2_EXEC (
    for /d %%u in ("C:\Users\*") do (
      if exist "%%u\AppData\Roaming\npm\pm2.cmd" (
        if not defined PM2_EXEC set "PM2_EXEC=%%u\AppData\Roaming\npm\pm2.cmd"
      )
    )
  )
  
  :: Set PM2_HOME
  if exist "%ROOT%\.achme-pm2-home" (
    set /p PM2_HOME=<"%ROOT%\.achme-pm2-home"
  )
  if not defined PM2_HOME (
    for /d %%u in ("C:\Users\*") do (
      if exist "%%u\.pm2" (
        if not defined PM2_HOME set "PM2_HOME=%%u\.pm2"
      )
    )
  )
  
  if defined PM2_EXEC (
    :: Try PM2 resurrect first
    call "!PM2_EXEC!" ping >nul 2>&1
    call "!PM2_EXEC!" resurrect >nul 2>&1
    
    :: Check if it came up
    ping -n 5 127.0.0.1 >nul
    netstat -ano | findstr ":%BACKEND_PORT% " | findstr "LISTENING" >nul 2>&1
    if errorlevel 1 (
      :: Resurrect didn't work, start fresh
      call "!PM2_EXEC!" delete achme-backend >nul 2>&1
      pushd "%ROOT%\backend"
      if exist "ecosystem.production.config.js" (
        call "!PM2_EXEC!" start ecosystem.production.config.js >nul 2>&1
      ) else (
        call "!PM2_EXEC!" start server.js --name achme-backend >nul 2>&1
      )
      call "!PM2_EXEC!" save >nul 2>&1
      popd
      echo [%DATE% %TIME%] WATCHDOG: Backend restarted via PM2 >> "%LOGFILE%"
    ) else (
      echo [%DATE% %TIME%] WATCHDOG: Backend RECOVERED via PM2 resurrect >> "%LOGFILE%"
    )
  ) else (
    :: No PM2 found, start with plain node
    where node >nul 2>&1
    if not errorlevel 1 (
      pushd "%ROOT%\backend"
      start "achme-backend" /B node server.js >> "%ROOT%\logs\backend-watchdog.log" 2>&1
      popd
      echo [%DATE% %TIME%] WATCHDOG: Backend started via direct node >> "%LOGFILE%"
    ) else (
      echo [%DATE% %TIME%] WATCHDOG: CRITICAL - Node.js not found! >> "%LOGFILE%"
    )
  )
  
  :: Final verify
  ping -n 8 127.0.0.1 >nul
  netstat -ano | findstr ":%BACKEND_PORT% " | findstr "LISTENING" >nul 2>&1
  if errorlevel 1 (
    echo [%DATE% %TIME%] WATCHDOG: Backend STILL DOWN after restart >> "%LOGFILE%"
  ) else (
    echo [%DATE% %TIME%] WATCHDOG: Backend RECOVERED on port %BACKEND_PORT% >> "%LOGFILE%"
  )
)

:: Only log if we fixed something (keep log clean)
if "%NEED_FIX%"=="0" (
  :: Heartbeat log every ~30 min (every 6th run = 6*5min = 30min)
  set /a RAND=%RANDOM% %% 6
  if !RAND! EQU 0 (
    echo [%DATE% %TIME%] WATCHDOG: All services healthy [OK] >> "%LOGFILE%"
  )
)

exit /b 0
