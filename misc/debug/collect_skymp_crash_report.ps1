param(
  [string]$OutputRoot = (Join-Path $PSScriptRoot "reports"),
  [int]$ClientDumpCount = 5,
  [int]$HoursBack = 12,
  [switch]$NoZip
)

$ErrorActionPreference = "Stop"

function Ensure-Directory {
  param([string]$Path)
  New-Item -ItemType Directory -Path $Path -Force | Out-Null
}

function Write-TextFile {
  param(
    [string]$Path,
    [string[]]$Lines
  )

  Ensure-Directory (Split-Path -Parent $Path)
  Set-Content -LiteralPath $Path -Value $Lines -Encoding UTF8
}

function Copy-IfExists {
  param(
    [string]$Source,
    [string]$DestinationDirectory
  )

  if (-not (Test-Path -LiteralPath $Source)) {
    return $null
  }

  Ensure-Directory $DestinationDirectory
  Copy-Item -LiteralPath $Source -Destination (Join-Path $DestinationDirectory (Split-Path -Leaf $Source)) -Force
  return (Get-Item -LiteralPath $Source)
}

function Copy-DirectoryIfExists {
  param(
    [string]$Source,
    [string]$DestinationDirectory
  )

  if (-not (Test-Path -LiteralPath $Source)) {
    return $null
  }

  Ensure-Directory $DestinationDirectory
  $target = Join-Path $DestinationDirectory (Split-Path -Leaf $Source)
  Copy-Item -LiteralPath $Source -Destination $target -Recurse -Force
  return (Get-Item -LiteralPath $Source)
}

function Get-FileMetadata {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return $null
  }

  $item = Get-Item -LiteralPath $Path
  return [PSCustomObject]@{
    path = $item.FullName
    length = if ($item.PSIsContainer) { $null } else { $item.Length }
    lastWriteTime = $item.LastWriteTime.ToString("o")
  }
}

function Get-ExistingPath {
  param([string[]]$Candidates)

  foreach ($candidate in $Candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }

  return $null
}

function Safe-Run {
  param(
    [string]$Name,
    [scriptblock]$Action
  )

  try {
    return & $Action
  } catch {
    return [PSCustomObject]@{
      __error = "$Name failed: $($_.Exception.Message)"
    }
  }
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$bundleDir = Join-Path $OutputRoot "skymp-crash-report-$timestamp"
Ensure-Directory $bundleDir

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$documentsDir = [Environment]::GetFolderPath("MyDocuments")
$localAppData = [Environment]::GetFolderPath("LocalApplicationData")

$myGamesDir = Join-Path $documentsDir "My Games\Skyrim Special Edition"
$skseDir = Join-Path $myGamesDir "SKSE"
$clientCrashDir = Join-Path $skseDir "Crashdumps"
$localSkyrimAppDataDir = Join-Path $localAppData "Skyrim Special Edition"

$liveGameDir = Get-ExistingPath @(
  (Join-Path ${env:ProgramFiles(x86)} "Steam\steamapps\common\Skyrim Special Edition"),
  (Join-Path ${env:ProgramFiles} "Steam\steamapps\common\Skyrim Special Edition")
)

$serverBuildDir = Join-Path $repoRoot "build\dist\server"
$clientSourceDir = Join-Path $repoRoot "skymp5-client"
$serverSourceDir = Join-Path $repoRoot "skymp5-server"

$clientLogsDir = Join-Path $bundleDir "client\logs"
$clientDumpsDir = Join-Path $bundleDir "client\dumps"
$clientDecodedDumpsDir = Join-Path $bundleDir "client\decoded-dumps"
$clientCrashLoggerDir = Join-Path $bundleDir "client\crash-loggers"
$clientConfigDir = Join-Path $bundleDir "client\config"
$serverLogsDir = Join-Path $bundleDir "server\logs"
$serverConfigDir = Join-Path $bundleDir "server\config"
$serverCrashBundlesDir = Join-Path $bundleDir "server\crash-bundles"
$systemDir = Join-Path $bundleDir "system"

Ensure-Directory $clientLogsDir
Ensure-Directory $clientDumpsDir
Ensure-Directory $clientDecodedDumpsDir
Ensure-Directory $clientCrashLoggerDir
Ensure-Directory $clientConfigDir
Ensure-Directory $serverLogsDir
Ensure-Directory $serverConfigDir
Ensure-Directory $serverCrashBundlesDir
Ensure-Directory $systemDir

$copiedClientLogs = @()
$copiedClientDumps = @()
$copiedClientCrashLogs = @()
$copiedServerLogs = @()
$copiedServerConfig = @()
$copiedServerCrashBundles = @()
$copiedClientConfig = @()

if (Test-Path -LiteralPath $skseDir) {
  Get-ChildItem -LiteralPath $skseDir -Filter "*.log" -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    ForEach-Object {
      $copy = Copy-IfExists $_.FullName $clientLogsDir
      if ($copy) { $copiedClientLogs += $copy }
    }

  @(
    "CrashLogger*.log",
    "CrashLogger*.txt",
    "crash-*.log",
    "crash-*.txt"
  ) | ForEach-Object {
    Get-ChildItem -LiteralPath $skseDir -Filter $_ -File -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 10 |
      ForEach-Object {
        $copy = Copy-IfExists $_.FullName $clientCrashLoggerDir
        if ($copy) { $copiedClientCrashLogs += $copy }
      }
  }
}

$trainwreckCrashLogsDir = Join-Path $skseDir "Crashlogs"
if (Test-Path -LiteralPath $trainwreckCrashLogsDir) {
  Get-ChildItem -LiteralPath $trainwreckCrashLogsDir -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 10 |
    ForEach-Object {
      $copy = Copy-IfExists $_.FullName $clientCrashLoggerDir
      if ($copy) { $copiedClientCrashLogs += $copy }
    }
}

if (Test-Path -LiteralPath $clientCrashDir) {
  Get-ChildItem -LiteralPath $clientCrashDir -Filter "*.dmp" -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First $ClientDumpCount |
    ForEach-Object {
      $copy = Copy-IfExists $_.FullName $clientDumpsDir
      if ($copy) { $copiedClientDumps += $copy }
    }
}

$debuggerTools = Safe-Run "debugger tool lookup" {
  [PSCustomObject]@{
    cdb = (Get-Command cdb -ErrorAction SilentlyContinue | Select-Object -First 1 Name,Source)
    dumpchk = (Get-Command dumpchk -ErrorAction SilentlyContinue | Select-Object -First 1 Name,Source)
    windbg = (Get-Command windbg -ErrorAction SilentlyContinue | Select-Object -First 1 Name,Source)
  }
}

$decodedDumpReports = @()
if ($copiedClientDumps.Count -gt 0 -and -not $debuggerTools.__error) {
  $dumpsToDecode = $copiedClientDumps | Select-Object -First ([Math]::Min(2, $copiedClientDumps.Count))

  foreach ($dump in $dumpsToDecode) {
    $outputPath = Join-Path $clientDecodedDumpsDir ("{0}.txt" -f [IO.Path]::GetFileNameWithoutExtension($dump.Name))

    if ($debuggerTools.cdb -and $debuggerTools.cdb.Source) {
      $decoded = Safe-Run "cdb analysis for $($dump.Name)" {
        & $debuggerTools.cdb.Source -z $dump.FullName -c ".ecxr;!analyze -v;k;q" 2>&1 | Out-String
      }

      if (-not $decoded.__error) {
        Set-Content -LiteralPath $outputPath -Value $decoded -Encoding UTF8
        $decodedDumpReports += Get-Item -LiteralPath $outputPath
        continue
      }
    }

    if ($debuggerTools.dumpchk -and $debuggerTools.dumpchk.Source) {
      $decoded = Safe-Run "dumpchk analysis for $($dump.Name)" {
        & $debuggerTools.dumpchk.Source $dump.FullName 2>&1 | Out-String
      }

      if (-not $decoded.__error) {
        Set-Content -LiteralPath $outputPath -Value $decoded -Encoding UTF8
        $decodedDumpReports += Get-Item -LiteralPath $outputPath
      }
    }
  }
}

$clientConfigPaths = @(
  (Join-Path $myGamesDir "Skyrim.ini"),
  (Join-Path $myGamesDir "SkyrimPrefs.ini"),
  (Join-Path $localSkyrimAppDataDir "Plugins.txt"),
  (Join-Path $localSkyrimAppDataDir "LoadOrder.txt")
)

if ($liveGameDir) {
  $clientConfigPaths += @(
    (Join-Path $liveGameDir "Data\SKSE\Plugins\SkyrimPlatform.ini"),
    (Join-Path $liveGameDir "Data\SKSE\Plugins\SSEDisplayTweaks.ini"),
    (Join-Path $liveGameDir "Data\Platform\Plugins\skymp5-client.js"),
    (Join-Path $liveGameDir "Data\Platform\PluginsNoLoad\skymp-chat-debug-state.js"),
    (Join-Path $liveGameDir "Data\Interface\Controls\PC\controlmap.txt")
  )
}

$clientConfigPaths | ForEach-Object {
  $copy = Copy-IfExists $_ $clientConfigDir
  if ($copy) { $copiedClientConfig += $copy }
}

$serverConfigPaths = @(
  (Join-Path $serverBuildDir "server-settings.json"),
  (Join-Path $serverBuildDir "server-settings-dump.json"),
  (Join-Path $serverBuildDir "server-settings-merged.json"),
  (Join-Path $serverBuildDir "skrp-chat-user-settings.json"),
  (Join-Path $serverBuildDir "server-crash.log")
)

$serverConfigPaths | ForEach-Object {
  $copy = Copy-IfExists $_ $serverConfigDir
  if ($copy) { $copiedServerConfig += $copy }
}

$serverLogPaths = @(
  (Join-Path $serverBuildDir "server-crash.log")
)

$serverLogPaths | ForEach-Object {
  $copy = Copy-IfExists $_ $serverLogsDir
  if ($copy) { $copiedServerLogs += $copy }
}

$serverCrashReportsRoot = Join-Path $serverBuildDir "crash-reports"
if (Test-Path -LiteralPath $serverCrashReportsRoot) {
  Get-ChildItem -LiteralPath $serverCrashReportsRoot -Directory -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 5 |
    ForEach-Object {
      $copy = Copy-DirectoryIfExists $_.FullName $serverCrashBundlesDir
      if ($copy) { $copiedServerCrashBundles += $copy }
    }
}

$relevantProcesses = Safe-Run "process snapshot" {
  Get-CimInstance Win32_Process |
    Where-Object {
      $_.Name -match "node|SkyrimSE|skse64_loader" -or
      ($_.CommandLine -and $_.CommandLine -match "skymp|Skyrim")
    } |
    Select-Object ProcessId, Name, ExecutablePath, CommandLine, CreationDate
}

$applicationErrors = Safe-Run "application event log" {
  Get-WinEvent -FilterHashtable @{
    LogName = "Application"
    StartTime = (Get-Date).AddHours(-$HoursBack)
  } -ErrorAction Stop |
    Where-Object {
      $_.LevelDisplayName -eq "Error" -and (
        $_.ProviderName -match "Application Error|Windows Error Reporting" -or
        $_.Message -match "node.exe|SkyrimSE.exe|skse64_loader.exe|scam_native|SkyrimPlatform|skymp5-server"
      )
    } |
    Select-Object -First 50 TimeCreated, ProviderName, Id, LevelDisplayName, Message
}

$gitHead = Safe-Run "git rev-parse" {
  & git -C $repoRoot rev-parse HEAD 2>$null
}

$gitStatus = Safe-Run "git status" {
  & git -C $repoRoot status --short 2>$null
}

$keyFiles = @(
  (Join-Path $repoRoot "skymp5-client\src\services\services\browserService.ts"),
  (Join-Path $repoRoot "skymp5-client\src\services\services\remoteServer.ts"),
  (Join-Path $repoRoot "skymp5-client\src\view\worldView.ts"),
  (Join-Path $repoRoot "skymp5-server\ts\index.ts"),
  (Join-Path $serverBuildDir "dist_back\skymp5-server.js"),
  (Join-Path $serverBuildDir "scam_native.node")
) | ForEach-Object {
  Get-FileMetadata $_
} | Where-Object { $_ -ne $null }

$nodeVersion = Safe-Run "node -v" {
  & node -v 2>$null
}

$summary = [PSCustomObject]@{
  generatedAt = (Get-Date).ToString("o")
  bundleDir = $bundleDir
  repoRoot = $repoRoot
  documentsDir = $documentsDir
  myGamesDir = $myGamesDir
  localSkyrimAppDataDir = $localSkyrimAppDataDir
  liveGameDir = $liveGameDir
  serverBuildDir = $serverBuildDir
  clientSourceDir = $clientSourceDir
  serverSourceDir = $serverSourceDir
  nodeVersion = $nodeVersion
  gitHead = $gitHead
  gitStatus = $gitStatus
  keyFiles = $keyFiles
  copiedClientLogs = $copiedClientLogs | ForEach-Object { Get-FileMetadata $_.FullName }
  copiedClientDumps = $copiedClientDumps | ForEach-Object { Get-FileMetadata $_.FullName }
  copiedClientCrashLogs = $copiedClientCrashLogs | ForEach-Object { Get-FileMetadata $_.FullName }
  decodedDumpReports = $decodedDumpReports | ForEach-Object { Get-FileMetadata $_.FullName }
  copiedClientConfig = $copiedClientConfig | ForEach-Object { Get-FileMetadata $_.FullName }
  copiedServerLogs = $copiedServerLogs | ForEach-Object { Get-FileMetadata $_.FullName }
  copiedServerConfig = $copiedServerConfig | ForEach-Object { Get-FileMetadata $_.FullName }
  copiedServerCrashBundles = $copiedServerCrashBundles | ForEach-Object { Get-FileMetadata $_.FullName }
  debuggerTools = $debuggerTools
  relevantProcesses = $relevantProcesses
  applicationErrors = $applicationErrors
}

$summaryJsonPath = Join-Path $bundleDir "summary.json"
$summaryMdPath = Join-Path $bundleDir "summary.md"
$processesPath = Join-Path $systemDir "processes.json"
$eventsPath = Join-Path $systemDir "application-errors.json"
$gitStatusPath = Join-Path $systemDir "git-status.txt"

$summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $summaryJsonPath -Encoding UTF8
$relevantProcesses | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $processesPath -Encoding UTF8
$applicationErrors | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $eventsPath -Encoding UTF8
Set-Content -LiteralPath $gitStatusPath -Value ($gitStatus | Out-String) -Encoding UTF8

$summaryLines = @(
  "# SkyMP Crash Report Bundle",
  "",
  "Generated: $($summary.generatedAt)",
  "Bundle: $bundleDir",
  "",
  "## Paths",
  "- Repo root: $repoRoot",
  "- Live game dir: $liveGameDir",
  "- My Games dir: $myGamesDir",
  "- Server build dir: $serverBuildDir",
  "",
  "## Quick counts",
  "- Client logs copied: $($copiedClientLogs.Count)",
  "- Client dumps copied: $($copiedClientDumps.Count)",
  "- Client crash logger files copied: $($copiedClientCrashLogs.Count)",
  "- Decoded dump reports: $($decodedDumpReports.Count)",
  "- Client config files copied: $($copiedClientConfig.Count)",
  "- Server logs copied: $($copiedServerLogs.Count)",
  "- Server config files copied: $($copiedServerConfig.Count)",
  "- Server crash bundle folders copied: $($copiedServerCrashBundles.Count)",
  "",
  "## Debugger tools",
  "- cdb: $(if ($debuggerTools.cdb) { $debuggerTools.cdb.Source } else { 'not found' })",
  "- dumpchk: $(if ($debuggerTools.dumpchk) { $debuggerTools.dumpchk.Source } else { 'not found' })",
  "- windbg: $(if ($debuggerTools.windbg) { $debuggerTools.windbg.Source } else { 'not found' })",
  "",
  "## Key files"
)
$summaryLines += $keyFiles | ForEach-Object {
  "- $($_.path) | last write: $($_.lastWriteTime) | length: $($_.length)"
}
$summaryLines += @(
  "",
  "## Running relevant processes"
)
$summaryLines += $relevantProcesses | ForEach-Object {
  if ($_.__error) {
    "- $($_.__error)"
  } else {
    "- PID $($_.ProcessId) | $($_.Name) | $($_.CommandLine)"
  }
}
$summaryLines += @(
  "",
  "## Recent application errors"
)
$summaryLines += $applicationErrors | ForEach-Object {
  if ($_.__error) {
    "- $($_.__error)"
  } else {
    "- $($_.TimeCreated): [$($_.ProviderName)] $($_.Message -replace '`r?`n', ' ')"
  }
}

Write-TextFile $summaryMdPath $summaryLines

$zipPath = "$bundleDir.zip"
if (-not $NoZip) {
  Compress-Archive -Path (Join-Path $bundleDir "*") -DestinationPath $zipPath -Force
}

Write-Host "Crash report bundle created:"
Write-Host "  $bundleDir"
if (-not $NoZip) {
  Write-Host "Archive:"
  Write-Host "  $zipPath"
}
