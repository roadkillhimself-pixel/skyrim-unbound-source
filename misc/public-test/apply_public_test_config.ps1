param(
    [string]$ServerSource = "",
    [string]$ServerOverrideSource = "",
    [string]$ClientSource = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ServerSource)) {
    $ServerSource = Join-Path $PSScriptRoot "skyrim-unbound-public-test.server-settings.json"
}

if ([string]::IsNullOrWhiteSpace($ServerOverrideSource)) {
    $ServerOverrideSource = Join-Path $PSScriptRoot "skyrim-unbound-public-test.local.server-settings.json"
}

if ([string]::IsNullOrWhiteSpace($ClientSource)) {
    $ClientSource = Join-Path $PSScriptRoot "skyrim-unbound-public-test.client-settings.json"
}

$ServerTarget = Join-Path $PSScriptRoot "..\..\build\dist\server\server-settings.json"

$programFilesX86 = ${env:ProgramFiles(x86)}
if ([string]::IsNullOrWhiteSpace($programFilesX86)) {
    $programFilesX86 = $env:ProgramFiles
}

$ClientTarget = Join-Path $programFilesX86 "Steam\steamapps\common\Skyrim Special Edition\Data\Platform\Plugins\skymp5-client-settings.txt"

function Get-JsonFile {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Source file not found: $Path"
    }

    return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function ConvertTo-PlainValue {
    param([AllowNull()]$Value)

    if ($null -eq $Value) {
        return $null
    }

    if ($Value -is [string] -or $Value -is [int] -or $Value -is [long] -or $Value -is [double] -or $Value -is [decimal] -or $Value -is [bool]) {
        return $Value
    }

    if ($Value -is [System.Collections.IDictionary]) {
        $result = [ordered]@{}
        foreach ($key in $Value.Keys) {
            $result[$key] = ConvertTo-PlainValue -Value $Value[$key]
        }
        return $result
    }

    if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [string])) {
        $items = @()
        foreach ($item in $Value) {
            $items += ,(ConvertTo-PlainValue -Value $item)
        }
        return $items
    }

    if ($Value.PSObject -and $Value.PSObject.Properties) {
        $result = [ordered]@{}
        foreach ($property in $Value.PSObject.Properties) {
            $result[$property.Name] = ConvertTo-PlainValue -Value $property.Value
        }
        return $result
    }

    return $Value
}

function Merge-PlainValue {
    param(
        [AllowNull()]$Base,
        [AllowNull()]$Override
    )

    if ($null -eq $Override) {
        return $Base
    }

    if ($Base -is [System.Collections.IDictionary] -and $Override -is [System.Collections.IDictionary]) {
        $result = [ordered]@{}

        foreach ($key in $Base.Keys) {
            $result[$key] = $Base[$key]
        }

        foreach ($key in $Override.Keys) {
            if ($result.Contains($key)) {
                $result[$key] = Merge-PlainValue -Base $result[$key] -Override $Override[$key]
            } else {
                $result[$key] = $Override[$key]
            }
        }

        return $result
    }

    return $Override
}

function Write-Utf8NoBomFile {
    param(
        [string]$Path,
        [string]$Content
    )

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Backup-And-Copy {
    param(
        [string]$Source,
        [string]$Target
    )

    if (-not (Test-Path -LiteralPath $Source)) {
        throw "Source file not found: $Source"
    }

    if (Test-Path -LiteralPath $Target) {
        $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
        Copy-Item -LiteralPath $Target -Destination ($Target + ".bak_" + $timestamp) -Force
    }

    Copy-Item -LiteralPath $Source -Destination $Target -Force
}

function Backup-And-WriteJson {
    param(
        [object]$JsonObject,
        [string]$Target
    )

    if (Test-Path -LiteralPath $Target) {
        $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
        Copy-Item -LiteralPath $Target -Destination ($Target + ".bak_" + $timestamp) -Force
    }

    $targetDir = Split-Path -Parent $Target
    if (-not (Test-Path -LiteralPath $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    }

    Write-Utf8NoBomFile -Path $Target -Content ($JsonObject | ConvertTo-Json -Depth 8)
}

$serverSettings = ConvertTo-PlainValue -Value (Get-JsonFile -Path $ServerSource)
if (Test-Path -LiteralPath $ServerOverrideSource) {
    $overrideSettings = ConvertTo-PlainValue -Value (Get-JsonFile -Path $ServerOverrideSource)
    $serverSettings = Merge-PlainValue -Base $serverSettings -Override $overrideSettings
    Write-Host "Applied local server override: $ServerOverrideSource"
}

Backup-And-WriteJson -JsonObject $serverSettings -Target $ServerTarget

$clientSettings = Get-JsonFile -Path $ClientSource
$serverPort = if ($clientSettings.PSObject.Properties.Name -contains "server-port") { [int]$clientSettings."server-port" } else { 7777 }
$uiPort = if ($serverPort -eq 7777) { 3000 } else { $serverPort + 1 }
$localClientSettings = [ordered]@{}
foreach ($property in $clientSettings.PSObject.Properties) {
    $localClientSettings[$property.Name] = $property.Value
}

# Keep the packaged/public template on the real public IP, but make the
# locally installed Skyrim client talk to the server over loopback so WAN IP
# changes do not break play sessions on the host machine.
$localClientSettings["server-ip"] = "127.0.0.1"
$localClientSettings["server-info-ignore"] = $true
$localClientSettings["server-ui-url"] = "http://127.0.0.1:$uiPort"

Backup-And-WriteJson -JsonObject ([pscustomobject]$localClientSettings) -Target $ClientTarget

Write-Host "Applied public-test config files."
Write-Host "Server settings: $ServerTarget"
Write-Host "Client settings: $ClientTarget"
