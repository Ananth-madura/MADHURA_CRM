$mysqlBin = "C:\Program Files\MySQL\MySQL Server 8.0\bin"
$dataDir = "C:\ProgramData\MySQL\MySQL Server 8.0\Data"
$defaultsFile = "C:\ProgramData\MySQL\MySQL Server 8.0\my.ini"

Write-Host "1. Stopping MySQL service..."
sc.exe stop MySQL80
Start-Sleep -Seconds 3

Write-Host "2. Killing all mysqld processes..."
Get-Process mysqld -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 3

Write-Host "3. Starting MySQL with skip-grant-tables..."
Start-Process -FilePath "$mysqlBin\mysqld.exe" -ArgumentList "--defaults-file=$defaultsFile", "--skip-grant-tables", "--skip-networking" -WindowStyle Hidden
Start-Sleep -Seconds 5

Write-Host "4. Connecting and resetting root password..."
$mysql = "$mysqlBin\mysql.exe"
& $mysql -u root -e "FLUSH PRIVILEGES; ALTER USER 'root'@'localhost' IDENTIFIED BY 'admin@123';"
Start-Sleep -Seconds 2

Write-Host "5. Stopping temp mysqld..."
Get-Process mysqld -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 3

Write-Host "6. Starting MySQL normally..."
sc.exe start MySQL80
Start-Sleep -Seconds 5

$svc = Get-Service MySQL80
if ($svc.Status -eq 'Running') {
    Write-Host "7. MySQL running. Creating user and database..."
    & $mysql -u root -padmin@123 -e "
        CREATE DATABASE IF NOT EXISTS achme DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
        CREATE USER IF NOT EXISTS 'achme_user'@'localhost' IDENTIFIED BY 'AchmeSecure@2024';
        CREATE USER IF NOT EXISTS 'achme_user'@'127.0.0.1' IDENTIFIED BY 'AchmeSecure@2024';
        CREATE USER IF NOT EXISTS 'achme_user'@'%' IDENTIFIED BY 'AchmeSecure@2024';
        GRANT ALL PRIVILEGES ON achme.* TO 'achme_user'@'localhost';
        GRANT ALL PRIVILEGES ON achme.* TO 'achme_user'@'127.0.0.1';
        GRANT ALL PRIVILEGES ON achme.* TO 'achme_user'@'%';
        FLUSH PRIVILEGES;
    "
    if ($LASTEXITCODE -eq 0) {
        Write-Host "SUCCESS! User 'achme_user' and database 'achme' are ready."
    } else {
        Write-Host "FAILED to create user/database."
    }
} else {
    Write-Host "FAILED: MySQL service did not start."
}
