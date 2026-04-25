param(
    [int]$GamePort = 7777,
    [int]$UiPort = 3000,
    [string]$RulePrefix = "SkyMP Skyrim Unbound",
    [string]$InternalIp = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Test-IsAdministrator {
    $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-PreferredInternalIp {
    param([string]$ExplicitIp)

    if (-not [string]::IsNullOrWhiteSpace($ExplicitIp)) {
        return $ExplicitIp
    }

    $candidates = Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object {
            $_.IPAddress -notlike '127.*' -and
            $_.IPAddress -notlike '169.254.*' -and
            $_.InterfaceAlias -notlike 'vEthernet*' -and
            $_.InterfaceAlias -notlike 'Mullvad*'
        } |
        Sort-Object @{
            Expression = {
                if ($_.InterfaceAlias -match 'Ethernet') { 0 }
                elseif ($_.InterfaceAlias -match 'Wi-?Fi') { 1 }
                else { 2 }
            }
        }, InterfaceMetric

    $selected = $candidates | Select-Object -First 1
    if ($null -eq $selected) {
        throw "Could not determine a suitable internal IPv4 address automatically."
    }

    return $selected.IPAddress
}

function Ensure-FirewallRule {
    param(
        [string]$DisplayName,
        [string]$Protocol,
        [int]$Port
    )

    $existing = Get-NetFirewallRule -DisplayName $DisplayName -ErrorAction SilentlyContinue
    if ($existing) {
        Set-NetFirewallRule -DisplayName $DisplayName -Enabled True -Action Allow -Profile Private,Public | Out-Null
        Set-NetFirewallPortFilter -AssociatedNetFirewallRule $existing -Protocol $Protocol -LocalPort $Port | Out-Null
        return "Updated firewall rule: $DisplayName"
    }

    New-NetFirewallRule `
        -DisplayName $DisplayName `
        -Direction Inbound `
        -Action Allow `
        -Enabled True `
        -Profile Private,Public `
        -Protocol $Protocol `
        -LocalPort $Port | Out-Null

    return "Created firewall rule: $DisplayName"
}

function Ensure-UpnpMapping {
    param(
        [int]$ExternalPort,
        [string]$Protocol,
        [int]$InternalPort,
        [string]$TargetIp,
        [string]$Description
    )

    try {
        $nat = New-Object -ComObject HNetCfg.NATUPnP
        $mappings = $nat.StaticPortMappingCollection
        if ($null -eq $mappings) {
            return "UPnP mapping collection unavailable on this network."
        }

        try {
            $existing = $mappings.Item($ExternalPort, $Protocol)
        } catch {
            $existing = $null
        }

        if ($existing) {
            if ($existing.InternalClient -eq $TargetIp -and $existing.InternalPort -eq $InternalPort) {
                return "UPnP already mapped: $Protocol $ExternalPort -> $TargetIp`:$InternalPort"
            }

            try {
                $mappings.Remove($ExternalPort, $Protocol) | Out-Null
            } catch {
            }
        }

        $null = $mappings.Add($ExternalPort, $Protocol, $InternalPort, $TargetIp, $true, $Description)
        return "Created UPnP mapping: $Protocol $ExternalPort -> $TargetIp`:$InternalPort"
    } catch {
        return "UPnP unavailable: $($_.Exception.Message)"
    }
}

if (-not (Test-IsAdministrator)) {
    Write-Host "Elevation required. Re-launching this port setup as administrator..." -ForegroundColor Yellow
    $argList = @(
        "-ExecutionPolicy", "Bypass",
        "-File", "`"$PSCommandPath`"",
        "-GamePort", $GamePort,
        "-UiPort", $UiPort,
        "-RulePrefix", "`"$RulePrefix`""
    )
    if (-not [string]::IsNullOrWhiteSpace($InternalIp)) {
        $argList += @("-InternalIp", "`"$InternalIp`"")
    }

    $proc = Start-Process powershell.exe -Verb RunAs -ArgumentList $argList -Wait -PassThru
    exit $proc.ExitCode
}

$selectedInternalIp = Get-PreferredInternalIp -ExplicitIp $InternalIp

$results = New-Object System.Collections.Generic.List[string]
$results.Add((Ensure-FirewallRule -DisplayName "$RulePrefix UDP $GamePort" -Protocol UDP -Port $GamePort)) | Out-Null
$results.Add((Ensure-FirewallRule -DisplayName "$RulePrefix TCP $UiPort" -Protocol TCP -Port $UiPort)) | Out-Null
$results.Add((Ensure-UpnpMapping -ExternalPort $GamePort -Protocol UDP -InternalPort $GamePort -TargetIp $selectedInternalIp -Description "$RulePrefix UDP")) | Out-Null
$results.Add((Ensure-UpnpMapping -ExternalPort $UiPort -Protocol TCP -InternalPort $UiPort -TargetIp $selectedInternalIp -Description "$RulePrefix UI")) | Out-Null

Write-Host ""
Write-Host "=== SkyMP Public Test Port Setup ==="
Write-Host "Internal IP: $selectedInternalIp"
Write-Host "Gameplay Port: UDP $GamePort"
Write-Host "UI Port: TCP $UiPort"
Write-Host ""

foreach ($line in $results) {
    Write-Host $line
}
