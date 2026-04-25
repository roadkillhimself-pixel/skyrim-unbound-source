param(
    [string]$ServerDataDir = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "[publish-admin-panel] $Message"
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

$ServerDataDir = [System.IO.Path]::GetFullPath($ServerDataDir)
$SourceDir = Join-Path $PSScriptRoot "admin-panel"
$TargetDir = Join-Path $ServerDataDir "admin"

if (-not (Test-Path -LiteralPath $SourceDir)) {
    throw "Admin panel source directory not found: $SourceDir"
}

Ensure-Directory -Path $TargetDir

& robocopy $SourceDir $TargetDir /MIR /R:2 /W:1 /NFL /NDL /NJH /NJS /NC /NS /NP | Out-Null
if ($LASTEXITCODE -ge 8) {
    throw "robocopy failed with exit code $LASTEXITCODE"
}

Write-Step "Published admin panel to $TargetDir"
Write-Step "Admin URL: http://127.0.0.1:3000/admin/"
