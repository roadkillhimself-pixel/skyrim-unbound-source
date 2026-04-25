param(
    [string]$GameRoot = "",
    [string]$ServerDataDir = "",
    [string]$ServerName = "Skyrim Unbound",
    [string]$PackageFileName = "skyrim-unbound-client-package.zip"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "[publish-client-package] $Message"
}

function Get-UiPort {
    param([int]$Port)
    if ($Port -eq 7777) { return 3000 }
    return ($Port + 1)
}

function Ensure-Directory {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Should-SkipFile {
    param([string]$Path)

    $normalized = $Path.Replace("/", "\").ToLowerInvariant()
    $fileName = [System.IO.Path]::GetFileName($normalized)
    $extension = [System.IO.Path]::GetExtension($normalized)

    if ($extension -in @(".log", ".pdb", ".mdmp", ".dmp", ".tmp")) {
        return $true
    }

    if ($fileName -like "*.bak*" -or $fileName -like "*.disabled_codex" -or $fileName -eq "skymp-chat-debug-state.js") {
        return $true
    }

    if ($fileName -like "*_english_russian.json") {
        return $true
    }

    if ($normalized.Contains("\data\platform\logs\")) {
        return $true
    }

    return $false
}

function Copy-FilteredTree {
    param(
        [string]$Source,
        [string]$Destination
    )

    if (-not (Test-Path -LiteralPath $Source)) {
        throw "Source path not found: $Source"
    }

    Ensure-Directory -Path $Destination

    $sourceItem = Get-Item -LiteralPath $Source
    if (-not $sourceItem.PSIsContainer) {
        if (-not (Should-SkipFile -Path $sourceItem.FullName)) {
            Copy-Item -LiteralPath $sourceItem.FullName -Destination $Destination -Force
        }
        return
    }

    $sourcePrefix = $sourceItem.FullName.TrimEnd("\")

    Get-ChildItem -LiteralPath $Source -Recurse -Force | ForEach-Object {
        $relativePath = $_.FullName.Substring($sourcePrefix.Length).TrimStart("\")
        $targetPath = Join-Path $Destination $relativePath

        if ($_.PSIsContainer) {
            Ensure-Directory -Path $targetPath
            return
        }

        if (Should-SkipFile -Path $_.FullName) {
            return
        }

        $targetDir = Split-Path -Parent $targetPath
        Ensure-Directory -Path $targetDir
        Copy-Item -LiteralPath $_.FullName -Destination $targetPath -Force
    }
}

function Get-JsonFile {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "File not found: $Path"
    }

    return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Write-Utf8NoBomFile {
    param(
        [string]$Path,
        [string]$Content
    )

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Get-RelativeForwardPath {
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

if ([string]::IsNullOrWhiteSpace($GameRoot)) {
    $programFilesX86 = ${env:ProgramFiles(x86)}
    if ([string]::IsNullOrWhiteSpace($programFilesX86)) {
        $programFilesX86 = $env:ProgramFiles
    }

    $GameRoot = Join-Path $programFilesX86 "Steam\steamapps\common\Skyrim Special Edition"
}

if ([string]::IsNullOrWhiteSpace($ServerDataDir)) {
    $ServerDataDir = Join-Path $PSScriptRoot "..\..\build\dist\server\data"
}

$GameRoot = [System.IO.Path]::GetFullPath($GameRoot)
$BuildClientDistDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\build\dist\client"))
$ServerDataDir = [System.IO.Path]::GetFullPath($ServerDataDir)
$LauncherOutputDir = Join-Path $ServerDataDir "launcher"
$TemplateDir = Join-Path $PSScriptRoot "client-launcher"
$ClientAssetsDir = Join-Path $PSScriptRoot "client-assets"
$ClientSettingsPath = Join-Path $PSScriptRoot "skyrim-unbound-public-test.client-settings.json"
$ServerSettingsPath = Join-Path $PSScriptRoot "..\..\build\dist\server\server-settings.json"
$TempRoot = Join-Path $env:TEMP "skyrim-unbound-client-package"
$StagingRoot = Join-Path $TempRoot "stage"
$ExtractedPackageRoot = Join-Path $StagingRoot "game"
$PackagePath = Join-Path $LauncherOutputDir $PackageFileName
$ManifestPath = Join-Path $LauncherOutputDir "manifest.json"
$FileManifestPath = Join-Path $LauncherOutputDir "file-manifest.json"
$HostedFilesRoot = Join-Path $LauncherOutputDir "files"
$LauncherPs1Source = Join-Path $TemplateDir "skyrim-unbound-launcher.ps1"
$LauncherCmdSource = Join-Path $TemplateDir "skyrim-unbound-launcher.cmd"
$LauncherDiagnosticsPs1Source = Join-Path $TemplateDir "skyrim-unbound-diagnostics.ps1"
$LauncherDiagnosticsCmdSource = Join-Path $TemplateDir "skyrim-unbound-diagnostics.cmd"
$LauncherPs1Target = Join-Path $LauncherOutputDir "skyrim-unbound-launcher.ps1"
$LauncherCmdTarget = Join-Path $LauncherOutputDir "skyrim-unbound-launcher.cmd"
$LauncherDiagnosticsPs1Target = Join-Path $LauncherOutputDir "skyrim-unbound-diagnostics.ps1"
$LauncherDiagnosticsCmdTarget = Join-Path $LauncherOutputDir "skyrim-unbound-diagnostics.cmd"
$LauncherConfigTarget = Join-Path $LauncherOutputDir "skyrim-unbound-launcher-config.json"
$LauncherIndexTarget = Join-Path $LauncherOutputDir "index.html"

Write-Step "Game root: $GameRoot"
Write-Step "Server data dir: $ServerDataDir"

if (-not (Test-Path -LiteralPath (Join-Path $GameRoot "SkyrimSE.exe"))) {
    throw "SkyrimSE.exe was not found in $GameRoot"
}

if (-not (Test-Path -LiteralPath $ClientSettingsPath)) {
    $ClientSettingsPath = Join-Path $GameRoot "Data\Platform\Plugins\skymp5-client-settings.txt"
}

if (-not (Test-Path -LiteralPath $ClientSettingsPath)) {
    throw "Client settings were not found at $ClientSettingsPath"
}

if (-not (Test-Path -LiteralPath $BuildClientDistDir)) {
    throw "Client build output was not found at $BuildClientDistDir"
}

$clientSettings = Get-JsonFile -Path $ClientSettingsPath
$serverSettings = Get-JsonFile -Path $ServerSettingsPath
$serverIp = [string]$clientSettings."server-ip"
$serverPort = [int]$clientSettings."server-port"
$uiPort = Get-UiPort -Port $serverPort
$publicUiUrl = "http://$serverIp`:$uiPort"
$launcherBaseUrl = "http://$serverIp`:$uiPort/launcher"
$version = Get-Date -Format "yyyyMMdd-HHmmss"

Write-Step "Publishing launcher assets for $launcherBaseUrl"

if (Test-Path -LiteralPath $TempRoot) {
    Remove-Item -LiteralPath $TempRoot -Recurse -Force
}

Ensure-Directory -Path $ExtractedPackageRoot
Ensure-Directory -Path $LauncherOutputDir
Ensure-Directory -Path $HostedFilesRoot

Get-ChildItem -LiteralPath $LauncherOutputDir -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like ("skyrim-" + "world*") } |
    Remove-Item -Recurse -Force

Write-Step "Staging fresh client output from $BuildClientDistDir"
Copy-FilteredTree -Source $BuildClientDistDir -Destination $ExtractedPackageRoot

Copy-FilteredTree -Source (Join-Path $GameRoot "Data\Interface\Controls\PC\controlmap.txt") -Destination (Join-Path $ExtractedPackageRoot "Data\Interface\Controls\PC")

$optionalDataDirs = @(
    "Analytics",
    "NirnLabUIPlatform",
    "Platform\UI"
)

foreach ($optionalDir in $optionalDataDirs) {
    $sourceDir = Join-Path $GameRoot ("Data\" + $optionalDir)
    if (Test-Path -LiteralPath $sourceDir) {
        Copy-FilteredTree -Source $sourceDir -Destination (Join-Path $ExtractedPackageRoot ("Data\" + $optionalDir))
    }
}

if (Test-Path -LiteralPath $ClientAssetsDir) {
    Write-Step "Overlaying public-test client assets from $ClientAssetsDir"
    Copy-FilteredTree -Source $ClientAssetsDir -Destination $ExtractedPackageRoot
}

$legacyBrandAssetPaths = @(
    (Join-Path "Data\Platform\UI" ("skyrim-" + "world-login-bg.jpg"))
)
foreach ($legacyBrandAssetPath in $legacyBrandAssetPaths) {
    $fullLegacyBrandAssetPath = Join-Path $ExtractedPackageRoot $legacyBrandAssetPath
    if (Test-Path -LiteralPath $fullLegacyBrandAssetPath) {
        Remove-Item -LiteralPath $fullLegacyBrandAssetPath -Force
    }
}

$legacyPluginAssetsDir = Join-Path $ExtractedPackageRoot "Data\Platform\Plugins\Assets"
if (Test-Path -LiteralPath $legacyPluginAssetsDir) {
    Write-Step "Removing legacy plugin asset directory from package staging"
    Remove-Item -LiteralPath $legacyPluginAssetsDir -Recurse -Force
}

Get-ChildItem -LiteralPath $GameRoot -Filter "skse64*" -File | ForEach-Object {
    if (-not (Should-SkipFile -Path $_.FullName)) {
        Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $ExtractedPackageRoot $_.Name) -Force
    }
}

$optionalRootFiles = @(
    "d3dx9_42.dll",
    "tbb.dll",
    "tbbmalloc.dll"
)

foreach ($rootFile in $optionalRootFiles) {
    $sourceFile = Join-Path $GameRoot $rootFile
    if (Test-Path -LiteralPath $sourceFile) {
        Copy-Item -LiteralPath $sourceFile -Destination (Join-Path $ExtractedPackageRoot $rootFile) -Force
    }
}

$packagedClientSettingsPath = Join-Path $ExtractedPackageRoot "Data\Platform\Plugins\skymp5-client-settings.txt"
$packagedClientSettings = [ordered]@{}
foreach ($property in $clientSettings.PSObject.Properties) {
    $packagedClientSettings[$property.Name] = $property.Value
}
$packagedClientSettings["server-ip"] = $serverIp
$packagedClientSettings["server-port"] = $serverPort
$packagedClientSettings["server-master-key"] = [string]$clientSettings."server-master-key"
$packagedClientSettings["server-ui-url"] = $publicUiUrl
if (-not $packagedClientSettings.Contains("language")) {
    $packagedClientSettings["language"] = "en"
}
Write-Utf8NoBomFile -Path $packagedClientSettingsPath -Content ($packagedClientSettings | ConvertTo-Json -Depth 4)

$requiredPaths = @(
    (Join-Path $ExtractedPackageRoot "Data\Platform\Plugins\skymp5-client.js"),
    (Join-Path $ExtractedPackageRoot "Data\Platform\Plugins\skymp5-client-settings.txt"),
    (Join-Path $ExtractedPackageRoot "Data\SKSE\Plugins\SkyrimPlatform.dll"),
    (Join-Path $ExtractedPackageRoot "Data\SKSE\Plugins\MpClientPlugin.dll"),
    (Join-Path $ExtractedPackageRoot "skse64_loader.exe")
)

foreach ($requiredPath in $requiredPaths) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "Required packaged path is missing: $requiredPath"
    }
}

if (Test-Path -LiteralPath $PackagePath) {
    Remove-Item -LiteralPath $PackagePath -Force
}

Compress-Archive -Path (Join-Path $ExtractedPackageRoot "*") -DestinationPath $PackagePath -Force

& robocopy $ExtractedPackageRoot $HostedFilesRoot /MIR /R:2 /W:1 /NFL /NDL /NJH /NJS /NC /NS /NP | Out-Null
if ($LASTEXITCODE -ge 8) {
    throw "robocopy failed while publishing hosted files with exit code $LASTEXITCODE"
}

$packageHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $PackagePath).Hash.ToLowerInvariant()
$packageSize = (Get-Item -LiteralPath $PackagePath).Length

$fileEntries = Get-ChildItem -LiteralPath $ExtractedPackageRoot -Recurse -File | ForEach-Object {
    [ordered]@{
        path = Get-RelativeForwardPath -Root $ExtractedPackageRoot -Path $_.FullName
        size = $_.Length
        sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash.ToLowerInvariant()
    }
}

$fileManifest = [ordered]@{
    version = $version
    generatedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
    fileBaseUrl = "$launcherBaseUrl/files"
    files = @($fileEntries)
}

$manifest = [ordered]@{
    name = $ServerName
    version = $version
    generatedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
    launcherBaseUrl = $launcherBaseUrl
    fileManifestFileName = "file-manifest.json"
    packageFileName = $PackageFileName
    packageSha256 = $packageHash
    packageSize = $packageSize
    launchExecutable = "skse64_loader.exe"
    gameVersion = "1.6.1170"
    serverIp = $serverIp
    serverPort = $serverPort
    uiPort = $uiPort
    serverMasterKey = [string]$clientSettings."server-master-key"
    serverName = if ($serverSettings.PSObject.Properties.Name -contains "name") { [string]$serverSettings.name } else { $ServerName }
}

$launcherConfig = [ordered]@{
    displayName = $ServerName
    launcherBaseUrl = $launcherBaseUrl
    manifestUrl = "$launcherBaseUrl/manifest.json"
    gameRoot = ""
}

$indexHtml = @"
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>$ServerName Launcher</title>
  <style>
    body { font-family: Segoe UI, sans-serif; margin: 2rem auto; max-width: 44rem; line-height: 1.5; color: #e9ecef; background: #101820; }
    a { color: #8fd3ff; }
    code { background: #17232e; padding: 0.1rem 0.3rem; border-radius: 4px; }
    .box { background: #16212a; border: 1px solid #314251; border-radius: 10px; padding: 1rem 1.2rem; }
  </style>
</head>
<body>
  <h1>$ServerName launcher</h1>
  <div class="box">
    <p>Download these files onto the laptop and place them in the Skyrim Special Edition folder next to <code>SkyrimSE.exe</code>.</p>
    <ul>
      <li><a href="skyrim-unbound-launcher.cmd">skyrim-unbound-launcher.cmd</a></li>
      <li><a href="skyrim-unbound-launcher.ps1">skyrim-unbound-launcher.ps1</a></li>
      <li><a href="skyrim-unbound-diagnostics.cmd">skyrim-unbound-diagnostics.cmd</a></li>
      <li><a href="skyrim-unbound-diagnostics.ps1">skyrim-unbound-diagnostics.ps1</a></li>
      <li><a href="skyrim-unbound-launcher-config.json">skyrim-unbound-launcher-config.json</a></li>
    </ul>
    <p>Then launch the game through <code>skyrim-unbound-launcher.cmd</code>. It will download the latest client package, install it, and start SKSE.</p>
    <p>If the laptop still crashes, run <code>skyrim-unbound-diagnostics.cmd</code> instead. It waits for Skyrim to exit and writes a diagnostics zip under your local app data folder.</p>
    <p>Current package version: <strong>$version</strong></p>
    <p>Current package hash: <code>$packageHash</code></p>
    <p><a href="$PackageFileName">Direct package download</a></p>
  </div>
</body>
</html>
"@

Copy-Item -LiteralPath $LauncherPs1Source -Destination $LauncherPs1Target -Force
Copy-Item -LiteralPath $LauncherCmdSource -Destination $LauncherCmdTarget -Force
Copy-Item -LiteralPath $LauncherDiagnosticsPs1Source -Destination $LauncherDiagnosticsPs1Target -Force
Copy-Item -LiteralPath $LauncherDiagnosticsCmdSource -Destination $LauncherDiagnosticsCmdTarget -Force
Write-Utf8NoBomFile -Path $ManifestPath -Content ($manifest | ConvertTo-Json -Depth 6)
Write-Utf8NoBomFile -Path $FileManifestPath -Content ($fileManifest | ConvertTo-Json -Depth 6)
Write-Utf8NoBomFile -Path $LauncherConfigTarget -Content ($launcherConfig | ConvertTo-Json -Depth 4)
Write-Utf8NoBomFile -Path $LauncherIndexTarget -Content $indexHtml

Write-Step "Published package: $PackagePath"
Write-Step "Published manifest: $ManifestPath"
Write-Step "Published file manifest: $FileManifestPath"
Write-Step "Laptop bootstrap page: $LauncherBaseUrl/index.html"
