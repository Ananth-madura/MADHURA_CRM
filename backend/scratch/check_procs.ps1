Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*whatsapp-sessions*" } | Select-Object ProcessId, CommandLine | Format-List
