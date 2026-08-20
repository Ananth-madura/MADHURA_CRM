$logFile = "E:\MADHURA_CRM\mysql_fix_log.txt"

function Log($msg) {
    "$(Get-Date -Format HH:mm:ss) $msg" | Out-File $logFile -Append
}

Log "=== NUKE APPROACH ==="

# Step 1: Kill ALL mysqld processes BY ANY MEANS
Log "Step 1: Nuking all mysqld processes..."
Get-Process mysqld -ErrorAction SilentlyContinue | ForEach-Object {
    Log "  Nuking PID $($_.Id)..."
    taskkill /F /PID $($_.Id) 2>&1 | Out-Null
    Start-Sleep -Milliseconds 500
}
Start-Sleep -Seconds 3

# Step 2: Write the config change - add skip-grant-tables to my.ini
$myIni = "C:\ProgramData\MySQL\MySQL Server 8.0\my.ini"
Log "Step 2: Adding skip-grant-tables to my.ini..."
$content = Get-Content $myIni -Raw
if ($content -notmatch "skip-grant-tables") {
    $content = $content -replace "\[mysqld\]", "skip-grant-tables`r`n[mysqld]"
    Set-Content $myIni -Value $content -Force
    Log "  Added skip-grant-tables"
}

# Step 3: Start the service
Log "Step 3: Starting MySQL80 service..."
sc.exe start MySQL80 2>&1 | Out-Null
Start-Sleep -Seconds 8

# Wait for service
$waitCount = 0
while ($waitCount -lt 20) {
    $svc = Get-Service MySQL80 -ErrorAction SilentlyContinue
    if ($svc.Status -eq 'Running') {
        Log "  Service is RUNNING"
        break
    }
    Start-Sleep -Seconds 2
    $waitCount++
}

# Step 4: Connect (no password since skip-grant-tables)
$mysql = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
Log "Step 4: Connecting with skip-grant-tables..."
$test = & $mysql -u root -e "SELECT 'alive' AS test;" 2>&1
Log "  Connect: $test"

if ($LASTEXITCODE -eq 0) {
    Log "  CONNECTED! Executing SQL commands..."
    
    # Flush privileges first (loads grant tables)
    & $mysql -u root -e "FLUSH PRIVILEGES;" 2>&1 | Out-Null
    
    # Set root password
    & $mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY 'admin@123';" 2>&1 | Out-Null
    
    # Create database and user
    & $mysql -u root -e "CREATE DATABASE IF NOT EXISTS achme DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>&1 | Out-Null
    & $mysql -u root -e "CREATE USER IF NOT EXISTS 'achme_user'@'localhost' IDENTIFIED BY 'AchmeSecure@2024';" 2>&1 | Out-Null
    & $mysql -u root -e "CREATE USER IF NOT EXISTS 'achme_user'@'127.0.0.1' IDENTIFIED BY 'AchmeSecure@2024';" 2>&1 | Out-Null
    & $mysql -u root -e "CREATE USER IF NOT EXISTS 'achme_user'@'%' IDENTIFIED BY 'AchmeSecure@2024';" 2>&1 | Out-Null
    & $mysql -u root -e "GRANT ALL PRIVILEGES ON achme.* TO 'achme_user'@'localhost';" 2>&1 | Out-Null
    & $mysql -u root -e "GRANT ALL PRIVILEGES ON achme.* TO 'achme_user'@'127.0.0.1';" 2>&1 | Out-Null
    & $mysql -u root -e "GRANT ALL PRIVILEGES ON achme.* TO 'achme_user'@'%';FLUSH PRIVILEGES;" 2>&1 | Out-Null
    
    Log "  SQL commands executed."
    
} else {
    Log "  FAILED to connect even with skip-grant-tables"
}

# Step 5: Remove skip-grant-tables from my.ini  
Log "Step 5: Removing skip-grant-tables from my.ini..."
$content = Get-Content $myIni -Raw
$content = $content -replace "skip-grant-tables`r?`n", ""
Set-Content $myIni -Value $content -Force

# Step 6: Restart service without skip-grant-tables
Log "Step 6: Restarting service normally..."
sc.exe stop MySQL80 2>&1 | Out-Null
Start-Sleep -Seconds 10
Get-Process mysqld -ErrorAction SilentlyContinue | ForEach-Object {
    taskkill /F /PID $($_.Id) 2>&1 | Out-Null
}
Start-Sleep -Seconds 3
sc.exe start MySQL80 2>&1 | Out-Null
Start-Sleep -Seconds 8

$svc = Get-Service MySQL80
Log "  Final service status: $($svc.Status)"

if ($svc.Status -eq 'Running') {
    $verify = & $mysql -u achme_user -pAchmeSecure@2024 achme -e "SELECT 'connected' AS status;" 2>&1
    Log "  achme_user verify: $verify"
    if ($LASTEXITCODE -eq 0) {
        Log "  *** SUCCESS! ***"
    } else {
        $verify2 = & $mysql -u root -padmin@123 -e "SELECT 1;" 2>&1
        Log "  Root verify: $verify2"
    }
}

Log "=== NUKE COMPLETE ==="
