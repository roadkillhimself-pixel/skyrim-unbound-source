param(
    [string]$ServerDataDir = "",
    [string]$ClientSettingsPath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "[publish-ucp-site] $Message"
}

function Ensure-Directory {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

if ([string]::IsNullOrWhiteSpace($ServerDataDir)) {
    $ServerDataDir = Join-Path $PSScriptRoot "..\..\build\dist\server\data"
}

if ([string]::IsNullOrWhiteSpace($ClientSettingsPath)) {
    $programFilesX86 = ${env:ProgramFiles(x86)}
    if ([string]::IsNullOrWhiteSpace($programFilesX86)) {
        $programFilesX86 = $env:ProgramFiles
    }
    $ClientSettingsPath = Join-Path $programFilesX86 "Steam\steamapps\common\Skyrim Special Edition\Data\Platform\Plugins\skymp5-client-settings.txt"
}

$ServerDataDir = [System.IO.Path]::GetFullPath($ServerDataDir)
$ClientSettingsPath = [System.IO.Path]::GetFullPath($ClientSettingsPath)
$SourceDir = Join-Path $PSScriptRoot "ucp-site"
$TargetDir = Join-Path $ServerDataDir "ucp"

if (-not (Test-Path -LiteralPath $SourceDir)) {
    throw "UCP site source directory not found: $SourceDir"
}

Ensure-Directory -Path $TargetDir

& robocopy $SourceDir $TargetDir /MIR /R:2 /W:1 /NFL /NDL /NJH /NJS /NC /NS /NP | Out-Null
if ($LASTEXITCODE -ge 8) {
    throw "robocopy failed with exit code $LASTEXITCODE"
}

$clientSettings = Get-Content -LiteralPath $ClientSettingsPath -Raw | ConvertFrom-Json
$serverIp = [string]$clientSettings."server-ip"
$serverPort = [int]$clientSettings."server-port"
$uiPort = if ($serverPort -eq 7777) { 3000 } else { $serverPort + 1 }
$ucpUrl = "http://$serverIp`:$uiPort/ucp/"

Write-Step "Published UCP site to $TargetDir"
Write-Step "UCP URL: $ucpUrl"
