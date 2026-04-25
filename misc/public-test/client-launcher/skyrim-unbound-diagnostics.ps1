param(
    [string]$GameRoot = "",
    [string]$LauncherBaseUrl = "",
    [switch]$Force
)

$launcherScript = Join-Path $PSScriptRoot "skyrim-unbound-launcher.ps1"
$diagnosticRoot = Join-Path ([Environment]::GetFolderPath("LocalApplicationData")) "Skyrim Unbound\Diagnostics"

& $launcherScript `
    -GameRoot $GameRoot `
    -LauncherBaseUrl $LauncherBaseUrl `
    -Force:$Force `
    -Diagnostics `
    -WaitForExit `
    -DiagnosticReportRoot $diagnosticRoot

exit $LASTEXITCODE
