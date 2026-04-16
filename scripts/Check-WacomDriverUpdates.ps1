<#
.SYNOPSIS
    Checks whether a newer Wacom driver exists than what is tracked in this repo.

.DESCRIPTION
    Fetches the Wacom update manifest (wacom-update.xml) and compares the latest
    driver version listed there against the latest version in WACOM-drivers.json.

.EXAMPLE
    .\scripts\Check-WacomDriverUpdates.ps1
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$driversJsonPath = Join-Path $repoRoot "data\drivers\WACOM-drivers.json"

if (-not (Test-Path $driversJsonPath)) {
    Write-Error "Cannot find WACOM-drivers.json at $driversJsonPath"
    exit 1
}

# --- Fetch latest version from Wacom update manifest ---
Write-Host "Fetching Wacom update manifest..." -ForegroundColor Cyan
$xmlUrl = "https://link.wacom.com/wdc/update.xml"

try {
    $response = Invoke-WebRequest -Uri $xmlUrl -UseBasicParsing -TimeoutSec 30
    $xmlContent = $response.Content
} catch {
    Write-Error "Failed to fetch update manifest: $_"
    exit 1
}

# Extract the first driver version from Windows and macOS sections
$winVersions = [regex]::Matches($xmlContent, '<win type="map">.*?<files type="array">(.*?)</files>', [System.Text.RegularExpressions.RegexOptions]::Singleline)
$macVersions = [regex]::Matches($xmlContent, '<mac type="map">.*?<files type="array">(.*?)</files>', [System.Text.RegularExpressions.RegexOptions]::Singleline)

function Get-FirstVersion($sectionMatch) {
    if ($sectionMatch.Count -gt 0) {
        $firstEntry = [regex]::Match($sectionMatch[0].Groups[1].Value, '<version type="string">(.*?)</version>')
        if ($firstEntry.Success) {
            return $firstEntry.Groups[1].Value
        }
    }
    return $null
}

$latestWinVersion = Get-FirstVersion $winVersions
$latestMacVersion = Get-FirstVersion $macVersions

Write-Host ""
Write-Host "Latest in Wacom manifest:" -ForegroundColor Yellow
Write-Host "  Windows: $latestWinVersion"
Write-Host "  macOS:   $latestMacVersion"

# --- Check what we already have ---
Write-Host ""
Write-Host "Checking local driver data..." -ForegroundColor Cyan

$data = Get-Content $driversJsonPath -Raw | ConvertFrom-Json
$drivers = $data.Drivers
$knownUIDs = $drivers | ForEach-Object { $_.DriverUID } | Sort-Object -Unique

$latestRemoteVersion = $latestWinVersion

$winUID = "${latestRemoteVersion}_WINDOWS"
$macUID = "${latestRemoteVersion}_MACOS"

# Also check dot-notation variant (e.g., 6.4.12-3 stored as 6.4.12.3)
$dotVersion = $latestRemoteVersion -replace '-', '.'
$winUIDDot = "${dotVersion}_WINDOWS"
$macUIDDot = "${dotVersion}_MACOS"

$hasWin = ($knownUIDs -contains $winUID) -or ($knownUIDs -contains $winUIDDot)
$hasMac = ($knownUIDs -contains $macUID) -or ($knownUIDs -contains $macUIDDot)

Write-Host ""
if ($hasWin -and $hasMac) {
    Write-Host "UP TO DATE - Both Windows and macOS entries for $latestRemoteVersion already exist." -ForegroundColor Green
} else {
    Write-Host "UPDATE AVAILABLE: $latestRemoteVersion" -ForegroundColor Red
    if (-not $hasWin) {
        Write-Host "  MISSING: Windows driver $latestRemoteVersion" -ForegroundColor Red
    } else {
        Write-Host "  OK:      Windows driver $latestRemoteVersion" -ForegroundColor Green
    }
    if (-not $hasMac) {
        Write-Host "  MISSING: macOS driver $latestRemoteVersion" -ForegroundColor Red
    } else {
        Write-Host "  OK:      macOS driver $latestRemoteVersion" -ForegroundColor Green
    }
    Write-Host ""
    Write-Host "Run the following to add it:" -ForegroundColor Yellow
    Write-Host "  .\scripts\Add-WacomDriver.ps1 -Version `"$latestRemoteVersion`" -ReleaseDate `"YYYY-MM-DD`"" -ForegroundColor White
    Write-Host ""
    Write-Host "  (Get the release date from the release notes page)" -ForegroundColor Gray
}
