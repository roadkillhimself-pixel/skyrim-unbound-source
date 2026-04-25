param(
    [string]$ServerSettingsPath = "",
    [string]$ClientSettingsPath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ServerSettingsPath)) {
    $ServerSettingsPath = Join-Path $PSScriptRoot "..\..\build\dist\server\server-settings.json"
}

if ([string]::IsNullOrWhiteSpace($ClientSettingsPath)) {
    $programFilesX86 = ${env:ProgramFiles(x86)}
    if ([string]::IsNullOrWhiteSpace($programFilesX86)) {
        $programFilesX86 = $env:ProgramFiles
    }

    $ClientSettingsPath = Join-Path $programFilesX86 "Steam\steamapps\common\Skyrim Special Edition\Data\Platform\Plugins\skymp5-client-settings.txt"
}

function Add-Check {
    param(
        [System.Collections.Generic.List[string]]$Bucket,
        [string]$Message
    )

    $Bucket.Add($Message) | Out-Null
}

function Get-UiPort {
    param([int]$Port)
    if ($Port -eq 7777) { return 3000 }
    return ($Port + 1)
}

function Get-JsonFile {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "File not found: $Path"
    }

    return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Is-LoopbackHost {
    param([AllowNull()][string]$TargetHost)

    if ([string]::IsNullOrWhiteSpace($TargetHost)) { return $false }
    $normalized = $TargetHost.Trim().ToLowerInvariant()
    return $normalized -in @("127.0.0.1", "localhost", "::1")
}

$server = Get-JsonFile -Path $ServerSettingsPath
$client = Get-JsonFile -Path $ClientSettingsPath

$infos = [System.Collections.Generic.List[string]]::new()
$warnings = [System.Collections.Generic.List[string]]::new()
$errors = [System.Collections.Generic.List[string]]::new()

$offlineMode = [bool]$server.offlineMode
$serverPort = if ($server.port) { [int]$server.port } else { 7777 }
$uiPort = Get-UiPort -Port $serverPort
$listenHost = if ($server.PSObject.Properties.Name -contains "listenHost") { [string]$server.listenHost } else { "" }
$uiListenHost = if ($server.PSObject.Properties.Name -contains "uiListenHost") { [string]$server.uiListenHost } else { "" }
$master = [string]$server.master
$masterKey = if ($server.PSObject.Properties.Name -contains "masterKey") { [string]$server.masterKey } else { "" }
$serverPassword = if ($server.PSObject.Properties.Name -contains "password") { [string]$server.password } else { "" }
$clientMaster = [string]$client.master
$clientMasterKey = if ($client.PSObject.Properties.Name -contains "server-master-key") { [string]$client."server-master-key" } else { "" }
$clientServerIp = [string]$client."server-ip"
$clientHasProfileId = $false
if ($client.PSObject.Properties.Name -contains "gameData") {
    $clientHasProfileId = $client.gameData.PSObject.Properties.Name -contains "profileId"
}

if ($offlineMode) {
    Add-Check -Bucket $infos -Message "Server is still in offline mode. Good for LAN tests, not good for internet authentication."
    Add-Check -Bucket $errors -Message 'Set "offlineMode" to false for a public online test.'
} else {
    Add-Check -Bucket $infos -Message "Server is already in online mode."
}

if ([string]::IsNullOrWhiteSpace($master)) {
    Add-Check -Bucket $errors -Message 'Server "master" URL is empty.'
}

if ([string]::IsNullOrWhiteSpace($masterKey)) {
    Add-Check -Bucket $errors -Message 'Server "masterKey" is empty.'
}

if (Is-LoopbackHost -TargetHost $listenHost) {
    Add-Check -Bucket $errors -Message "listenHost is $listenHost, so gameplay traffic is localhost-only."
}

if (Is-LoopbackHost -TargetHost $uiListenHost) {
    Add-Check -Bucket $errors -Message "uiListenHost is $uiListenHost, so remote clients cannot fetch UI assets."
}

if ([string]::IsNullOrWhiteSpace($serverPassword)) {
    Add-Check -Bucket $warnings -Message "No server password is set. Safer for a staged test to use one temporarily."
}

if ($clientHasProfileId) {
    Add-Check -Bucket $errors -Message 'Client config still contains gameData.profileId, which is the offline auth path.'
}

if ([string]::IsNullOrWhiteSpace($clientMaster)) {
    Add-Check -Bucket $errors -Message 'Client "master" is empty.'
}

if ([string]::IsNullOrWhiteSpace($clientMasterKey)) {
    Add-Check -Bucket $errors -Message 'Client "server-master-key" is empty.'
} elseif (-not [string]::IsNullOrWhiteSpace($masterKey) -and $clientMasterKey -ne $masterKey) {
    Add-Check -Bucket $errors -Message 'Client "server-master-key" does not match server "masterKey".'
}

if (Is-LoopbackHost -TargetHost $clientServerIp) {
    Add-Check -Bucket $warnings -Message "Client server-ip is $clientServerIp. Remote testers need the public IP or domain instead."
}

Add-Check -Bucket $infos -Message "Expected public ports: UDP $serverPort and TCP $uiPort."
Add-Check -Bucket $infos -Message "You still need router/firewall forwarding plus real remote sessions on tester clients."

Write-Host ""
Write-Host "=== SkyMP Public Test Preflight ==="
Write-Host "Server settings: $ServerSettingsPath"
Write-Host "Client settings: $ClientSettingsPath"
Write-Host ""

foreach ($message in $infos) {
    Write-Host "[info] $message"
}
foreach ($message in $warnings) {
    Write-Host "[warning] $message" -ForegroundColor Yellow
}
foreach ($message in $errors) {
    Write-Host "[error] $message" -ForegroundColor Red
}

Write-Host ""
if ($errors.Count -gt 0) {
    Write-Host "Public-test readiness: BLOCKED" -ForegroundColor Red
    exit 1
}

if ($warnings.Count -gt 0) {
    Write-Host "Public-test readiness: READY WITH WARNINGS" -ForegroundColor Yellow
    exit 0
}

Write-Host "Public-test readiness: READY" -ForegroundColor Green
exit 0
