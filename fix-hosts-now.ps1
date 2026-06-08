$ip = '192.168.1.110'
if (Test-Path "$PSScriptRoot\.last-build-ip") {
    $ip = (Get-Content "$PSScriptRoot\.last-build-ip" -Raw).Trim()
} else {
    $myIp = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Ethernet*', 'Wi-Fi*', 'Local Area*' -Type Unicast | Select-Object -First 1).IPAddress
    if ($myIp) { $ip = $myIp }
}
$hostsFile = "$env:SystemRoot\System32\drivers\etc\hosts"
$domains = @('achme.com', 'www.achme.com', 'IBM-SERVER', 'IBM-SERVER.achme.com')
$content = [System.IO.File]::ReadAllLines($hostsFile)
$filtered = $content | Where-Object {
    $line = $_.Trim()
    $keep = $true
    foreach ($d in $domains) {
        if ($line -match ('(?i)\b' + [regex]::Escape($d) + '\b')) {
            $keep = $false
            break
        }
    }
    $keep
}
$newMappings = @(
    '',
    '# ACHME CRM Server Mapping (auto-updated)',
    ($ip + '    achme.com    www.achme.com'),
    ($ip + '    IBM-SERVER   IBM-SERVER.achme.com')
)
[System.IO.File]::WriteAllLines($hostsFile, ($filtered + $newMappings))
Write-Host ("Hosts file updated: achme.com + IBM-SERVER -> " + $ip) -ForegroundColor Green
ipconfig /flushdns | Out-Null
Write-Host "DNS flushed" -ForegroundColor Green
