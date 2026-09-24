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

.PARAMETER DataDir
    Data directory to update (default: the repo's data\ folder). For testing
    against a copy.

.NOTES
    The write goes through scripts/add-driver-record.ts (npx tsx), which uses
    lib/data-json.ts so the file stays canonical: 2-space JSON, LF, UTF-8
    without BOM. Needs Node and `npm install` in the repo.

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

    [switch]$DryRun,

    [Parameter(Mandatory = $false)]
    [string]$DataDir = ""
)

$ErrorActionPreference = "Stop"

# --- Locate repo root ---
$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not $DataDir) { $DataDir = Join-Path $repoRoot "data" }
$DataDir = (Resolve-Path $DataDir).Path
$jsonPath = Join-Path $DataDir "drivers\WACOM-drivers.json"

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
        OSFamily               = $OSFamily
        ReleaseDate            = $ReleaseDate
        DriverURLWacom         = "https://cdn.wacom.com/u/productsupport/drivers/$osLower/professional/WacomTablet_$DriverVersion.$ext"
        DriverURLArchiveDotOrg = ""
        ReleaseNotesURL        = "https://cdn.wacom.com/u/productsupport/drivers/$osLower/professional/releasenotes/${osLabel}_$DriverVersion.html"
        DriverUID              = "${DriverVersion}_$OSFamily"
        Brand                  = "WACOM"
        EntityId               = ("wacom.driver.${DriverVersion}_$OSFamily").ToLower()
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
#
# The write goes through scripts/add-driver-record.ts, which reads the file,
# inserts the entries after the last existing 6.4.x entry (dated releases
# stay together, ahead of the undated tail) and writes it back via
# lib/data-json.ts in canonical form, so the diff is just the new entries.
# Round-tripping the file through ConvertTo-Json here would reflow it, and
# Windows PowerShell 5.1 would also mangle non-ASCII text (#43).
Write-Host "Updating WACOM-drivers.json..." -ForegroundColor Cyan

# Hand the entries over as a temp JSON file. Only the entries go through
# ConvertTo-Json (ASCII version strings, URLs and GUIDs), never the dataset.
$recordsPath = Join-Path ([System.IO.Path]::GetTempPath()) ("wacom-driver-" + [guid]::NewGuid().ToString() + ".json")
$recordsJson = ConvertTo-Json -InputObject @($entries) -Depth 5
[System.IO.File]::WriteAllText($recordsPath, $recordsJson, [System.Text.UTF8Encoding]::new($false))

Push-Location $repoRoot
try {
    & npx tsx scripts/add-driver-record.ts $recordsPath --after-version-prefix "6.4." --data-dir $DataDir
    $exitCode = $LASTEXITCODE
} finally {
    Pop-Location
    Remove-Item -LiteralPath $recordsPath -ErrorAction SilentlyContinue
}
if ($exitCode -ne 0) {
    Write-Error "add-driver-record.ts failed (exit $exitCode); WACOM-drivers.json was not changed."
    exit 1
}

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
