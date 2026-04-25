Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "[Skyrim Unbound Server] $Message"
}

function Invoke-PublishScript {
    param(
        [string]$StepMessage,
        [string]$ScriptPath
    )

    Write-Step $StepMessage
    & powershell -NoProfile -ExecutionPolicy Bypass -File $ScriptPath
    if ($LASTEXITCODE -ne 0) {
        throw "$StepMessage failed."
    }
}

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$serverDir = Join-Path $repoRoot "build\dist\server"
$serverScript = Join-Path $serverDir "dist_back\skymp5-server.js"
$preflightScript = Join-Path $PSScriptRoot "preflight_public_test.ps1"
$publishWebsiteScript = Join-Path $PSScriptRoot "publish_website.ps1"
$publishUcpScript = Join-Path $PSScriptRoot "publish_ucp_site.ps1"
$publishAdminScript = Join-Path $PSScriptRoot "publish_admin_panel.ps1"
$publishScript = Join-Path $PSScriptRoot "publish_client_package.ps1"
$stdoutLog = Join-Path $serverDir "public-test-server.stdout.log"
$stderrLog = Join-Path $serverDir "public-test-server.stderr.log"
$pidFile = Join-Path $serverDir "public-test-server.pid"

if (Test-Path -LiteralPath $pidFile) {
    $existingPidRaw = (Get-Content -LiteralPath $pidFile -Raw).Trim()
    $existingPid = 0
    if ($existingPidRaw.StartsWith("{")) {
        $existingMetadata = $existingPidRaw | ConvertFrom-Json
        $existingPid = [int]$existingMetadata.pid
    } else {
        [int]::TryParse($existingPidRaw, [ref]$existingPid) | Out-Null
    }

    if ($existingPid -gt 0) {
        $existingProcess = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
        if ($null -ne $existingProcess) {
            Write-Step "Server is already running with PID $existingPid."
            Write-Step "Logs: $stdoutLog"
            exit 0
        }
    }

    Remove-Item -LiteralPath $pidFile -Force
}

Write-Step "Running public-test preflight..."
& powershell -NoProfile -ExecutionPolicy Bypass -File $preflightScript
if ($LASTEXITCODE -ne 0) {
    throw "Public-test preflight failed."
}

Invoke-PublishScript -StepMessage "Publishing latest website..." -ScriptPath $publishWebsiteScript
Invoke-PublishScript -StepMessage "Publishing latest UCP site..." -ScriptPath $publishUcpScript
Invoke-PublishScript -StepMessage "Publishing latest admin panel..." -ScriptPath $publishAdminScript
Invoke-PublishScript -StepMessage "Publishing latest laptop client package..." -ScriptPath $publishScript

$nodeCommand = Get-Command node -ErrorAction Stop
Write-Step "Starting background server..."

$process = Start-Process -FilePath $nodeCommand.Source `
    -ArgumentList "dist_back/skymp5-server.js" `
    -WorkingDirectory $serverDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog `
    -PassThru

$pidMetadata = [ordered]@{
    pid = $process.Id
    executablePath = $nodeCommand.Source
    arguments = "dist_back/skymp5-server.js"
    workingDirectory = $serverDir
    startedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
}
[System.IO.File]::WriteAllText($pidFile, ($pidMetadata | ConvertTo-Json -Depth 4), (New-Object System.Text.UTF8Encoding($false)))

Write-Step "Server started in background."
Write-Step "PID: $($process.Id)"
Write-Step "Stdout log: $stdoutLog"
Write-Step "Stderr log: $stderrLog"
