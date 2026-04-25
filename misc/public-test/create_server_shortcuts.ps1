Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Ensure-Directory {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function New-ShortcutFile {
    param(
        [string]$ShortcutPath,
        [string]$TargetPath,
        [string]$WorkingDirectory,
        [string]$Description,
        [string]$IconLocation
    )

    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($ShortcutPath)
    $shortcut.TargetPath = $TargetPath
    $shortcut.WorkingDirectory = $WorkingDirectory
    $shortcut.Description = $Description
    if (-not [string]::IsNullOrWhiteSpace($IconLocation)) {
        $shortcut.IconLocation = $IconLocation
    }
    $shortcut.Save()
}

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$startCmd = Join-Path $PSScriptRoot "start_public_test_server_background.cmd"
$stopCmd = Join-Path $PSScriptRoot "stop_public_test_server_background.cmd"
$desktop = [Environment]::GetFolderPath("Desktop")
$startMenuPrograms = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Skyrim Unbound"
$gameExe = Join-Path ${env:ProgramFiles(x86)} "Steam\steamapps\common\Skyrim Special Edition\SkyrimSE.exe"
$cmdIcon = Join-Path $env:SystemRoot "System32\shell32.dll"

Ensure-Directory -Path $startMenuPrograms

$startDesktopShortcut = Join-Path $desktop "Skyrim Unbound Server.lnk"
$stopDesktopShortcut = Join-Path $desktop "Stop Skyrim Unbound Server.lnk"
$startMenuShortcut = Join-Path $startMenuPrograms "Skyrim Unbound Server.lnk"
$stopStartMenuShortcut = Join-Path $startMenuPrograms "Stop Skyrim Unbound Server.lnk"

$startIcon = if (Test-Path -LiteralPath $gameExe) { $gameExe } else { "$cmdIcon,176" }
$stopIcon = "$cmdIcon,132"

New-ShortcutFile -ShortcutPath $startDesktopShortcut -TargetPath $startCmd -WorkingDirectory $PSScriptRoot -Description "Start Skyrim Unbound server in the background" -IconLocation $startIcon
New-ShortcutFile -ShortcutPath $stopDesktopShortcut -TargetPath $stopCmd -WorkingDirectory $PSScriptRoot -Description "Stop Skyrim Unbound server" -IconLocation $stopIcon
New-ShortcutFile -ShortcutPath $startMenuShortcut -TargetPath $startCmd -WorkingDirectory $PSScriptRoot -Description "Start Skyrim Unbound server in the background" -IconLocation $startIcon
New-ShortcutFile -ShortcutPath $stopStartMenuShortcut -TargetPath $stopCmd -WorkingDirectory $PSScriptRoot -Description "Stop Skyrim Unbound server" -IconLocation $stopIcon

Write-Host "Created shortcuts:"
Write-Host "  $startDesktopShortcut"
Write-Host "  $stopDesktopShortcut"
Write-Host "  $startMenuShortcut"
Write-Host "  $stopStartMenuShortcut"
