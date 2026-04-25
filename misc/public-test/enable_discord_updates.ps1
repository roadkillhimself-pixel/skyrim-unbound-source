param(
    [string]$ChannelId = "",
    [string]$BotToken = "",
    [string]$MentionRoleId = "",
    [int]$PollIntervalMs = 15000,
    [int]$MaxCommitsPerPoll = 10,
    [int]$MaxFilesPerCommit = 8
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$overridePath = Join-Path $PSScriptRoot "skyrim-unbound-public-test.local.server-settings.json"
$applyConfigScript = Join-Path $PSScriptRoot "apply_public_test_config.ps1"

if ([string]::IsNullOrWhiteSpace($ChannelId)) {
    $ChannelId = Read-Host "Discord channel ID for the updates feed"
}

if ([string]::IsNullOrWhiteSpace($BotToken)) {
    $BotToken = Read-Host "Discord bot token"
}

if ([string]::IsNullOrWhiteSpace($ChannelId)) {
    throw "Channel ID is required."
}

if ([string]::IsNullOrWhiteSpace($BotToken)) {
    throw "Bot token is required."
}

$discordUpdates = [ordered]@{
    botToken = $BotToken.Trim()
    channelId = $ChannelId.Trim()
    pollIntervalMs = $PollIntervalMs
    maxCommitsPerPoll = $MaxCommitsPerPoll
    maxFilesPerCommit = $MaxFilesPerCommit
    announceInitialCommit = $true
}

if (-not [string]::IsNullOrWhiteSpace($MentionRoleId)) {
    $discordUpdates["mentionRoleId"] = $MentionRoleId.Trim()
}

$override = [ordered]@{
    discordUpdates = $discordUpdates
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($overridePath, ($override | ConvertTo-Json -Depth 8), $utf8NoBom)

Write-Host "Saved Discord updates override to $overridePath"
Write-Host "Applying updated public-test config..."
& powershell -NoProfile -ExecutionPolicy Bypass -File $applyConfigScript
if ($LASTEXITCODE -ne 0) {
    throw "Failed to apply updated public-test config."
}

Write-Host ""
Write-Host "Discord updates feed is configured."
Write-Host "Next step: restart the public-test server."
Write-Host "The current HEAD commit will be posted once on first startup so you can verify the bot works."
