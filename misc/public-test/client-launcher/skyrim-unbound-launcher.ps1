param(
    [string]$GameRoot = "",
    [string]$LauncherBaseUrl = "",
    [switch]$UpdateOnly,
    [switch]$NoLaunch,
    [switch]$Force,
    [switch]$Diagnostics,
    [switch]$WaitForExit,
    [switch]$AllowInsecureHttp,
    [string]$DiagnosticReportRoot = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:LauncherLogPath = $null
$script:DiagnosticsTimestamp = $null

function Write-Step {
    param([string]$Message)
    $line = "[Skyrim Unbound Launcher] $Message"
    Write-Host $line
    if ($script:LauncherLogPath) {
        Add-Content -LiteralPath $script:LauncherLogPath -Value $line -Encoding UTF8
    }
}

function Ensure-Directory {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Read-JsonFile {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return $null
    }

    return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function ConvertTo-JsonObject {
    param([Parameter(ValueFromPipeline = $true)]$InputObject)

    if ($InputObject -is [System.Array]) {
        $InputObject = ($InputObject -join "")
    }

    if ($InputObject -is [string]) {
        $normalized = $InputObject.TrimStart([char]0xFEFF).Trim()
        return (ConvertFrom-Json -InputObject $normalized)
    }

    return $InputObject
}

function Write-Utf8NoBomFile {
    param(
        [string]$Path,
        [string]$Content
    )

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Get-ForwardRelativePath {
    param(
        [string]$Root,
        [string]$Path
    )

    $rootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd("\")
    $pathFull = [System.IO.Path]::GetFullPath($Path)
    if (-not $pathFull.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Path '$pathFull' is not under root '$rootFull'"
    }
    $relative = $pathFull.Substring($rootFull.Length).TrimStart("\")
    return $relative.Replace("\", "/")
}

function Get-LocalHash {
    param([string]$Path)

    return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

function Get-EncodedRelativeUrl {
    param([string]$RelativePath)

    $segments = $RelativePath -split "/"
    return (($segments | ForEach-Object { [System.Uri]::EscapeDataString($_) }) -join "/")
}

function Assert-SafeLauncherUrl {
    param(
        [string]$Url,
        [switch]$AllowInsecureHttp
    )

    [System.Uri]$parsed = $null
    if (-not [System.Uri]::TryCreate($Url, [System.UriKind]::Absolute, [ref]$parsed)) {
        throw "Launcher base URL is invalid: $Url"
    }

    if ($parsed.Scheme -eq "https") {
        return
    }

    $isLocalHttp = $parsed.Scheme -eq "http" -and @("localhost", "127.0.0.1", "::1") -contains $parsed.Host.ToLowerInvariant()
    if ($isLocalHttp -or $AllowInsecureHttp.IsPresent) {
        Write-Step "WARNING: launcher manifest is using insecure HTTP. Use HTTPS for public distribution."
        return
    }

    throw "Launcher base URL must use HTTPS for public distribution. Pass -AllowInsecureHttp only for trusted local testing."
}

function Resolve-ManagedFilePath {
    param(
        [string]$Root,
        [string]$RelativePath
    )

    if ([string]::IsNullOrWhiteSpace($RelativePath)) {
        throw "Manifest contains an empty file path."
    }

    $normalizedRelativePath = $RelativePath.Replace("\", "/").Trim()
    if ($normalizedRelativePath.StartsWith("/") -or $normalizedRelativePath -match "^[A-Za-z]:") {
        throw "Manifest path must be relative: $RelativePath"
    }

    $segments = $normalizedRelativePath -split "/"
    if ($segments | Where-Object { $_ -eq "" -or $_ -eq "." -or $_ -eq ".." }) {
        throw "Manifest path contains unsafe path segments: $RelativePath"
    }

    $rootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd("\")
    $candidate = [System.IO.Path]::GetFullPath((Join-Path $rootFull ($normalizedRelativePath.Replace("/", "\"))))
    $rootPrefix = $rootFull + "\"
    if (-not $candidate.Equals($rootFull, [System.StringComparison]::OrdinalIgnoreCase) -and
        -not $candidate.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Manifest path escapes the game root: $RelativePath"
    }

    return $candidate
}

function Get-DefaultDiagnosticReportRoot {
    return (Join-Path ([Environment]::GetFolderPath("LocalApplicationData")) "Skyrim Unbound\Diagnostics")
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
        sha256 = if ($item.PSIsContainer) { $null } else { (Get-FileHash -Algorithm SHA256 -LiteralPath $item.FullName).Hash.ToLowerInvariant() }
    }
}

function Copy-IfExists {
    param(
        [string]$Source,
        [string]$DestinationDirectory
    )

    if (-not (Test-Path -LiteralPath $Source)) {
        return $null
    }

    Ensure-Directory -Path $DestinationDirectory
    Copy-Item -LiteralPath $Source -Destination (Join-Path $DestinationDirectory (Split-Path -Leaf $Source)) -Force
    return Get-Item -LiteralPath $Source
}

function Copy-DirectoryIfExists {
    param(
        [string]$Source,
        [string]$DestinationDirectory
    )

    if (-not (Test-Path -LiteralPath $Source)) {
        return $null
    }

    Ensure-Directory -Path $DestinationDirectory
    $target = Join-Path $DestinationDirectory (Split-Path -Leaf $Source)
    if (Test-Path -LiteralPath $target) {
        Remove-Item -LiteralPath $target -Recurse -Force
    }
    Copy-Item -LiteralPath $Source -Destination $target -Recurse -Force
    return Get-Item -LiteralPath $Source
}

function Write-LauncherDiagnosticsBundle {
    param(
        [string]$ReportRoot,
        [string]$ResolvedGameRoot,
        [string]$ResolvedLauncherBaseUrl,
        $Manifest,
        $State,
        [string]$RemoteHash,
        [string]$InstalledHash,
        [int]$LauncherProcessId,
        [int]$LauncherExitCode,
        [int]$GameExitCode,
        [string]$ScriptDirectory,
        [string]$LauncherLogPath
    )

    $timestamp = if ($script:DiagnosticsTimestamp) { $script:DiagnosticsTimestamp } else { Get-Date -Format "yyyyMMdd-HHmmss" }
    $bundleDir = Join-Path $ReportRoot "skyrim-unbound-launcher-diagnostics-$timestamp"
    $logsDir = Join-Path $bundleDir "logs"
    $configDir = Join-Path $bundleDir "config"
    $systemDir = Join-Path $bundleDir "system"
    Ensure-Directory -Path $logsDir
    Ensure-Directory -Path $configDir
    Ensure-Directory -Path $systemDir

    $documentsDir = [Environment]::GetFolderPath("MyDocuments")
    $myGamesDir = Join-Path $documentsDir "My Games\Skyrim Special Edition"
    $skseDir = Join-Path $myGamesDir "SKSE"
    $crashDumpDir = Join-Path $skseDir "Crashdumps"
    $localAppData = [Environment]::GetFolderPath("LocalApplicationData")
    $localSkyrimAppDataDir = Join-Path $localAppData "Skyrim Special Edition"

    $copiedLogs = @()
    $copiedConfig = @()
    $copiedCrashDumps = @()

    if (Test-Path -LiteralPath $skseDir) {
        Get-ChildItem -LiteralPath $skseDir -Filter "*.log" -File -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending |
            ForEach-Object {
                $copy = Copy-IfExists $_.FullName $logsDir
                if ($copy) { $copiedLogs += $copy }
            }

        @("CrashLogger*.log", "CrashLogger*.txt", "crash-*.log", "crash-*.txt") | ForEach-Object {
            Get-ChildItem -LiteralPath $skseDir -Filter $_ -File -ErrorAction SilentlyContinue |
                Sort-Object LastWriteTime -Descending |
                Select-Object -First 10 |
                ForEach-Object {
                    $copy = Copy-IfExists $_.FullName $logsDir
                    if ($copy) { $copiedLogs += $copy }
                }
        }
    }

    if (Test-Path -LiteralPath $crashDumpDir) {
        Get-ChildItem -LiteralPath $crashDumpDir -Filter "*.dmp" -File -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 10 |
            ForEach-Object {
                $copy = Copy-IfExists $_.FullName $logsDir
                if ($copy) { $copiedCrashDumps += $copy }
            }
    }

    @(
        (Join-Path $myGamesDir "Skyrim.ini"),
        (Join-Path $myGamesDir "SkyrimPrefs.ini"),
        (Join-Path $localSkyrimAppDataDir "Plugins.txt"),
        (Join-Path $localSkyrimAppDataDir "LoadOrder.txt"),
        (Join-Path $ResolvedGameRoot "Data\SKSE\Plugins\SkyrimPlatform.ini"),
        (Join-Path $ResolvedGameRoot "Data\Platform\Plugins\skymp5-client-settings.txt"),
        (Join-Path $ResolvedGameRoot "Data\Platform\Plugins\skymp5-client.js"),
        (Join-Path $ResolvedGameRoot "Data\SKSE\Plugins\SkyrimPlatform.dll"),
        (Join-Path $ResolvedGameRoot "Data\SKSE\Plugins\SkyrimPlatformImpl.dll"),
        (Join-Path $ResolvedGameRoot "Data\SKSE\Plugins\MpClientPlugin.dll")
    ) | ForEach-Object {
        $copy = Copy-IfExists $_ $configDir
        if ($copy) { $copiedConfig += $copy }
    }

    @(
        (Join-Path $ScriptDirectory "skyrim-unbound-launcher.ps1"),
        (Join-Path $ScriptDirectory "skyrim-unbound-launcher.cmd"),
        (Join-Path $ScriptDirectory "skyrim-unbound-diagnostics.ps1"),
        (Join-Path $ScriptDirectory "skyrim-unbound-diagnostics.cmd"),
        (Join-Path $ScriptDirectory "skyrim-unbound-launcher-config.json"),
        (Join-Path $ScriptDirectory "skyrim-unbound-launcher-state.json")
    ) | ForEach-Object {
        $copy = Copy-IfExists $_ $configDir
        if ($copy) { $copiedConfig += $copy }
    }

    if ($LauncherLogPath -and (Test-Path -LiteralPath $LauncherLogPath)) {
        Copy-Item -LiteralPath $LauncherLogPath -Destination (Join-Path $logsDir (Split-Path -Leaf $LauncherLogPath)) -Force
    }

    $launcherConfig = Read-JsonFile -Path (Join-Path $ScriptDirectory "skyrim-unbound-launcher-config.json")
    $launcherState = Read-JsonFile -Path (Join-Path $ScriptDirectory "skyrim-unbound-launcher-state.json")

    $processSnapshot = @()
    try {
        $processSnapshot = Get-CimInstance Win32_Process |
            Where-Object {
                $_.Name -match "SkyrimSE|skse64_loader|node" -or
                ($_.CommandLine -and $_.CommandLine -match "Skyrim|skymp")
            } |
            Select-Object ProcessId, Name, ExecutablePath, CommandLine, CreationDate
    } catch {
        $processSnapshot = @()
    }

    $applicationErrors = @()
    try {
        $applicationErrors = Get-WinEvent -FilterHashtable @{
            LogName = "Application"
            StartTime = (Get-Date).AddHours(-12)
        } -ErrorAction Stop |
            Where-Object {
                $_.LevelDisplayName -eq "Error" -and (
                    $_.ProviderName -match "Application Error|Windows Error Reporting" -or
                    $_.Message -match "node.exe|SkyrimSE.exe|skse64_loader.exe|SkyrimPlatform|skymp5-server"
                )
            } |
            Select-Object -First 50 TimeCreated, ProviderName, Id, LevelDisplayName, Message
    } catch {
        $applicationErrors = @()
    }

    $summary = [PSCustomObject]@{
        generatedAt = (Get-Date).ToString("o")
        launcherExitCode = $LauncherExitCode
        gameExitCode = $GameExitCode
        launcherProcessId = $LauncherProcessId
        gameRoot = $ResolvedGameRoot
        launcherBaseUrl = $ResolvedLauncherBaseUrl
        manifestVersion = if ($Manifest -and $Manifest.PSObject.Properties.Name -contains "version") { [string]$Manifest.version } else { $null }
        remotePackageSha256 = $RemoteHash
        installedPackageSha256 = $InstalledHash
        launcherConfig = $launcherConfig
        launcherState = $launcherState
        keyFiles = @(
            Get-FileMetadata (Join-Path $ResolvedGameRoot "Data\SKSE\Plugins\SkyrimPlatform.ini"),
            Get-FileMetadata (Join-Path $ResolvedGameRoot "Data\Platform\Plugins\skymp5-client-settings.txt"),
            Get-FileMetadata (Join-Path $ResolvedGameRoot "Data\Platform\Plugins\skymp5-client.js"),
            Get-FileMetadata (Join-Path $ResolvedGameRoot "Data\SKSE\Plugins\SkyrimPlatform.dll"),
            Get-FileMetadata (Join-Path $ResolvedGameRoot "Data\SKSE\Plugins\SkyrimPlatformImpl.dll"),
            Get-FileMetadata (Join-Path $ResolvedGameRoot "Data\SKSE\Plugins\MpClientPlugin.dll"),
            Get-FileMetadata $LauncherLogPath
        ) | Where-Object { $_ -ne $null }
        copiedLogs = @($copiedLogs | ForEach-Object { Get-FileMetadata $_.FullName } | Where-Object { $_ -ne $null })
        copiedCrashDumps = @($copiedCrashDumps | ForEach-Object { Get-FileMetadata $_.FullName } | Where-Object { $_ -ne $null })
        copiedConfig = @($copiedConfig | ForEach-Object { Get-FileMetadata $_.FullName } | Where-Object { $_ -ne $null })
        processSnapshot = $processSnapshot
        applicationErrors = $applicationErrors
    }

    $summaryJsonPath = Join-Path $bundleDir "summary.json"
    $summaryMdPath = Join-Path $bundleDir "summary.md"
    $summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $summaryJsonPath -Encoding UTF8

    $summaryLines = @(
        "# Skyrim Unbound Launcher Diagnostics",
        "",
        "Generated: $($summary.generatedAt)",
        "Launcher exit code: $LauncherExitCode",
        "Game exit code: $GameExitCode",
        "Game root: $ResolvedGameRoot",
        "Launcher base URL: $ResolvedLauncherBaseUrl",
        "Manifest version: $($summary.manifestVersion)",
        "Remote package hash: $RemoteHash",
        "Installed package hash: $InstalledHash",
        "",
        "## Key Files"
    )

    foreach ($file in $summary.keyFiles) {
        if ($null -eq $file) { continue }
        $summaryLines += "- $($file.path) | $($file.sha256)"
    }

    $summaryLines += @(
        "",
        "## Copied Logs",
        $(if ($summary.copiedLogs.Count -gt 0) { "" } else { "- none" })
    )

    foreach ($file in $summary.copiedLogs) {
        if ($null -eq $file) { continue }
        $summaryLines += "- $($file.path)"
    }

    $summaryLines += @(
        "",
        "## Copied Crash Dumps",
        $(if ($summary.copiedCrashDumps.Count -gt 0) { "" } else { "- none" })
    )

    foreach ($file in $summary.copiedCrashDumps) {
        if ($null -eq $file) { continue }
        $summaryLines += "- $($file.path)"
    }

    $summaryLines += @(
        "",
        "## Application Errors",
        $(if ($applicationErrors.Count -gt 0) { "" } else { "- none" })
    )

    foreach ($errorEntry in $applicationErrors) {
        $summaryLines += "- $($errorEntry.TimeCreated) | $($errorEntry.ProviderName) | $($errorEntry.Message)"
    }

    Set-Content -LiteralPath $summaryMdPath -Value $summaryLines -Encoding UTF8

    $zipPath = "$bundleDir.zip"
    if (Test-Path -LiteralPath $zipPath) {
        Remove-Item -LiteralPath $zipPath -Force
    }
    Compress-Archive -Path (Join-Path $bundleDir "*") -DestinationPath $zipPath -Force

    return $zipPath
}

function Get-UiPort {
    param([int]$Port)
    if ($Port -eq 7777) { return 3000 }
    return ($Port + 1)
}

function Resolve-GameRoot {
    param(
        [string]$RequestedGameRoot,
        [string]$ScriptDirectory,
        $Config
    )

    if (-not [string]::IsNullOrWhiteSpace($RequestedGameRoot)) {
        return [System.IO.Path]::GetFullPath($RequestedGameRoot)
    }

    if ($null -ne $Config -and -not [string]::IsNullOrWhiteSpace([string]$Config.gameRoot)) {
        return [System.IO.Path]::GetFullPath([string]$Config.gameRoot)
    }

    if (Test-Path -LiteralPath (Join-Path $ScriptDirectory "SkyrimSE.exe")) {
        return $ScriptDirectory
    }

    $parent = Split-Path -Parent $ScriptDirectory
    if (-not [string]::IsNullOrWhiteSpace($parent) -and (Test-Path -LiteralPath (Join-Path $parent "SkyrimSE.exe"))) {
        return $parent
    }

    throw "Unable to find SkyrimSE.exe. Put this launcher next to SkyrimSE.exe or set gameRoot in skyrim-unbound-launcher-config.json."
}

function Resolve-LauncherBaseUrl {
    param(
        [string]$RequestedBaseUrl,
        [string]$GameRootPath,
        $Config
    )

    if (-not [string]::IsNullOrWhiteSpace($RequestedBaseUrl)) {
        return $RequestedBaseUrl.TrimEnd("/")
    }

    if ($null -ne $Config -and -not [string]::IsNullOrWhiteSpace([string]$Config.launcherBaseUrl)) {
        return ([string]$Config.launcherBaseUrl).TrimEnd("/")
    }

    $clientSettingsPath = Join-Path $GameRootPath "Data\Platform\Plugins\skymp5-client-settings.txt"
    if (Test-Path -LiteralPath $clientSettingsPath) {
        $clientSettings = Get-Content -LiteralPath $clientSettingsPath -Raw | ConvertFrom-Json
        $serverIp = [string]$clientSettings."server-ip"
        $serverPort = [int]$clientSettings."server-port"
        $uiPort = Get-UiPort -Port $serverPort
        if (-not [string]::IsNullOrWhiteSpace($serverIp)) {
            return "http://$serverIp`:$uiPort/launcher"
        }
    }

    throw "Unable to resolve launcherBaseUrl. Put skyrim-unbound-launcher-config.json next to this launcher or pass -LauncherBaseUrl."
}

$scriptDirectory = Split-Path -Parent $PSCommandPath
$configPath = Join-Path $scriptDirectory "skyrim-unbound-launcher-config.json"
$statePath = Join-Path $scriptDirectory "skyrim-unbound-launcher-state.json"
$config = Read-JsonFile -Path $configPath
$state = Read-JsonFile -Path $statePath

$resolvedGameRoot = Resolve-GameRoot -RequestedGameRoot $GameRoot -ScriptDirectory $scriptDirectory -Config $config
$resolvedLauncherBaseUrl = Resolve-LauncherBaseUrl -RequestedBaseUrl $LauncherBaseUrl -GameRootPath $resolvedGameRoot -Config $config
Assert-SafeLauncherUrl -Url $resolvedLauncherBaseUrl -AllowInsecureHttp:$AllowInsecureHttp
$manifestUrl = "$resolvedLauncherBaseUrl/manifest.json"
$gameRootHashBytes = [System.Security.Cryptography.MD5]::Create().ComputeHash([System.Text.Encoding]::UTF8.GetBytes($resolvedGameRoot.ToLowerInvariant()))
$gameRootHash = ([System.BitConverter]::ToString($gameRootHashBytes)).Replace("-", "").ToLowerInvariant()
$tempRoot = Join-Path $env:TEMP ("skyrim-unbound-launcher-" + $gameRootHash)
$packagePath = Join-Path $tempRoot "client-package.zip"
$extractRoot = Join-Path $tempRoot "extract"
$installedHash = if ($null -ne $state) { [string]$state.installedPackageSha256 } else { "" }
$diagnosticsEnabled = $Diagnostics.IsPresent -or -not [string]::IsNullOrWhiteSpace($DiagnosticReportRoot)
if ($diagnosticsEnabled) {
    if ([string]::IsNullOrWhiteSpace($DiagnosticReportRoot)) {
        $DiagnosticReportRoot = Get-DefaultDiagnosticReportRoot
    }
    Ensure-Directory -Path $DiagnosticReportRoot
    $script:DiagnosticsTimestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $script:LauncherLogPath = Join-Path $DiagnosticReportRoot ("launcher-" + $script:DiagnosticsTimestamp + ".log")
    Write-Utf8NoBomFile -Path $script:LauncherLogPath -Content ""
}

Ensure-Directory -Path $tempRoot

Write-Step "Game root: $resolvedGameRoot"
Write-Step "Launcher base URL: $resolvedLauncherBaseUrl"
Write-Step "Checking package manifest..."

$manifest = ConvertTo-JsonObject (Invoke-RestMethod -Uri $manifestUrl -Method Get)
$remoteHash = [string]$manifest.packageSha256
$remotePackageUrl = "$resolvedLauncherBaseUrl/$($manifest.packageFileName)"
$fileManifestUrl = if ($manifest.PSObject.Properties.Name -contains "fileManifestFileName") {
    "$resolvedLauncherBaseUrl/$([string]$manifest.fileManifestFileName)"
} else {
    "$resolvedLauncherBaseUrl/file-manifest.json"
}
$usedIncremental = $false
$remoteFiles = @()
$hasManagedState = ($null -ne $state) -and ($state.PSObject.Properties.Name -contains "managedFiles") -and (@($state.managedFiles).Count -gt 0)

try {
    $bootstrapFileManifest = ConvertTo-JsonObject (Invoke-RestMethod -Uri $fileManifestUrl -Method Get)
    if ($null -ne $bootstrapFileManifest -and $bootstrapFileManifest.PSObject.Properties.Name -contains "files") {
        $remoteFiles = @($bootstrapFileManifest.files)
    }
} catch {
}

if ($hasManagedState -or $Force.IsPresent) {
try {
    if ($remoteFiles.Count -eq 0) {
        $fileManifest = ConvertTo-JsonObject (Invoke-RestMethod -Uri $fileManifestUrl -Method Get)
        $remoteFiles = @($fileManifest.files)
    } else {
        $fileManifest = $bootstrapFileManifest
    }
    if ($remoteFiles.Count -gt 0) {
        $usedIncremental = $true
        $managedFiles = if ($null -ne $state -and $state.PSObject.Properties.Name -contains "managedFiles") { @($state.managedFiles) } else { @() }
        $remotePaths = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
        $filesToDownload = New-Object System.Collections.Generic.List[object]

        Write-Step "Checking local files against remote manifest..."
        foreach ($file in $remoteFiles) {
            $relativePath = [string]$file.path
            $remotePaths.Add($relativePath) | Out-Null
            $targetPath = Resolve-ManagedFilePath -Root $resolvedGameRoot -RelativePath $relativePath
            $needsFile = $Force.IsPresent -or (-not (Test-Path -LiteralPath $targetPath))

            if (-not $needsFile) {
                $targetItem = Get-Item -LiteralPath $targetPath
                $expectedSize = [long]$file.size
                if ($targetItem.Length -ne $expectedSize) {
                    $needsFile = $true
                } else {
                    $localHash = Get-LocalHash -Path $targetPath
                    if ($localHash -ne ([string]$file.sha256).ToLowerInvariant()) {
                        $needsFile = $true
                    }
                }
            }

            if ($needsFile) {
                $filesToDownload.Add($file) | Out-Null
            }
        }

        $staleFiles = @()
        foreach ($managedFile in $managedFiles) {
            $managedRelativePath = [string]$managedFile
            if (-not $remotePaths.Contains($managedRelativePath)) {
                $staleFiles += $managedRelativePath
            }
        }

        if ($staleFiles.Count -gt 0) {
            Write-Step "Removing $($staleFiles.Count) stale files..."
            foreach ($staleFile in $staleFiles) {
                $stalePath = Resolve-ManagedFilePath -Root $resolvedGameRoot -RelativePath $staleFile
                if (Test-Path -LiteralPath $stalePath) {
                    Remove-Item -LiteralPath $stalePath -Force
                }
            }
        }

        if ($filesToDownload.Count -gt 0) {
            Write-Step "Downloading $($filesToDownload.Count) changed files..."
            foreach ($file in $filesToDownload) {
                $relativePath = [string]$file.path
                $targetPath = Resolve-ManagedFilePath -Root $resolvedGameRoot -RelativePath $relativePath
                $targetDir = Split-Path -Parent $targetPath
                Ensure-Directory -Path $targetDir

                $encodedRelativeUrl = Get-EncodedRelativeUrl -RelativePath $relativePath
                $sourceUrl = "$($fileManifest.fileBaseUrl.TrimEnd('/'))/$encodedRelativeUrl"
                Invoke-WebRequest -Uri $sourceUrl -OutFile $targetPath

                $downloadedHash = Get-LocalHash -Path $targetPath
                if ($downloadedHash -ne ([string]$file.sha256).ToLowerInvariant()) {
                    throw "Hash mismatch for $relativePath"
                }
            }
        } else {
            Write-Step "All managed files are already up to date."
        }

        $newState = [ordered]@{
            displayName = if ($manifest.PSObject.Properties.Name -contains "name") { [string]$manifest.name } else { "Skyrim Unbound" }
            launcherBaseUrl = $resolvedLauncherBaseUrl
            gameRoot = $resolvedGameRoot
            installedVersion = [string]$manifest.version
            installedPackageSha256 = $remoteHash
            installedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
            managedFiles = @($remoteFiles | ForEach-Object { [string]$_.path })
        }
        Write-Utf8NoBomFile -Path $statePath -Content ($newState | ConvertTo-Json -Depth 6)

        $updatedConfig = [ordered]@{
            displayName = if ($manifest.PSObject.Properties.Name -contains "name") { [string]$manifest.name } else { "Skyrim Unbound" }
            launcherBaseUrl = $resolvedLauncherBaseUrl
            manifestUrl = $manifestUrl
            gameRoot = $resolvedGameRoot
        }
        Write-Utf8NoBomFile -Path $configPath -Content ($updatedConfig | ConvertTo-Json -Depth 4)
        Write-Step "Installed incremental update version $($manifest.version)"
    }
} catch {
    Write-Step "Incremental update path failed or is unavailable. Falling back to full package sync."
    $usedIncremental = $false
}
}

$needsUpdate = $Force.IsPresent -or [string]::IsNullOrWhiteSpace($installedHash) -or ($installedHash -ne $remoteHash)

if (-not $usedIncremental -and $needsUpdate) {
    Write-Step "Downloading package $($manifest.packageFileName)..."
    if (Test-Path -LiteralPath $packagePath) {
        Remove-Item -LiteralPath $packagePath -Force
    }
    Invoke-WebRequest -Uri $remotePackageUrl -OutFile $packagePath

    $downloadedHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $packagePath).Hash.ToLowerInvariant()
    if ($downloadedHash -ne $remoteHash.ToLowerInvariant()) {
        throw "Downloaded package hash mismatch. Expected $remoteHash but got $downloadedHash"
    }

    if (Test-Path -LiteralPath $extractRoot) {
        Remove-Item -LiteralPath $extractRoot -Recurse -Force
    }
    Ensure-Directory -Path $extractRoot

    Write-Step "Installing update..."
    Expand-Archive -LiteralPath $packagePath -DestinationPath $extractRoot -Force
    & robocopy $extractRoot $resolvedGameRoot /E /R:2 /W:1 /NFL /NDL /NJH /NJS /NC /NS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) {
        throw "robocopy failed with exit code $LASTEXITCODE"
    }

    $newState = [ordered]@{
        displayName = if ($manifest.PSObject.Properties.Name -contains "name") { [string]$manifest.name } else { "Skyrim Unbound" }
        launcherBaseUrl = $resolvedLauncherBaseUrl
        gameRoot = $resolvedGameRoot
        installedVersion = [string]$manifest.version
        installedPackageSha256 = $downloadedHash
        installedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
        managedFiles = @($remoteFiles | ForEach-Object { [string]$_.path })
    }
    Write-Utf8NoBomFile -Path $statePath -Content ($newState | ConvertTo-Json -Depth 6)

    if ($null -eq $config) {
        $config = [pscustomobject]@{}
    }
    $updatedConfig = [ordered]@{
        displayName = if ($manifest.PSObject.Properties.Name -contains "name") { [string]$manifest.name } else { "Skyrim Unbound" }
        launcherBaseUrl = $resolvedLauncherBaseUrl
        manifestUrl = $manifestUrl
        gameRoot = $resolvedGameRoot
    }
    Write-Utf8NoBomFile -Path $configPath -Content ($updatedConfig | ConvertTo-Json -Depth 4)

    Write-Step "Installed package version $($manifest.version)"
} elseif (-not $usedIncremental) {
    Write-Step "Already up to date."
}

if ($UpdateOnly.IsPresent -or $NoLaunch.IsPresent) {
    Write-Step "Update step finished."
    exit 0
}

$launcherExe = Join-Path $resolvedGameRoot "skse64_loader.exe"
if (-not (Test-Path -LiteralPath $launcherExe)) {
    throw "skse64_loader.exe was not found in $resolvedGameRoot"
}

Write-Step "Launching Skyrim through SKSE..."
$launcherProcess = Start-Process -FilePath $launcherExe -WorkingDirectory $resolvedGameRoot -PassThru
Write-Step "SKSE loader process id: $($launcherProcess.Id)"

$gameExitCode = $null
$launcherExitCode = $null

if ($diagnosticsEnabled -or $WaitForExit.IsPresent) {
    Write-Step "Waiting for SkyrimSE.exe to appear..."
    $gameProcess = $null
    $deadline = (Get-Date).AddSeconds(120)
    while ((Get-Date) -lt $deadline) {
        $gameProcess = Get-Process -Name "SkyrimSE" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($gameProcess) {
            break
        }
        if ($launcherProcess.HasExited -and -not (Get-Process -Id $launcherProcess.Id -ErrorAction SilentlyContinue)) {
            Start-Sleep -Milliseconds 500
        } else {
            Start-Sleep -Milliseconds 500
        }
    }

    if ($gameProcess) {
        Write-Step "SkyrimSE.exe detected with process id $($gameProcess.Id); waiting for exit..."
        try {
            $gameProcess.WaitForExit()
            $gameExitCode = $gameProcess.ExitCode
            Write-Step "SkyrimSE.exe exited with code $gameExitCode"
        } catch {
            Write-Step "Failed while waiting for SkyrimSE.exe: $($_.Exception.Message)"
        }
    } else {
        Write-Step "SkyrimSE.exe did not appear within the timeout window."
    }

    try {
        if ($launcherProcess) {
            $launcherProcess.WaitForExit()
            $launcherExitCode = $launcherProcess.ExitCode
            Write-Step "SKSE loader exited with code $launcherExitCode"
        }
    } catch {
        Write-Step "Failed while waiting for SKSE loader exit: $($_.Exception.Message)"
    }
}

if ($diagnosticsEnabled) {
    $zipPath = Write-LauncherDiagnosticsBundle `
        -ReportRoot $DiagnosticReportRoot `
        -ResolvedGameRoot $resolvedGameRoot `
        -ResolvedLauncherBaseUrl $resolvedLauncherBaseUrl `
        -Manifest $manifest `
        -State $state `
        -RemoteHash $remoteHash `
        -InstalledHash $installedHash `
        -LauncherProcessId $launcherProcess.Id `
        -LauncherExitCode ($(if ($null -ne $launcherExitCode) { [int]$launcherExitCode } else { 0 })) `
        -GameExitCode ($(if ($null -ne $gameExitCode) { [int]$gameExitCode } else { 0 })) `
        -ScriptDirectory $scriptDirectory `
        -LauncherLogPath $script:LauncherLogPath
    Write-Step "Diagnostic bundle written to $zipPath"
}

if ($WaitForExit.IsPresent) {
    if ($null -ne $gameExitCode) {
        exit ([int]$gameExitCode)
    }
    if ($null -ne $launcherExitCode) {
        exit ([int]$launcherExitCode)
    }
    exit 0
}
