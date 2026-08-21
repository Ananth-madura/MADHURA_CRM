@echo off
SET MYSQL="C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
SET OUT=d:\ACHME_COMUNICATION-main\scratch\varchar_check.txt

echo === ALL VARCHAR columns across all item tables === > %OUT%
%MYSQL% -u achme_user -pAchmeSecure@2024 achme -e "SELECT table_name, column_name, column_type, character_maximum_length FROM information_schema.columns WHERE table_schema='achme' AND data_type='varchar' AND table_name IN ('quotation_items','service_estimation_items','estimate_invoice_items','estimate_items','performainvoice_items','service_items') ORDER BY table_name, column_name;" >> %OUT% 2>&1

echo. >> %OUT%
echo === pi_from_addresses.address column === >> %OUT%
%MYSQL% -u achme_user -pAchmeSecure@2024 achme -e "SHOW COLUMNS FROM pi_from_addresses;" >> %OUT% 2>&1

echo. >> %OUT%
echo === quotation_items.description CURRENT TYPE === >> %OUT%
%MYSQL% -u achme_user -pAchmeSecure@2024 achme -e "SELECT column_name, column_type, character_maximum_length FROM information_schema.columns WHERE table_schema='achme' AND table_name='quotation_items' AND column_name='description';" >> %OUT% 2>&1

echo DONE >> %OUT%
