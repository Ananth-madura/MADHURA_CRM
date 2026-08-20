@echo off
setlocal enabledelayedexpansion
title ACHME CRM - Complete Uninstaller ^& Service Stopper
color 0C

:: ====================================================================
:: CONFIGURATION
:: ====================================================================
set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

:: ====================================================================
:: ADMIN AUTO-ELEVATION (required to delete schtasks, firewall, services)
:: ====================================================================
net session >nul 2>&1
if errorlevel 1 (
  echo  [!] Requesting Administrator privileges - UAC prompt...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Start-Process -FilePath '%~f0' -Verb RunAs -ErrorAction Stop } catch { exit 1 }"
  if errorlevel 1 (
    echo.
    echo ====================================================================
    echo ERROR: ACCESS DENIED! Administrator privileges are required.
    echo Please accept the UAC prompt to allow uninstallation of startup tasks.
    echo ====================================================================
    echo.
    pause
    exit /b 1
  )
  exit /b 0
)

cls
echo.
echo  ===========================================================================
echo     ACHME CRM  ^|  COMPLETE UNINSTALLER ^& SERVICE STOPPER
echo  ===========================================================================
echo.
echo     This script will:
echo       1. Stop and delete the PM2 Backend service and daemon
echo       2. Terminate the Nginx reverse proxy
echo       3. Deregister ALL automatic Boot/Logon/Watchdog Scheduled Tasks
echo       4. Remove inbound Firewall security rules
echo       5. Restore Windows power settings (sleep/hibernate)
echo       6. Clean up temporary tracking files
echo.
echo     (Note: MySQL server is left running to protect other databases)
echo  ===========================================================================
echo.
set /p "CONFIRM=  Are you sure you want to stop all services and uninstall? (Y/N): "
if /i not "%CONFIRM%"=="Y" (
  echo  [!] Uninstallation cancelled. Exiting...
  ping -n 4 127.0.0.1 >nul
  exit /b 0
)
echo.

:: ====================================================================
:: STEP 1: Stop and Delete PM2 Backend Service
:: ====================================================================
echo  [1/6] Stopping and deleting PM2 backend...

:: Add Node.js and global npm prefix to path if saved files exist
if exist "%ROOT%\.achme-node-dir" (
  for /f "usebackq tokens=*" %%a in ("%ROOT%\.achme-node-dir") do set "ACHME_NODE_DIR=%%a"
  set "PATH=!ACHME_NODE_DIR!;!PATH!"
)
if exist "%ROOT%\.achme-npm-prefix" (
  for /f "usebackq tokens=*" %%a in ("%ROOT%\.achme-npm-prefix") do set "ACHME_NPM_PREFIX=%%a"
  set "PATH=!ACHME_NPM_PREFIX!;!PATH!"
)
if exist "%ROOT%\.achme-pm2-home" (
  for /f "usebackq tokens=*" %%a in ("%ROOT%\.achme-pm2-home") do set "PM2_HOME=%%a"
)

:: Scan other locations for pm2 if not found
set "PM2_EXEC="
if exist "%ACHME_NPM_PREFIX%\pm2.cmd" set "PM2_EXEC=%ACHME_NPM_PREFIX%\pm2.cmd"
if not defined PM2_EXEC (
  where pm2 >nul 2>&1
  if not errorlevel 1 (
    for /f "tokens=*" %%p in ('where pm2 2^>nul') do if not defined PM2_EXEC set "PM2_EXEC=%%p"
  )
)
if not defined PM2_EXEC (
  for /d %%u in ("C:\Users\*") do (
    if exist "%%u\AppData\Roaming\npm\pm2.cmd" (
      if not defined PM2_EXEC set "PM2_EXEC=%%u\AppData\Roaming\npm\pm2.cmd"
    )
  )
)

if defined PM2_EXEC (
  echo        Found PM2 at: !PM2_EXEC!
  call "!PM2_EXEC!" stop achme-backend >nul 2>&1
  call "!PM2_EXEC!" delete achme-backend >nul 2>&1
  call "!PM2_EXEC!" save --force >nul 2>&1
  call "!PM2_EXEC!" kill >nul 2>&1
  echo        PM2 backend service stopped and daemon terminated. [OK]
) else (
  echo        PM2 executable not found. Backend might not be running via PM2. [SKIP]
)
:: Free port 5000 if backend is running directly (e.g. under SYSTEM)
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":5000 .*LISTENING" 2^>nul') do (
  taskkill /F /PID %%P >nul 2>&1
)
echo.

:: ====================================================================
:: STEP 2: Stop Nginx Reverse Proxy
:: ====================================================================
echo  [2/6] Stopping Nginx reverse proxy...
net stop nginx >nul 2>&1
sc stop nginx >nul 2>&1
taskkill /F /IM nginx.exe >nul 2>&1
if errorlevel 1 (
  echo        Nginx was not running or already stopped. [OK]
) else (
  echo        Nginx processes terminated successfully. [OK]
)
echo.

:: ====================================================================
:: STEP 3: Remove ALL Scheduled Tasks (Boot + Login + Watchdog + Legacy)
:: ====================================================================
echo  [3/6] Deregistering ALL automatic scheduled tasks...

:: Current tasks
schtasks /delete /tn "ACHME_CRM_AutoBoot" /f >nul 2>&1
if not errorlevel 1 (
  echo        [OK] SYSTEM Boot task "ACHME_CRM_AutoBoot" removed.
) else (
  echo        SYSTEM Boot task "ACHME_CRM_AutoBoot" not found. [SKIP]
)

schtasks /delete /tn "ACHME_CRM_Login_Startup" /f >nul 2>&1
if not errorlevel 1 (
  echo        [OK] Login Fallback task "ACHME_CRM_Login_Startup" removed.
) else (
  echo        Login Fallback task "ACHME_CRM_Login_Startup" not found. [SKIP]
)

schtasks /delete /tn "ACHME_CRM_Watchdog" /f >nul 2>&1
if not errorlevel 1 (
  echo        [OK] Watchdog task "ACHME_CRM_Watchdog" removed.
) else (
  echo        Watchdog task "ACHME_CRM_Watchdog" not found. [SKIP]
)

:: Legacy task names cleanup
schtasks /delete /tn "ACHME_CRM_Boot_Startup" /f >nul 2>&1
schtasks /delete /tn "ACHME_CRM_Logon_Dashboard" /f >nul 2>&1
schtasks /delete /tn "ACHME_CRM_Boot_Startup_Local" /f >nul 2>&1

:: Clean user session legacy shortcuts
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
if exist "%STARTUP_DIR%\ACHME CRM Startup.cmd" del "%STARTUP_DIR%\ACHME CRM Startup.cmd" >nul 2>&1
if exist "%STARTUP_DIR%\achme-startup.lnk" del "%STARTUP_DIR%\achme-startup.lnk" >nul 2>&1

echo        All automatic startup tasks removed. [OK]
echo.

:: ====================================================================
:: STEP 4: Remove Firewall Rules
:: ====================================================================
echo  [4/6] Removing Windows Firewall rules...
netsh advfirewall firewall delete rule name="ACHME CRM Port 82" >nul 2>&1
netsh advfirewall firewall delete rule name="ACHME CRM Port 5000" >nul 2>&1
netsh advfirewall firewall delete rule name="ACHME CRM Nginx App" >nul 2>&1
netsh advfirewall firewall delete rule name="ACHME CRM Nginx App Local" >nul 2>&1
netsh advfirewall firewall delete rule name="ACHME CRM Nginx App Bundled" >nul 2>&1
echo        All firewall rules deleted. [OK]
echo.

:: ====================================================================
:: STEP 5: Restore Windows Power Settings
:: ====================================================================
echo  [5/6] Restoring Windows power settings...

:: Re-enable Fast Startup
reg add "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Power" /v HiberbootEnabled /t REG_DWORD /d 1 /f >nul 2>&1
echo        Fast Startup re-enabled. [OK]

:: Re-enable hibernate
powercfg /hibernate on >nul 2>&1
echo        Hibernate re-enabled. [OK]

:: Restore balanced power plan
powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e >nul 2>&1
echo        Balanced power plan restored. [OK]

:: Restore default sleep timeouts (30 min AC, 15 min DC)
powercfg /change standby-timeout-ac 30 >nul 2>&1
powercfg /change standby-timeout-dc 15 >nul 2>&1
powercfg /change monitor-timeout-ac 15 >nul 2>&1
powercfg /change monitor-timeout-dc 10 >nul 2>&1
powercfg /change hibernate-timeout-ac 180 >nul 2>&1
powercfg /change hibernate-timeout-dc 60 >nul 2>&1
echo        Default sleep/hibernate timeouts restored. [OK]
echo.

:: ====================================================================
:: STEP 6: Clean Up Tracking and Configuration Files
:: ====================================================================
echo  [6/6] Cleaning up temporary tracking files...
for %%f in (.achme-node-dir .achme-npm-prefix .achme-pm2-home .last-build-ip .last-build-stamp) do (
  if exist "%ROOT%\%%f" (
    del "%ROOT%\%%f" >nul 2>&1
    echo        File %%f removed.
  )
)
:: Clean up log files
if exist "%ROOT%\logs\startup-restore.log" del "%ROOT%\logs\startup-restore.log" >nul 2>&1
if exist "%ROOT%\logs\watchdog.log" del "%ROOT%\logs\watchdog.log" >nul 2>&1
if exist "%ROOT%\logs\install-boot-startup.log" del "%ROOT%\logs\install-boot-startup.log" >nul 2>&1
if exist "%ROOT%\logs\backend-boot.log" del "%ROOT%\logs\backend-boot.log" >nul 2>&1
if exist "%ROOT%\logs\backend-watchdog.log" del "%ROOT%\logs\backend-watchdog.log" >nul 2>&1
if exist "%ROOT%\logs\boot-registration.log" del "%ROOT%\logs\boot-registration.log" >nul 2>&1
if exist "%ROOT%\logs\task-final-proof.txt" del "%ROOT%\logs\task-final-proof.txt" >nul 2>&1
echo        Tracking and log file cleanup complete. [OK]
echo.

:: ====================================================================
:: Verify all tasks are gone
:: ====================================================================
echo  ---------------------------------------------------------------------------
echo    VERIFICATION:
echo  ---------------------------------------------------------------------------
set "TASKS_REMAIN=0"
schtasks /query /tn "ACHME_CRM_AutoBoot" >nul 2>&1
if not errorlevel 1 (
  echo    [!!] ACHME_CRM_AutoBoot still exists!
  set "TASKS_REMAIN=1"
)
schtasks /query /tn "ACHME_CRM_Login_Startup" >nul 2>&1
if not errorlevel 1 (
  echo    [!!] ACHME_CRM_Login_Startup still exists!
  set "TASKS_REMAIN=1"
)
schtasks /query /tn "ACHME_CRM_Watchdog" >nul 2>&1
if not errorlevel 1 (
  echo    [!!] ACHME_CRM_Watchdog still exists!
  set "TASKS_REMAIN=1"
)
if "%TASKS_REMAIN%"=="0" (
  echo    [OK] All scheduled tasks confirmed removed.
)
echo.

echo  ===========================================================================
echo     UNINSTALLATION ^& SERVICE CLEANUP COMPLETED!
echo  ===========================================================================
echo     All ACHME CRM background services have been completely
echo     STOPPED, REMOVED, and CLEANED UP:
echo.
echo       [OK] PM2 backend stopped and daemon killed
echo       [OK] Nginx reverse proxy terminated
echo       [OK] Boot task (ACHME_CRM_AutoBoot) removed
echo       [OK] Login task (ACHME_CRM_Login_Startup) removed
echo       [OK] Watchdog task (ACHME_CRM_Watchdog) removed
echo       [OK] Firewall rules deleted
echo       [OK] Power settings restored (sleep/hibernate re-enabled)
echo       [OK] Tracking files cleaned up
echo.
echo     To re-install auto-boot, run: start-servers.bat
echo     or manually run: install-boot-startup.bat
echo.
echo     Press any key to close...
echo  ===========================================================================
pause >nul
exit /b 0
