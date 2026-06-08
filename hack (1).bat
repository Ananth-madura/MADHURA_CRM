@echo off
setlocal enabledelayedexpansion
title System Breach Detected
color 0c

echo.
echo  [!] CRITICAL SYSTEM WARNING
echo  [!] UNAUTHORIZED ACCESS DETECTED AT %time%
echo  [!] INITIALIZING COUNTER-MEASURES...
echo.
timeout /t 2 /nobreak >nul

:: Phase 1: The Terminal Flash (20 terminals open/close 114 times)
echo Executing Phase 1: Port Scanning...
for /L %%i in (1,1,114) do (
    echo [%%i] Port Scanning Cycle...
    for /L %%j in (1,1,50) do (
        start "PRANK_PROC" cmd /c "exit"
    )
    timeout /t 1 /nobreak >nul
    taskkill /F /FI "WINDOWTITLE eq PRANK_PROC*" /IM cmd.exe >nul 2>&1
)

echo.
echo Phase 1 Complete. Port Map Acquired.
echo Executing Final Payloads...
timeout /t 1 /nobreak >nul

:: Phase 2: Final 3 Terminals

:: Terminal 1: THE BIG MESSAGE
(
echo @echo off
echo color 0d
echo title YOU HAVE BEEN HACKED BY ANANTH
echo echo.
echo echo       .                                                      .
echo echo     .n                   .                 .                  n.
echo echo   .  .               .   n                 n   .               .  .
echo echo  ^|^|  ^|^|             .J. .P.               .P. .J.             ^|^|  ^|^|
echo echo  ^|^|  ^|^|           .. ^|^| . ^|^|               ^|^| . ^|^| ..           ^|^|  ^|^|
echo echo  ^|^|  ^|^|         ..   ^|^| . ^|^|               ^|^| . ^|^|   ..         ^|^|  ^|^|
echo echo  ^|^|  ^|^|       ..     ^|^| . ^|^|               ^|^| . ^|^|     ..       ^|^|  ^|^|
echo echo  ^|^|  ^|^|     ..       ^|^| . ^|^|               ^|^| . ^|^|       ..     ^|^|  ^|^|
echo echo  ^|^|  ^|^|   ..         ^|^| . ^|^|               ^|^| . ^|^|         ..   ^|^|  ^|^|
echo echo  ^|^|  ^|^| ..           ^|^| . ^|^|               ^|^| . ^|^|           .. ^|^|  ^|^|
echo echo  ^|^|  ^|^|..             ^|^| . ^|^|               ^|^| . ^|^|             ..^|^|  ^|^|
echo echo  ^|^|  ^|^|               ^|^| . ^|^|               ^|^| . ^|^|               ^|^|  ^|^|
echo echo  '--'               '--' '--'               '--' '--'               '--'
echo echo.
echo echo    ===================================================================
echo echo    #                                                                 #
echo echo    #                  YOU HAVE BEEN HACKED BY 
HITE DEVIL                 #
echo echo    #                                                                 #
echo echo    ===================================================================
echo echo.
echo echo    [SYSTEM]:  2.0 Active.
echo echo    [STATUS]: Local system successfully compromised. WHITE DEVIL echo echo   
           [INFO]:   All your data belongs to DEVIL now.
echo echo    [INFO]:   Ransomware deployed. Pay up or lose everything.
echo echo    [INFO]:   Contact devil at DEVIL@example.com
echo pause
) > "%temp%\hacked_message.bat"
start "HACKED_MESSAGE" "%temp%\hacked_message.bat"

:: Terminal 2: Tree Command 20 times
(
echo @echo off
echo color 0a
echo title Scanning Files...
echo for /L %%%%i in (1,1,50) do (
echo     echo [Cycle %%%%i/50] Analyzing File System Integrity...
echo     tree C:\
echo )
echo echo SCAN COMPLETE. ALL FILES ENCRYPTED.
echo pause
) > "%temp%\tree_runner.bat"
start "TREE_SCAN" "%temp%\tree_runner.bat"

:: Terminal 3: 250 Loop Hacking
(
echo @echo off
echo color 0a
echo title Execution Loop...
echo setlocal enabledelayedexpansion
echo for /L %%%%i in (1,1,2500) do (
echo     set /a "r=!random! %% 10"
echo     echo [!time!] Accessing Sector %%%%i... [OK]
echo     echo [!time!] Copying data: !random!!random! bytes...
echo     if !r! EQU 7 echo [!time!] ^!^!^! FIREWALL BYPASSED ^!^!^!
echo     if !r! EQU 3 echo [!time!] ^!^!^! ROOT ACCESS GRANTED ^!^!^!
echo     timeout /t 0 /nobreak ^>nul
echo )
echo echo.
echo echo PAYLOAD FULLY EXECUTED. SYSTEM LOCKED.
echo pause
) > "%temp%\hacking_loop.bat"
start "HACKING_PROCESS" "%temp%\hacking_loop.bat"

echo.
echo [DONE] Prank sequence finished. 
echo The final hacking terminals are now active.
pause
