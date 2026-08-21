@echo off
SET MYSQL="C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
echo === DB Server Info === > "d:\ACHME_COMUNICATION-main\scratch\dbinfo.txt"
%MYSQL% -u achme_user -pAchmeSecure@2024 achme -e "SELECT @@hostname AS host, @@port AS port, USER() AS user;" >> "d:\ACHME_COMUNICATION-main\scratch\dbinfo.txt" 2>&1
echo Done >> "d:\ACHME_COMUNICATION-main\scratch\dbinfo.txt"
