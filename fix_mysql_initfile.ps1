$logFile = "E:\MADHURA_CRM\mysql_fix_log.txt"
$myIni = "C:\ProgramData\MySQL\MySQL Server 8.0\my.ini"
$initSql = "E:\MADHURA_CRM\mysql_init.sql"

function Log($msg) {
    "$(Get-Date -Format HH:mm:ss) $msg" | Out-File $logFile -Append
}

Log "=== Starting init-file fix ==="

# 1. Add init-file to my.ini before [mysqld]
Log "Adding init-file to my.ini..."
$content = Get-Content $myIni -Raw
# Copy init SQL to MySQL data dir (accessible by NetworkService)
Copy-Item "E:\MADHURA_CRM\mysql_init.sql" "C:\ProgramData\MySQL\MySQL Server 8.0\Data\init.sql" -Force
$initFileValue = 'init_file="C:/ProgramData/MySQL/MySQL Server 8.0/Data/init.sql"'
$newContent = $content -replace "\[mysqld\]", "$initFileValue`r`n[mysqld]"
Set-Content $myIni -Value $newContent

# 2. Stop MySQL
Log "Stopping MySQL80..."
sc.exe stop MySQL80 2>&1 | Out-Null
Start-Sleep -Seconds 10

# 3. Kill remaining
taskkill /F /IM mysqld.exe 2>&1 | Out-Null
Start-Sleep -Seconds 5

# 4. Start MySQL
Log "Starting MySQL80..."
sc.exe start MySQL80 2>&1 | Out-Null
Start-Sleep -Seconds 8

# 5. Check status and test
$svc = Get-Service MySQL80
Log "Service: $($svc.Status)"
$mysql = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"

if ($svc.Status -eq 'Running') {
    Start-Sleep -Seconds 3
    $test = & $mysql -u root -padmin@123 -e "SELECT 'ok' AS test;" 2>&1
    Log "Root test: $test"
    
    if ($LASTEXITCODE -eq 0) {
        Log "Root login works!"
        $test2 = & $mysql -u achme_user -pAchmeSecure@2024 achme -e "SELECT 'connected' AS status;" 2>&1
        Log "achme_user test: $test2"
        if ($LASTEXITCODE -eq 0) {
            Log "SUCCESS! achme_user works."
        } else {
            Log "achme_user still failing"
        }
    } else {
        Log "Root login failed - password was not changed"
        
        # Try to connect without password (in case init-file didn't run)
        $test3 = & $mysql -u root -e "SELECT 1;" 2>&1
        Log "Root no-pw test: $test3"
    }
} else {
    Log "Service failed to start"
}

# 6. Remove init-file from my.ini
Log "Removing init-file from my.ini..."
$content2 = Get-Content $myIni -Raw
$cleaned = $content2 -replace "init_file=.*`r?`n", ""
Set-Content $myIni -Value $cleaned

# 7. Cleanup init.sql from data dir
Remove-Item "C:\ProgramData\MySQL\MySQL Server 8.0\Data\init.sql" -Force -ErrorAction SilentlyContinue

Log "=== Fix attempt complete ==="
