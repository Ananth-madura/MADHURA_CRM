$logFile = "E:\MADHURA_CRM\mysql_fix_log.txt"
$svcName = "MySQL80"

function Log($msg) {
    "$(Get-Date -Format HH:mm:ss) $msg" | Out-File $logFile -Append
}

Log "=== Final fix attempt ==="

# 1. Create init SQL in temp
$initSql = @"
ALTER USER 'root'@'localhost' IDENTIFIED BY 'admin@123';
CREATE DATABASE IF NOT EXISTS achme DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'achme_user'@'localhost' IDENTIFIED BY 'AchmeSecure@2024';
CREATE USER IF NOT EXISTS 'achme_user'@'127.0.0.1' IDENTIFIED BY 'AchmeSecure@2024';
CREATE USER IF NOT EXISTS 'achme_user'@'%' IDENTIFIED BY 'AchmeSecure@2024';
GRANT ALL PRIVILEGES ON achme.* TO 'achme_user'@'localhost';
GRANT ALL PRIVILEGES ON achme.* TO 'achme_user'@'127.0.0.1';
GRANT ALL PRIVILEGES ON achme.* TO 'achme_user'@'%';
FLUSH PRIVILEGES;
"@

# Write to a location accessible by NetworkService
$initSqlPath = "C:\Windows\Temp\mysql_init.sql"
$initSql | Out-File $initSqlPath -Encoding ASCII -Force
Log "Init SQL created at $initSqlPath"

# 2. Add init_file to my.ini config
$myIni = "C:\ProgramData\MySQL\MySQL Server 8.0\my.ini"
$content = Get-Content $myIni -Raw
if ($content -match "init_file") {
    Log "init_file already in my.ini"
} else {
    $content = $content -replace "\[mysqld\]", "init_file=C:/Windows/Temp/mysql_init.sql`r`n[mysqld]"
    Set-Content $myIni -Value $content -Force
    Log "Added init_file to my.ini"
}

# 3. Stop service and kill processes
Log "Stopping $svcName..."
sc.exe stop $svcName 2>&1 | Out-Null
Start-Sleep -Seconds 15

Log "Killing mysqld processes..."
taskkill /F /IM mysqld.exe 2>&1 | Out-Null
Start-Sleep -Seconds 5

# Check port
$portUsed = netstat -ano | Select-String ":3306 " | Select-String LISTENING
if ($portUsed) {
    Log "Port 3306 still in use! Waiting..."
    taskkill /F /IM mysqld.exe 2>&1 | Out-Null
    Start-Sleep -Seconds 5
    $portUsed = netstat -ano | Select-String ":3306 " | Select-String LISTENING
    if ($portUsed) {
        Log "Port still busy, force continuing..."
    }
}

# 4. Start service
Log "Starting $svcName..."
sc.exe start $svcName 2>&1 | Out-Null
Start-Sleep -Seconds 5

# Wait for service to be fully running
$waitCount = 0
while ($waitCount -lt 15) {
    $svc = Get-Service $svcName -ErrorAction SilentlyContinue
    if ($svc.Status -eq 'Running') { break }
    Start-Sleep -Seconds 2
    $waitCount++
}
Log "Service status after wait: $((Get-Service $svcName).Status)"

$mysql = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"

# Try passwords
$passwords = @("admin@123", "")
$success = $false
foreach ($pw in $passwords) {
    if ($pw -eq "") {
        $test = & $mysql -u root -e "SELECT 1;" 2>&1
    } else {
        $test = & $mysql -u root "-p$pw" -e "SELECT 1;" 2>&1
    }
    $exitCode = $LASTEXITCODE
    Log "Trying root password '$pw': exit=$exitCode"
    
    if ($exitCode -eq 0) {
        Log "ROOT LOGIN WORKS with password '$pw'!"
        
        # Create user and database
        if ($pw -eq "") {
            & $mysql -u root -e "CREATE DATABASE IF NOT EXISTS achme DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>&1 | Out-Null
            & $mysql -u root -e "CREATE USER IF NOT EXISTS 'achme_user'@'localhost' IDENTIFIED BY 'AchmeSecure@2024';" 2>&1 | Out-Null
            & $mysql -u root -e "CREATE USER IF NOT EXISTS 'achme_user'@'127.0.0.1' IDENTIFIED BY 'AchmeSecure@2024';" 2>&1 | Out-Null
            & $mysql -u root -e "CREATE USER IF NOT EXISTS 'achme_user'@'%' IDENTIFIED BY 'AchmeSecure@2024';" 2>&1 | Out-Null
            & $mysql -u root -e "GRANT ALL PRIVILEGES ON achme.* TO 'achme_user'@'localhost';" 2>&1 | Out-Null
            & $mysql -u root -e "GRANT ALL PRIVILEGES ON achme.* TO 'achme_user'@'127.0.0.1';" 2>&1 | Out-Null
            & $mysql -u root -e "GRANT ALL PRIVILEGES ON achme.* TO 'achme_user'@'%';FLUSH PRIVILEGES;" 2>&1 | Out-Null
        } else {
            & $mysql -u root "-p$pw" -e "CREATE DATABASE IF NOT EXISTS achme DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>&1 | Out-Null
            & $mysql -u root "-p$pw" -e "CREATE USER IF NOT EXISTS 'achme_user'@'localhost' IDENTIFIED BY 'AchmeSecure@2024';" 2>&1 | Out-Null
            & $mysql -u root "-p$pw" -e "CREATE USER IF NOT EXISTS 'achme_user'@'127.0.0.1' IDENTIFIED BY 'AchmeSecure@2024';" 2>&1 | Out-Null
            & $mysql -u root "-p$pw" -e "CREATE USER IF NOT EXISTS 'achme_user'@'%' IDENTIFIED BY 'AchmeSecure@2024';" 2>&1 | Out-Null
            & $mysql -u root "-p$pw" -e "GRANT ALL PRIVILEGES ON achme.* TO 'achme_user'@'localhost';" 2>&1 | Out-Null
            & $mysql -u root "-p$pw" -e "GRANT ALL PRIVILEGES ON achme.* TO 'achme_user'@'127.0.0.1';" 2>&1 | Out-Null
            & $mysql -u root "-p$pw" -e "GRANT ALL PRIVILEGES ON achme.* TO 'achme_user'@'%';FLUSH PRIVILEGES;" 2>&1 | Out-Null
        }
        
        # Verify
        $verify = & $mysql -u achme_user "-pAchmeSecure@2024" achme -e "SELECT 'connected' AS status;" 2>&1
        Log "achme_user verify: $verify"
        if ($LASTEXITCODE -eq 0) {
            Log "SUCCESS!"
            $success = $true
        }
        break
    }
}

# 5. Remove init_file from my.ini
Log "Cleaning up my.ini..."
$content = Get-Content $myIni -Raw
$content = $content -replace "init_file=.*`r?`n", ""
Set-Content $myIni -Value $content -Force

# Cleanup temp init.sql
Remove-Item $initSqlPath -Force -ErrorAction SilentlyContinue

# Restart service cleanly
Log "Restarting service without init_file..."
sc.exe stop $svcName 2>&1 | Out-Null
Start-Sleep -Seconds 10
taskkill /F /IM mysqld.exe 2>&1 | Out-Null
Start-Sleep -Seconds 3
sc.exe start $svcName 2>&1 | Out-Null

if ($success) {
    Log "=== ALL DONE SUCCESSFULLY ==="
} else {
    Log "=== FIX FAILED ==="
}

Log " "
