$logFile = "E:\MADHURA_CRM\mysql_fix_log.txt"
"=== Fix attempt 3 at $(Get-Date) ===" | Out-File $logFile -Append

$mysqlBin = "C:\Program Files\MySQL\MySQL Server 8.0\bin"
$defaultsFile = "C:\ProgramData\MySQL\MySQL Server 8.0\my.ini"

# Kill all mysqld processes by any means necessary
"Killing all mysqld processes..." | Out-File $logFile -Append
taskkill /F /IM mysqld.exe 2>&1 | Out-File $logFile -Append
Start-Sleep -Seconds 5

# Force kill any remaining
Get-Process mysqld -ErrorAction SilentlyContinue | ForEach-Object {
    "Killing PID $($_.Id) via WMI..." | Out-File $logFile -Append
    Get-CimInstance Win32_Process -Filter "ProcessId='$($_.Id)'" | Invoke-CimMethod -MethodName Terminate 2>&1 | Out-File $logFile -Append
}
Start-Sleep -Seconds 3

# Check if any mysqld remain
$remaining = Get-Process mysqld -ErrorAction SilentlyContinue
if ($remaining) {
    "Still have remaining mysqld processes!" | Out-File $logFile -Append
    $remaining | ForEach-Object { "  PID: $($_.Id)" | Out-File $logFile -Append }
    exit 1
}

# Check port
$portCheck = netstat -ano | Select-String ":3306 "
if ($portCheck) {
    "Port 3306 still in use:" | Out-File $logFile -Append
    $portCheck | Out-File $logFile -Append
    
    # Try to kill process on port 3306
    $pidOnPort = ($portCheck | Select-String -Pattern "LISTENING" | ForEach-Object { $_ -replace '.*\s+(\d+)$', '$1' })
    if ($pidOnPort) {
        "Killing PID $pidOnPort on port 3306..." | Out-File $logFile -Append
        taskkill /F /PID $pidOnPort 2>&1 | Out-File $logFile -Append
        Start-Sleep -Seconds 3
    }
}

# Start with skip-grant-tables
"Starting mysqld with skip-grant-tables..." | Out-File $logFile -Append
$proc = Start-Process -FilePath "$mysqlBin\mysqld.exe" -ArgumentList "--defaults-file=$defaultsFile", "--skip-grant-tables", "--skip-networking" -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 8

$mysql = "$mysqlBin\mysql.exe"
$result = & $mysql -u root -e "SELECT 'alive' AS test;" 2>&1
"Connect test: $result" | Out-File $logFile -Append

if ($LASTEXITCODE -eq 0) {
    "Connected! Resetting root password..." | Out-File $logFile -Append
    & $mysql -u root -e "FLUSH PRIVILEGES; ALTER USER 'root'@'localhost' IDENTIFIED BY 'admin@123';" 2>&1 | Out-File $logFile -Append
}

"Stopping temp mysqld..." | Out-File $logFile -Append
taskkill /F /IM mysqld.exe 2>&1 | Out-File $logFile -Append
Start-Sleep -Seconds 5

"Starting MySQL80 service..." | Out-File $logFile -Append
sc.exe start MySQL80 2>&1 | Out-File $logFile -Append
Start-Sleep -Seconds 8

$svc = Get-Service MySQL80
"Service status: $($svc.Status)" | Out-File $logFile -Append

if ($svc.Status -eq 'Running') {
    $rootTest = & $mysql -u root -padmin@123 -e "SELECT 1;" 2>&1
    "Root test: $rootTest" | Out-File $logFile -Append
    
    if ($LASTEXITCODE -eq 0) {
        "Creating user and database..." | Out-File $logFile -Append
        & $mysql -u root -padmin@123 -e "CREATE DATABASE IF NOT EXISTS achme DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>&1 | Out-File $logFile -Append
        & $mysql -u root -padmin@123 -e "CREATE USER IF NOT EXISTS 'achme_user'@'localhost' IDENTIFIED BY 'AchmeSecure@2024';" 2>&1 | Out-File $logFile -Append
        & $mysql -u root -padmin@123 -e "CREATE USER IF NOT EXISTS 'achme_user'@'127.0.0.1' IDENTIFIED BY 'AchmeSecure@2024';" 2>&1 | Out-File $logFile -Append
        & $mysql -u root -padmin@123 -e "GRANT ALL PRIVILEGES ON achme.* TO 'achme_user'@'localhost';" 2>&1 | Out-File $logFile -Append
        & $mysql -u root -padmin@123 -e "GRANT ALL PRIVILEGES ON achme.* TO 'achme_user'@'127.0.0.1';FLUSH PRIVILEGES;" 2>&1 | Out-File $logFile -Append
        
        $verify = & $mysql -u achme_user -pAchmeSecure@2024 achme -e "SELECT 'SUCCESS' AS status;" 2>&1
        "Verify: $verify" | Out-File $logFile -Append
        if ($LASTEXITCODE -eq 0) {
            "ALL DONE - achme_user works!" | Out-File $logFile -Append
        }
    } else {
        "Root password reset failed" | Out-File $logFile -Append
    }
} else {
    "Service start failed" | Out-File $logFile -Append
}

"=== Finished at $(Get-Date) ===" | Out-File $logFile -Append
