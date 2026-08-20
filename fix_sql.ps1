Write-Host "Stopping MySQL services..."
sc.exe stop user 2>$null
sc.exe stop MySQL80 2>$null
sc.exe stop admin 2>$null
Start-Sleep -Seconds 3

Write-Host "Killing all mysqld processes..."
Get-Process mysqld -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 3

Write-Host "Checking port 3306..."
$portCheck = netstat -ano | Select-String ":3306 "
if ($portCheck) {
    Write-Host "ERROR: Port 3306 still in use!"
    netstat -ano | Select-String ":3306 "
    exit 1
}

Write-Host "Starting MySQL80 service..."
sc.exe start MySQL80
Start-Sleep -Seconds 5

$svc = Get-Service MySQL80 -ErrorAction SilentlyContinue
if ($svc.Status -eq 'Running') {
    Write-Host "MySQL service running. Setting up database user..."
    
    $mysql = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
    
    # Try connecting with no password first (initialize-insecure)
    $result = & $mysql -u root -e "SELECT 1;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Connected as root with no password."
        & $mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY 'admin@123';"
        & $mysql -u root -padmin@123 -e "
            CREATE DATABASE IF NOT EXISTS achme DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
            CREATE USER IF NOT EXISTS 'achme_user'@'localhost' IDENTIFIED BY 'AchmeSecure@2024';
            CREATE USER IF NOT EXISTS 'achme_user'@'127.0.0.1' IDENTIFIED BY 'AchmeSecure@2024';
            GRANT ALL PRIVILEGES ON achme.* TO 'achme_user'@'localhost';
            GRANT ALL PRIVILEGES ON achme.* TO 'achme_user'@'127.0.0.1';
            FLUSH PRIVILEGES;
        "
        Write-Host "Database and user created."
    } else {
        Write-Host "Cannot connect as root with no password. Trying with password..."
        # The "user" service might have the data
        sc.exe start user 2>$null
        Start-Sleep -Seconds 3
        
        # Try the user service
        $result = & $mysql -u root -e "SELECT 1;" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Connected to user service!"
            # Same setup...
        } else {
            Write-Host "Still cannot connect. Need to reset password."
            # Stop service, start with skip-grant-tables
            sc.exe stop MySQL80
            Start-Sleep -Seconds 3
            Start-Process -FilePath "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe" -ArgumentList "--defaults-file=C:\ProgramData\MySQL\MySQL Server 8.0\my.ini", "--skip-grant-tables", "--skip-networking" -WindowStyle Hidden
            Start-Sleep -Seconds 5
            & $mysql -u root -e "FLUSH PRIVILEGES; ALTER USER 'root'@'localhost' IDENTIFIED BY 'admin@123';"
            Stop-Process -Name mysqld -Force
            Start-Sleep -Seconds 3
            sc.exe start MySQL80
            Start-Sleep -Seconds 5
            Write-Host "Root password reset to admin@123"
        }
    }
} else {
    Write-Host "FAILED: MySQL service did not start."
}
