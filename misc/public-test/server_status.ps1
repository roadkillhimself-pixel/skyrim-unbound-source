Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$serverDir = Join-Path $repoRoot "build\dist\server"
$pidFile = Join-Path $serverDir "public-test-server.pid"

if (-not (Test-Path -LiteralPath $pidFile)) {
    Write-Host "Skyrim Unbound server is stopped."
    exit 0
}

$pidRaw = Get-Content -LiteralPath $pidFile -Raw
$serverPid = 0
$pidText = $pidRaw.Trim()
if ($pidText.StartsWith("{")) {
    $metadata = $pidText | ConvertFrom-Json
    $serverPid = [int]$metadata.pid
} elseif (-not [int]::TryParse($pidText, [ref]$serverPid)) {
    Write-Host "Skyrim Unbound server PID file is invalid."
    exit 1
}

$process = Get-Process -Id $serverPid -ErrorAction SilentlyContinue
if ($null -eq $process) {
    Write-Host "Skyrim Unbound server PID file exists, but process $serverPid is not running."
    exit 1
}

Write-Host "Skyrim Unbound server is running with PID $serverPid."
