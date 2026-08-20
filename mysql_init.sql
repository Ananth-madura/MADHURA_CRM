ALTER USER 'root'@'localhost' IDENTIFIED BY 'admin@123';
CREATE DATABASE IF NOT EXISTS achme DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'achme_user'@'localhost' IDENTIFIED BY 'AchmeSecure@2024';
CREATE USER IF NOT EXISTS 'achme_user'@'127.0.0.1' IDENTIFIED BY 'AchmeSecure@2024';
CREATE USER IF NOT EXISTS 'achme_user'@'%' IDENTIFIED BY 'AchmeSecure@2024';
GRANT ALL PRIVILEGES ON achme.* TO 'achme_user'@'localhost';
GRANT ALL PRIVILEGES ON achme.* TO 'achme_user'@'127.0.0.1';
GRANT ALL PRIVILEGES ON achme.* TO 'achme_user'@'%';
FLUSH PRIVILEGES;
