<#
.SYNOPSIS
    Adds a new Wacom driver version to WACOM-drivers.json.

.DESCRIPTION
    Given a driver version and release date, generates Windows and macOS entries
    with proper CDN URLs, release notes links, and metadata, then inserts them
    into data/drivers/WACOM-drivers.json.

.PARAMETER Version
    The driver version string exactly as Wacom uses it (e.g., "6.4.12-3").

.PARAMETER ReleaseDate
    The release date in ISO format (e.g., "2026-01-06"). Leave empty to set blank.

.PARAMETER OS
    Which OS entries to add: "Both" (default), "Windows", or "macOS".

.PARAMETER DryRun
    Show what would be added without modifying any files.

.EXAMPLE
    .\scripts\Add-WacomDriver.ps1 -Version "6.4.13-1" -ReleaseDate "2026-06-15"

.EXAMPLE
    .\scripts\Add-WacomDriver.ps1 -Version "6.4.13-1" -ReleaseDate "2026-06-15" -DryRun
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Version,

    [Parameter(Mandatory = $false)]
    [string]$ReleaseDate = "",

    [Parameter(Mandatory = $false)]
    [ValidateSet("Both", "Windows", "macOS")]
    [string]$OS = "Both",

    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# --- Locate repo root ---
$repoRoot = Split-Path -Parent $PSScriptRoot
$jsonPath = Join-Path $repoRoot "data\drivers\WACOM-drivers.json"

if (-not (Test-Path $jsonPath)) {
    Write-Error "Cannot find WACOM-drivers.json at $jsonPath"
    exit 1
}

# --- Validate release date format ---
if ($ReleaseDate -and $ReleaseDate -notmatch '^\d{4}-\d{2}-\d{2}$') {
    Write-Error "ReleaseDate must be in YYYY-MM-DD format (e.g., 2026-01-06)"
    exit 1
}

# --- Build entries ---
$now = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.000Z")

function New-DriverEntry {
    param(
        [string]$DriverVersion,
        [string]$OSFamily,
        [string]$ReleaseDate
    )

    $osLower = if ($OSFamily -eq "WINDOWS") { "win" } else { "mac" }
    $ext = if ($OSFamily -eq "WINDOWS") { "exe" } else { "dmg" }
    $osLabel = if ($OSFamily -eq "WINDOWS") { "Windows" } else { "Mac" }

    return [ordered]@{
        DriverVersion          = $DriverVersion
        DriverName             = "Driver $DriverVersion for $OSFamily"
        OSFamily               = $OSFamily
        ReleaseDate            = $ReleaseDate
        DriverURLWacom         = "https://cdn.wacom.com/u/productsupport/drivers/$osLower/professional/WacomTablet_$DriverVersion.$ext"
        DriverURLArchiveDotOrg = ""
        ReleaseNotesURL        = "https://cdn.wacom.com/u/productsupport/drivers/$osLower/professional/releasenotes/${osLabel}_$DriverVersion.html"
        DriverUID              = "${DriverVersion}_$OSFamily"
        Brand                  = "WACOM"
        EntityId               = "WACOM.DRIVER.${DriverVersion}_$OSFamily"
        _id                    = [guid]::NewGuid().ToString()
        _CreateDate            = $now
        _ModifiedDate          = $now
    }
}

$entriesToAdd = @()
if ($OS -eq "Both" -or $OS -eq "Windows") {
    $entriesToAdd += @{ OSFamily = "WINDOWS" }
}
if ($OS -eq "Both" -or $OS -eq "macOS") {
    $entriesToAdd += @{ OSFamily = "MACOS" }
}

# --- Check for duplicates ---
Write-Host "Loading existing driver data..." -ForegroundColor Cyan
$data = Get-Content $jsonPath -Raw | ConvertFrom-Json
$existingUIDs = $data.Drivers | ForEach-Object { $_.DriverUID }

$duplicates = @()
foreach ($e in $entriesToAdd) {
    $uid = "${Version}_$($e.OSFamily)"
    if ($existingUIDs -contains $uid) {
        $duplicates += $uid
    }
}

if ($duplicates.Count -gt 0) {
    Write-Error "Duplicate entries already exist: $($duplicates -join ', ')"
    exit 1
}

# --- Build the actual entry objects ---
$entries = @()
foreach ($e in $entriesToAdd) {
    $entries += New-DriverEntry -DriverVersion $Version -OSFamily $e.OSFamily -ReleaseDate $ReleaseDate
}

# --- Preview ---
Write-Host ""
Write-Host "Entries to add:" -ForegroundColor Yellow
foreach ($entry in $entries) {
    Write-Host "  $($entry.DriverUID)" -ForegroundColor White
    Write-Host "    Version:  $($entry.DriverVersion)"
    Write-Host "    OS:       $($entry.OSFamily)"
    Write-Host "    Date:     $(if ($entry.ReleaseDate) { $entry.ReleaseDate } else { '(none)' })"
    Write-Host "    Wacom:    $($entry.DriverURLWacom)"
    Write-Host "    Notes:    $($entry.ReleaseNotesURL)"
    Write-Host ""
}

if ($DryRun) {
    Write-Host "DRY RUN - no files modified." -ForegroundColor Yellow
    exit 0
}

# --- Update WACOM-drivers.json ---
Write-Host "Updating WACOM-drivers.json..." -ForegroundColor Cyan

$driverList = [System.Collections.ArrayList]@($data.Drivers)

foreach ($entry in $entries) {
    # Insert after the last 6.4.x entry
    $lastIdx = -1
    for ($i = 0; $i -lt $driverList.Count; $i++) {
        if ($driverList[$i].DriverVersion -match '^6\.4\.') {
            $lastIdx = $i
        }
    }
    if ($lastIdx -ge 0) {
        $driverList.Insert($lastIdx + 1, $entry)
    } else {
        $driverList.Add($entry) | Out-Null
    }
}

$data.Drivers = $driverList.ToArray()
$json = $data | ConvertTo-Json -Depth 10
$json = $json -replace "`r`n", "`n"
[System.IO.File]::WriteAllText($jsonPath, $json, [System.Text.UTF8Encoding]::new($false))

Write-Host "  Updated $jsonPath" -ForegroundColor Green

# --- Summary ---
Write-Host ""
Write-Host "Done! Added $($entries.Count) entries." -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. git add data/drivers/WACOM-drivers.json" -ForegroundColor White
Write-Host "  2. git commit -m `"Add driver $Version for Windows and macOS`"" -ForegroundColor White
Write-Host "  3. git push" -ForegroundColor White
Write-Host ""
Write-Host "Then update any consumer projects (bump the submodule)." -ForegroundColor Gray
