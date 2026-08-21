@echo off
SET MYSQL="C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
SET OUT=d:\ACHME_COMUNICATION-main\scratch\ibm_fix_result.txt

echo === Connecting to IBM-SERVER MySQL === > %OUT%

REM Try to connect to IBM-SERVER MySQL with same credentials
%MYSQL% -h 192.168.0.145 -u achme_user -pAchmeSecure@2024 achme -e "SELECT @@hostname, @@port;" >> %OUT% 2>&1

echo. >> %OUT%
echo === BEFORE FIX - quotation_items.description === >> %OUT%
%MYSQL% -h 192.168.0.145 -u achme_user -pAchmeSecure@2024 achme -e "SHOW COLUMNS FROM quotation_items LIKE 'description';" >> %OUT% 2>&1

echo. >> %OUT%
echo === APPLYING FIX === >> %OUT%
%MYSQL% -h 192.168.0.145 -u achme_user -pAchmeSecure@2024 achme -e "ALTER TABLE quotation_items MODIFY COLUMN description TEXT NOT NULL;" >> %OUT% 2>&1
%MYSQL% -h 192.168.0.145 -u achme_user -pAchmeSecure@2024 achme -e "ALTER TABLE quotation_items MODIFY COLUMN quantity DECIMAL(10,2) NOT NULL;" >> %OUT% 2>&1
%MYSQL% -h 192.168.0.145 -u achme_user -pAchmeSecure@2024 achme -e "ALTER TABLE service_estimation_items MODIFY COLUMN description TEXT NOT NULL;" >> %OUT% 2>&1
%MYSQL% -h 192.168.0.145 -u achme_user -pAchmeSecure@2024 achme -e "ALTER TABLE service_estimation_items MODIFY COLUMN quantity DECIMAL(10,2) NOT NULL;" >> %OUT% 2>&1
%MYSQL% -h 192.168.0.145 -u achme_user -pAchmeSecure@2024 achme -e "ALTER TABLE estimate_invoice_items MODIFY COLUMN description TEXT NOT NULL;" >> %OUT% 2>&1
%MYSQL% -h 192.168.0.145 -u achme_user -pAchmeSecure@2024 achme -e "ALTER TABLE estimate_invoice_items MODIFY COLUMN quantity DECIMAL(10,2) NOT NULL;" >> %OUT% 2>&1
%MYSQL% -h 192.168.0.145 -u achme_user -pAchmeSecure@2024 achme -e "ALTER TABLE estimate_items MODIFY COLUMN description TEXT NOT NULL;" >> %OUT% 2>&1
%MYSQL% -h 192.168.0.145 -u achme_user -pAchmeSecure@2024 achme -e "ALTER TABLE estimate_items MODIFY COLUMN quantity DECIMAL(10,2) NOT NULL;" >> %OUT% 2>&1
%MYSQL% -h 192.168.0.145 -u achme_user -pAchmeSecure@2024 achme -e "ALTER TABLE performainvoice_items MODIFY COLUMN description TEXT NOT NULL;" >> %OUT% 2>&1
%MYSQL% -h 192.168.0.145 -u achme_user -pAchmeSecure@2024 achme -e "ALTER TABLE performainvoice_items MODIFY COLUMN quantity DECIMAL(10,2) NOT NULL;" >> %OUT% 2>&1
%MYSQL% -h 192.168.0.145 -u achme_user -pAchmeSecure@2024 achme -e "ALTER TABLE service_items MODIFY COLUMN description TEXT NOT NULL;" >> %OUT% 2>&1
%MYSQL% -h 192.168.0.145 -u achme_user -pAchmeSecure@2024 achme -e "ALTER TABLE service_items MODIFY COLUMN quantity DECIMAL(10,2) NOT NULL;" >> %OUT% 2>&1

echo. >> %OUT%
echo === VERIFICATION AFTER FIX === >> %OUT%
%MYSQL% -h 192.168.0.145 -u achme_user -pAchmeSecure@2024 achme -e "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema='achme' AND column_name='description' AND table_name IN ('quotation_items','service_estimation_items','estimate_invoice_items','estimate_items','performainvoice_items','service_items') ORDER BY table_name;" >> %OUT% 2>&1

echo. >> %OUT%
echo ALL DONE >> %OUT%
