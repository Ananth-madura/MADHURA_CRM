@echo off
SET MYSQL="C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
SET OUT=d:\ACHME_COMUNICATION-main\scratch\connections.txt

echo === WHO IS CONNECTED TO THIS MySQL === > %OUT%
%MYSQL% -u achme_user -pAchmeSecure@2024 achme -e "SELECT user, host, db, command, time, state FROM information_schema.processlist WHERE db='achme';" >> %OUT% 2>&1
echo. >> %OUT%
echo === REMOTE GRANTS === >> %OUT%
%MYSQL% -u achme_user -pAchmeSecure@2024 achme -e "SHOW GRANTS FOR 'achme_user'@'%%';" >> %OUT% 2>&1
echo DONE >> %OUT%
