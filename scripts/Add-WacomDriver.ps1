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

# Render an entry hashtable as a text block matching the file's existing
# PowerShell wide-indent format (20-space braces, 24-space fields, two
# spaces after each colon). Used by the format-preserving splice below
# instead of ConvertTo-Json, which would reflow the whole file under
# PowerShell 7. The closing "@ MUST stay at column 0.
function Format-DriverEntryText {
    param($e)
    return @"
                    {
                        "DriverVersion":  "$($e.DriverVersion)",
                        "OSFamily":  "$($e.OSFamily)",
                        "ReleaseDate":  "$($e.ReleaseDate)",
                        "DriverURLWacom":  "$($e.DriverURLWacom)",
                        "DriverURLArchiveDotOrg":  "$($e.DriverURLArchiveDotOrg)",
                        "ReleaseNotesURL":  "$($e.ReleaseNotesURL)",
                        "DriverUID":  "$($e.DriverUID)",
                        "Brand":  "$($e.Brand)",
                        "EntityId":  "$($e.EntityId)",
                        "_id":  "$($e._id)",
                        "_CreateDate":  "$($e._CreateDate)",
                        "_ModifiedDate":  "$($e._ModifiedDate)"
                    }
"@
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

# --- Update WACOM-drivers.json (format-preserving text splice) ---
#
# We insert the new entries as text rather than re-serialising the whole
# file via ConvertTo-Json. Under PowerShell 7, ConvertTo-Json reflows the
# entire file out of the original wide-indent format (a huge spurious
# diff), so instead we splice the formatted entry blocks in right after
# the last existing 6.4.x entry, leaving every other byte untouched.
Write-Host "Updating WACOM-drivers.json (format-preserving splice)..." -ForegroundColor Cyan

# Read raw and detect the file's existing newline style. We must NOT
# normalise it — WACOM-drivers.json is committed with CRLF, and rewriting
# it as LF would flip every line (a whole-file diff). The spliced block is
# rendered with the same newline so only the new lines appear in the diff.
$text = [System.IO.File]::ReadAllText($jsonPath)
$nl = if ($text.Contains("`r`n")) { "`r`n" } else { "`n" }

# Anchor: the closing "}," of the last existing 6.4.x entry.
$dvMatches = [regex]::Matches($text, '"DriverVersion":\s*"6\.4\.[^"]*"')
if ($dvMatches.Count -eq 0) {
    Write-Error "No existing 6.4.x entry found to anchor the insertion."
    exit 1
}
$lastDvIdx = $dvMatches[$dvMatches.Count - 1].Index
$closeMarker = $nl + (' ' * 20) + "},"
$closeIdx = $text.IndexOf($closeMarker, $lastDvIdx)
if ($closeIdx -lt 0) {
    Write-Error "Could not locate the closing '},' of the last 6.4.x entry (is it the final array element?)."
    exit 1
}
$insertAt = $closeIdx + $closeMarker.Length   # just past the comma

$insertText = ""
foreach ($entry in $entries) {
    # Render the block, then force it to the file's own newline style.
    $block = ((Format-DriverEntryText $entry) -replace "`r`n", "`n") -replace "`n", $nl
    $insertText += $nl + $block + ","
}

$newText = $text.Substring(0, $insertAt) + $insertText + $text.Substring($insertAt)
[System.IO.File]::WriteAllText($jsonPath, $newText, [System.Text.UTF8Encoding]::new($false))

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
