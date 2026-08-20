$logFile = "E:\MADHURA_CRM\mysql_fix_log.txt"
Start-Transcript -Path $logFile -Append

$mysqlBin = "C:\Program Files\MySQL\MySQL Server 8.0\bin"
$dataDir = "C:\ProgramData\MySQL\MySQL Server 8.0\Data"
$defaultsFile = "C:\ProgramData\MySQL\MySQL Server 8.0\my.ini"

Write-Host "=== STEP 1: Stopping MySQL service ==="
sc.exe stop MySQL80 2>&1
Start-Sleep -Seconds 5

Write-Host "=== STEP 2: Killing all mysqld ==="
Get-Process mysqld -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 3

# Verify port is free
$portCheck = netstat -ano | Select-String ":3306 "
if ($portCheck) {
    Write-Host "ERROR: Port 3306 still in use!"
    netstat -ano | Select-String ":3306 "
    Stop-Transcript
    exit 1
}
Write-Host "Port 3306 is free."

Write-Host "=== STEP 3: Starting MySQL with skip-grant-tables ==="
$proc = Start-Process -FilePath "$mysqlBin\mysqld.exe" -ArgumentList "--defaults-file=$defaultsFile", "--skip-grant-tables", "--skip-networking" -WindowStyle Hidden -PassThru
Write-Host "Started mysqld PID: $($proc.Id)"
Start-Sleep -Seconds 8

Write-Host "=== STEP 4: Resetting root password ==="
$mysql = "$mysqlBin\mysql.exe"
$result = & $mysql -u root -e "FLUSH PRIVILEGES; ALTER USER 'root'@'localhost' IDENTIFIED BY 'admin@123';" 2>&1
Write-Host "Reset result: $result"

Write-Host "=== STEP 5: Stopping temp mysqld ==="
Get-Process mysqld -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 5

# Verify port is free again
$portCheck = netstat -ano | Select-String ":3306 "
if ($portCheck) {
    Write-Host "WARNING: Port 3306 still in use after kill"
    netstat -ano | Select-String ":3306 "
    Get-Process mysqld -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 3
}

Write-Host "=== STEP 6: Starting MySQL80 service ==="
sc.exe start MySQL80 2>&1
Start-Sleep -Seconds 8

$svc = Get-Service MySQL80
if ($svc.Status -eq 'Running') {
    Write-Host "MySQL80 is RUNNING"
    
    Write-Host "=== STEP 7: Testing root connection ==="
    $testResult = & $mysql -u root -padmin@123 -e "SELECT 1 AS test;" 2>&1
    Write-Host "Root test: $testResult"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "=== STEP 8: Creating achme_user and database ==="
        & $mysql -u root -padmin@123 -e "CREATE DATABASE IF NOT EXISTS achme DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>&1
        & $mysql -u root -padmin@123 -e "CREATE USER IF NOT EXISTS 'achme_user'@'localhost' IDENTIFIED BY 'AchmeSecure@2024';" 2>&1
        & $mysql -u root -padmin@123 -e "CREATE USER IF NOT EXISTS 'achme_user'@'127.0.0.1' IDENTIFIED BY 'AchmeSecure@2024';" 2>&1
        & $mysql -u root -padmin@123 -e "CREATE USER IF NOT EXISTS 'achme_user'@'%' IDENTIFIED BY 'AchmeSecure@2024';" 2>&1
        & $mysql -u root -padmin@123 -e "GRANT ALL PRIVILEGES ON achme.* TO 'achme_user'@'localhost';" 2>&1
        & $mysql -u root -padmin@123 -e "GRANT ALL PRIVILEGES ON achme.* TO 'achme_user'@'127.0.0.1';" 2>&1
        & $mysql -u root -padmin@123 -e "GRANT ALL PRIVILEGES ON achme.* TO 'achme_user'@'%';FLUSH PRIVILEGES;" 2>&1
        
        Write-Host "=== STEP 9: Verifying achme_user ==="
        $verify = & $mysql -u achme_user -pAchmeSecure@2024 achme -e "SELECT 'connected' AS status;" 2>&1
        Write-Host "Verify: $verify"
        if ($LASTEXITCODE -eq 0) {
            Write-Host "SUCCESS! Everything is working."
        }
    } else {
        Write-Host "FAILED: Cannot connect as root with admin@123"
        # Try alternative - maybe password is different
        & $mysql -u root --protocol=TCP -e "SELECT 1;" 2>&1
    }
} else {
    Write-Host "FAILED: MySQL service status is $($svc.Status)"
}

Stop-Transcript
