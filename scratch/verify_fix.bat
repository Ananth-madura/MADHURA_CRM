@echo off
SET MYSQL="C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
SET OUT=d:\ACHME_COMUNICATION-main\scratch\verify_fix.txt

echo === CURRENT STATE OF quotation_items.description === > %OUT%
%MYSQL% -u achme_user -pAchmeSecure@2024 achme -e "SHOW COLUMNS FROM quotation_items LIKE 'description';" >> %OUT% 2>&1
echo. >> %OUT%
echo === TEST INSERT: 44 items with long descriptions === >> %OUT%
%MYSQL% -u achme_user -pAchmeSecure@2024 achme -e "INSERT INTO quotation_items (quotation_id, product_number, description, brand_model, hsn_sac, uom, price, quantity, tax, discount, subtotal) VALUES (99999, 1, 'This is a very long description that exceeds 255 characters in length to test if the column has been properly changed from VARCHAR(255) to TEXT type - adding more text to make it go over the limit for sure here we go', 'TestBrand', '12345', 'Nos', 100.00, 1, 18, 0, 100.00); DELETE FROM quotation_items WHERE quotation_id=99999;" >> %OUT% 2>&1
echo. >> %OUT%
echo DONE >> %OUT%
