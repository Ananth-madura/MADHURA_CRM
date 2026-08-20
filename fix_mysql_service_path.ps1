$logFile = "E:\MADHURA_CRM\mysql_fix_log.txt"
$svcName = "MySQL80"

function Log($msg) {
    "$(Get-Date -Format HH:mm:ss) $msg" | Out-File $logFile -Append
}

Log "=== Fix via service binary path ==="

# Create the init SQL file in a temp location accessible by NetworkService
$initSqlPath = "C:\Windows\Temp\mysql_init.sql"
@"
ALTER USER 'root'@'localhost' IDENTIFIED BY 'admin@123';
CREATE DATABASE IF NOT EXISTS achme DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'achme_user'@'localhost' IDENTIFIED BY 'AchmeSecure@2024';
CREATE USER IF NOT EXISTS 'achme_user'@'127.0.0.1' IDENTIFIED BY 'AchmeSecure@2024';
CREATE USER IF NOT EXISTS 'achme_user'@'%' IDENTIFIED BY 'AchmeSecure@2024';
GRANT ALL PRIVILEGES ON achme.* TO 'achme_user'@'localhost';
GRANT ALL PRIVILEGES ON achme.* TO 'achme_user'@'127.0.0.1';
GRANT ALL PRIVILEGES ON achme.* TO 'achme_user'@'%';
FLUSH PRIVILEGES;
"@ | Out-File $initSqlPath -Encoding ASCII

Log "Init SQL written to $initSqlPath"

# Read current service config
$svc = Get-CimInstance Win32_Service -Filter "Name='$svcName'"
$currentPath = $svc.PathName
Log "Current binary path: $currentPath"

# Add init-file argument to the binary path
# Current: "C:\...\mysqld.exe" --defaults-file="..." MySQL80
# New: "C:\...\mysqld.exe" --defaults-file="..." --init-file="C:\Windows\Temp\mysql_init.sql" MySQL80
$newPath = $currentPath -replace '\.exe"', '.exe" --init-file="C:/Windows/Temp/mysql_init.sql"'
Log "New binary path: $newPath"

# Stop service
Log "Stopping $svcName..."
sc.exe stop $svcName 2>&1 | Out-Null
Start-Sleep -Seconds 10

# Kill any remaining mysqld
taskkill /F /IM mysqld.exe 2>&1 | Out-Null
Start-Sleep -Seconds 5

# Update the service binary path
Log "Updating service binary path..."
sc.exe config $svcName binPath= "$newPath" 2>&1 | Out-File $logFile -Append

# Start service
Log "Starting $svcName..."
sc.exe start $svcName 2>&1 | Out-Null
Start-Sleep -Seconds 10

$svcCheck = Get-Service $svcName
Log "Service: $($svcCheck.Status)"

$mysql = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"

if ($svcCheck.Status -eq 'Running') {
    Start-Sleep -Seconds 3
    $test = & $mysql -u root -padmin@123 -e "SELECT 'ok' AS test;" 2>&1
    Log "Root test: $test"
    
    if ($LASTEXITCODE -eq 0) {
        Log "ROOT LOGIN WORKS!"
        $test2 = & $mysql -u achme_user -pAchmeSecure@2024 achme -e "SELECT 'connected' AS status;" 2>&1
        Log "achme_user test: $test2"
        if ($LASTEXITCODE -eq 0) {
            Log "SUCCESS!"
        }
    } else {
        Log "Root login still failed"
    }
} else {
    Log "Service start failed"
}

# Restore original service binary path
Log "Restoring original binary path..."
sc.exe config $svcName binPath= "$currentPath" 2>&1 | Out-File $logFile -Append

# Cleanup temp file
Remove-Item $initSqlPath -Force -ErrorAction SilentlyContinue

Log "=== Fix complete ==="
