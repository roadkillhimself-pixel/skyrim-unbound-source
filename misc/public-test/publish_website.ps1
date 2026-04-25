$ErrorActionPreference = "Stop"

function Ensure-Directory {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Force -Path $Path | Out-Null
    }
}

function Mirror-Directory {
    param(
        [string]$Source,
        [string]$Target
    )

    Ensure-Directory -Path $Target

    & robocopy $Source $Target /MIR /R:2 /W:1 /NFL /NDL /NJH /NJS /NC /NS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) {
        throw "robocopy failed while mirroring $Source to $Target with exit code $LASTEXITCODE"
    }
}

function Copy-TopLevelFiles {
    param(
        [string]$Source,
        [string]$Target
    )

    Ensure-Directory -Path $Target

    Get-ChildItem -LiteralPath $Source -File | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $Target $_.Name) -Force
    }
}

$sourceRoot = Join-Path $PSScriptRoot "website"
$targetRoot = Join-Path $PSScriptRoot "..\..\build\dist\server\data"
$landingTarget = Join-Path $targetRoot "landing"

if (-not (Test-Path -LiteralPath $sourceRoot)) {
    throw "Website source directory not found: $sourceRoot"
}

Ensure-Directory -Path $targetRoot

# Keep the entire website available under /landing/ so preview-style URLs and
# asset paths resolve exactly as authored.
Mirror-Directory -Source $sourceRoot -Target $landingTarget

# Also expose the public entry points and top-level static assets from the
# server root so the same website bundle works both standalone and when served
# by the SkyMP server.
Copy-TopLevelFiles -Source $sourceRoot -Target $targetRoot

foreach ($legalDir in @("terms", "privacy", "payments")) {
    Mirror-Directory `
        -Source (Join-Path $sourceRoot $legalDir) `
        -Target (Join-Path $targetRoot $legalDir)
}

Write-Host "Website published to $targetRoot"
