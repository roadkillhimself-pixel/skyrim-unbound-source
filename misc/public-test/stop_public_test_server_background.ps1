Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "[Skyrim Unbound Server] $Message"
}

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$serverDir = Join-Path $repoRoot "build\dist\server"
$serverScript = Join-Path $serverDir "dist_back\skymp5-server.js"
$pidFile = Join-Path $serverDir "public-test-server.pid"

if (-not (Test-Path -LiteralPath $pidFile)) {
    Write-Step "No PID file found. Server may already be stopped."
    exit 0
}

$pidRaw = (Get-Content -LiteralPath $pidFile -Raw).Trim()
$serverPid = 0
$metadata = $null
if ($pidRaw.StartsWith("{")) {
    $metadata = $pidRaw | ConvertFrom-Json
    $serverPid = [int]$metadata.pid
} elseif (-not [int]::TryParse($pidRaw, [ref]$serverPid)) {
    Remove-Item -LiteralPath $pidFile -Force
    throw "PID file is invalid."
}

$process = Get-Process -Id $serverPid -ErrorAction SilentlyContinue
if ($null -eq $process) {
    Remove-Item -LiteralPath $pidFile -Force
    Write-Step "Process $serverPid is no longer running."
    exit 0
}

$processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $serverPid" -ErrorAction SilentlyContinue
$commandLine = if ($null -ne $processInfo) { [string]$processInfo.CommandLine } else { "" }
$executablePath = if ($null -ne $processInfo) { [string]$processInfo.ExecutablePath } else { "" }
$expectedWorkingDirectory = if ($null -ne $metadata -and $metadata.PSObject.Properties.Name -contains "workingDirectory") {
    [System.IO.Path]::GetFullPath([string]$metadata.workingDirectory).TrimEnd("\")
} else {
    [System.IO.Path]::GetFullPath($serverDir).TrimEnd("\")
}
$expectedExecutable = if ($null -ne $metadata -and $metadata.PSObject.Properties.Name -contains "executablePath") {
    [System.IO.Path]::GetFullPath([string]$metadata.executablePath)
} else {
    ""
}

$looksLikeNode = $process.ProcessName -ieq "node" -or (Split-Path -Leaf $executablePath) -ieq "node.exe"
$mentionsServerScript = $commandLine -like "*dist_back/skymp5-server.js*" -or $commandLine -like "*$serverScript*"
$metadataMatchesExecutable = [string]::IsNullOrWhiteSpace($expectedExecutable) -or $executablePath -ieq $expectedExecutable

if (-not $looksLikeNode -or -not $mentionsServerScript -or -not $metadataMatchesExecutable) {
    throw "Refusing to stop PID $serverPid because it does not look like the public-test SkyMP server. Remove '$pidFile' manually if it is stale."
}

Stop-Process -Id $serverPid -Force
Remove-Item -LiteralPath $pidFile -Force
Write-Step "Stopped server process $serverPid."
