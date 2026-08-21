@echo off
SET MYSQL="C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
SET OUT=d:\ACHME_COMUNICATION-main\scratch\actual_schema.txt

echo === quotation_items columns === > %OUT%
%MYSQL% -u achme_user -pAchmeSecure@2024 achme -e "SHOW FULL COLUMNS FROM quotation_items;" >> %OUT% 2>&1

echo. >> %OUT%
echo === notifications table - description column === >> %OUT%
%MYSQL% -u achme_user -pAchmeSecure@2024 achme -e "SHOW COLUMNS FROM notifications LIKE 'description';" >> %OUT% 2>&1

echo. >> %OUT%
echo === ALL varchar/text columns in quotation_items === >> %OUT%
%MYSQL% -u achme_user -pAchmeSecure@2024 achme -e "SELECT column_name, column_type, character_maximum_length FROM information_schema.columns WHERE table_schema='achme' AND table_name='quotation_items' ORDER BY ordinal_position;" >> %OUT% 2>&1

echo DONE >> %OUT%
