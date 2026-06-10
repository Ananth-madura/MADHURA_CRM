@echo off
title ACHME - Fix Server Firewall
color 0C

net session >nul 2>&1
if errorlevel 1 (
    echo Requesting Admin rights...
    mshta vbscript:CreateObject("Shell.Application").ShellExecute("""%~f0""","","","runas",1)(window.close)
    exit /b 0
)

echo.
echo  ============================================================
echo   ACHME CRM - Server Firewall Fix
echo   Opening ports 82 and 5000 for LAN access
echo  ============================================================
echo.

:: Remove old rules first
netsh advfirewall firewall delete rule name="ACHME CRM Port 82" >nul 2>&1
netsh advfirewall firewall delete rule name="ACHME CRM Port 5000" >nul 2>&1
netsh advfirewall firewall delete rule name="ACHME CRM Nginx App" >nul 2>&1

:: Add fresh rules for ALL network profiles (domain, private, public)
netsh advfirewall firewall add rule name="ACHME CRM Port 82" dir=in action=allow protocol=TCP localport=82 profile=any
netsh advfirewall firewall add rule name="ACHME CRM Port 5000" dir=in action=allow protocol=TCP localport=5000 profile=any
netsh advfirewall firewall add rule name="ACHME CRM Nginx App" dir=in action=allow program="C:\nginx\nginx.exe" enable=yes profile=any

echo.
echo  Verifying rules were added...
netsh advfirewall firewall show rule name="ACHME CRM Port 82" | findstr "LocalPort"
netsh advfirewall firewall show rule name="ACHME CRM Port 5000" | findstr "LocalPort"

echo.
echo  ============================================================
echo   DONE! Clients on your LAN can now reach:
echo     http://192.168.50.104:82
echo  ============================================================
echo.
pause
