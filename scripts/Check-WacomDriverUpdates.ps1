<#
.SYNOPSIS
    Lists Wacom drivers that Wacom publishes but WACOM-drivers.json lacks.

.DESCRIPTION
    Fetches the Wacom update manifest (https://link.wacom.com/wdc/update.xml)
    and checks every driver it lists, per OS, against WACOM-drivers.json.

    Windows and macOS are checked independently: they don't always share a
    build number (6.4.14 shipped as 6.4.14-1 on Windows but 6.4.14-2 on
    macOS), so comparing only the newest Windows version misses macOS
    releases.

    The manifest lists only the current build of each release, so a build it
    replaced (macOS 6.4.14-1, superseded by 6.4.14-2) is invisible there.
    For every missing version the script also probes the CDN for the lower
    builds of that release on both OSes and reports any that exist.

    Release dates are read from each driver's release notes page ("Released
    on ...") and put straight into the suggested Add-WacomDriver.ps1
    commands.

.PARAMETER DataDir
    Data directory to check (default: the repo's data\ folder).

.PARAMETER ManifestPath
    Read the manifest from this local file instead of fetching it.

.PARAMETER NoProbe
    Skip the CDN probe for superseded builds and the release-date lookups
    (no network access beyond the manifest).

.EXAMPLE
    .\scripts\Check-WacomDriverUpdates.ps1
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$DataDir = "",

    [Parameter(Mandatory = $false)]
    [string]$ManifestPath = "",

    [switch]$NoProbe
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not $DataDir) { $DataDir = Join-Path $repoRoot "data" }
$driversJsonPath = Join-Path $DataDir "drivers\WACOM-drivers.json"

if (-not (Test-Path $driversJsonPath)) {
    Write-Error "Cannot find WACOM-drivers.json at $driversJsonPath"
    exit 1
}

$cdn = "https://cdn.wacom.com/u/productsupport/drivers"
$osInfo = @{
    WINDOWS = @{ Section = "win"; Path = "win"; Label = "Windows"; AddOS = "Windows" }
    MACOS   = @{ Section = "mac"; Path = "mac"; Label = "Mac";     AddOS = "macOS" }
}

# The data writes some versions with a dot before the build number
# (6.4.11.1) where Wacom uses a dash (6.4.11-1); compare them as equal.
function Get-VersionKey([string]$Version, [string]$OSFamily) {
    return (($Version -replace '\.', '-') + "_" + $OSFamily).ToLower()
}

function Get-ReleaseNotesUrl([string]$Version, [string]$OSFamily) {
    $os = $osInfo[$OSFamily]
    return "$cdn/$($os.Path)/professional/releasenotes/$($os.Label)_$Version.html"
}

# Fetch a release notes page; returns $null when it doesn't exist.
function Get-ReleaseNotes([string]$Url) {
    try {
        return (Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 30).Content
    } catch {
        return $null
    }
}

# "Released on August 26, 2026" -> "2026-08-26"; "" when absent.
function Get-ReleaseDate([string]$Html) {
    if (-not $Html) { return "" }
    $m = [regex]::Match($Html, 'Released on\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})')
    if (-not $m.Success) { return "" }
    try {
        return ([datetime]::ParseExact($m.Groups[1].Value, 'MMMM d, yyyy',
            [System.Globalization.CultureInfo]::InvariantCulture)).ToString('yyyy-MM-dd')
    } catch {
        return ""
    }
}

# --- Load the manifest ---
if ($ManifestPath) {
    Write-Host "Reading Wacom update manifest from $ManifestPath..." -ForegroundColor Cyan
    $xmlContent = Get-Content $ManifestPath -Raw
} else {
    Write-Host "Fetching Wacom update manifest..." -ForegroundColor Cyan
    try {
        $xmlContent = (Invoke-WebRequest -Uri "https://link.wacom.com/wdc/update.xml" -UseBasicParsing -TimeoutSec 30).Content
    } catch {
        Write-Error "Failed to fetch update manifest: $_"
        exit 1
    }
}
$manifest = [xml]$xmlContent

# --- Load local data ---
$drivers = (Get-Content $driversJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json).Drivers
$known = @{}
foreach ($d in $drivers) { $known[(Get-VersionKey $d.DriverVersion $d.OSFamily)] = $true }

# --- Compare every manifest driver, per OS ---
$missing = @()
foreach ($osFamily in @("WINDOWS", "MACOS")) {
    $entries = @($manifest.root.($osInfo[$osFamily].Section).files.ArrayElement)
    $count = 0
    foreach ($e in $entries) {
        $version = $e.version.'#text'
        $file = $e.file.'#text'
        if (-not $version -or $file -notmatch '^WacomTablet_') { continue }
        $count++
        # Repackaged builds are stored under their file-name version
        # (WacomTablet_6.3.24-5a_WDC.exe -> 6.3.24-5a_WDC), so accept either.
        $fileVersion = $file -replace '^WacomTablet_', '' -replace '\.(exe|dmg|pkg|zip)$', ''
        if ($known[(Get-VersionKey $version $osFamily)] -or $known[(Get-VersionKey $fileVersion $osFamily)]) { continue }
        $notesUrl = $e.releasenotes.'#text'
        if (-not $notesUrl) { $notesUrl = Get-ReleaseNotesUrl $version $osFamily }
        $missing += [pscustomobject]@{ Version = $version; OSFamily = $osFamily; NotesUrl = $notesUrl; Source = "manifest"; ReleaseDate = "" }
    }
    Write-Host "  $($osInfo[$osFamily].Label): $count drivers in manifest" -ForegroundColor Gray
}

# --- Probe for builds the manifest no longer lists ---
if (-not $NoProbe -and $missing.Count -gt 0) {
    Write-Host "Probing the CDN for superseded builds..." -ForegroundColor Cyan
    $releases = @{}
    foreach ($m in $missing) {
        $r = [regex]::Match($m.Version, '^(\d+\.\d+\.\d+)-(\d+)$')
        if (-not $r.Success) { continue }
        $base = $r.Groups[1].Value
        $build = [int]$r.Groups[2].Value
        if (-not $releases.ContainsKey($base) -or $releases[$base] -lt $build) { $releases[$base] = $build }
    }
    foreach ($base in $releases.Keys) {
        foreach ($osFamily in @("WINDOWS", "MACOS")) {
            for ($b = 1; $b -le $releases[$base]; $b++) {
                $version = "$base-$b"
                if ($known[(Get-VersionKey $version $osFamily)]) { continue }
                if ($missing | Where-Object { $_.OSFamily -eq $osFamily -and $_.Version -eq $version }) { continue }
                $url = Get-ReleaseNotesUrl $version $osFamily
                $html = Get-ReleaseNotes $url
                if ($html) {
                    $missing += [pscustomobject]@{ Version = $version; OSFamily = $osFamily; NotesUrl = $url; Source = "superseded"; ReleaseDate = (Get-ReleaseDate $html) }
                }
            }
        }
    }
}

# --- Release dates ---
if (-not $NoProbe) {
    foreach ($m in $missing) {
        if (-not $m.ReleaseDate) { $m.ReleaseDate = Get-ReleaseDate (Get-ReleaseNotes $m.NotesUrl) }
    }
}

# --- Report ---
Write-Host ""
if ($missing.Count -eq 0) {
    Write-Host "UP TO DATE - every driver in the Wacom manifest is in WACOM-drivers.json." -ForegroundColor Green
    exit 0
}

Write-Host "UPDATES AVAILABLE: $($missing.Count) driver(s) missing" -ForegroundColor Red
foreach ($m in ($missing | Sort-Object Version, OSFamily)) {
    $date = if ($m.ReleaseDate) { $m.ReleaseDate } else { "date unknown" }
    $note = if ($m.Source -eq "superseded") { "  (superseded; not in manifest)" } else { "" }
    Write-Host ("  MISSING: {0,-7} {1,-10} {2}{3}" -f $osInfo[$m.OSFamily].Label, $m.Version, $date, $note) -ForegroundColor Red
}

Write-Host ""
Write-Host "Run the following to add them:" -ForegroundColor Yellow
foreach ($group in ($missing | Group-Object Version | Sort-Object Name)) {
    $rows = @($group.Group | Sort-Object OSFamily -Descending)
    # Both OSes on the same day -> one command (the script's -OS Both default).
    $bothOS = $rows.Count -eq 2 -and $rows[0].ReleaseDate -eq $rows[1].ReleaseDate
    if ($bothOS) { $rows = @($rows[0]) }
    foreach ($m in $rows) {
        $date = if ($m.ReleaseDate) { $m.ReleaseDate } else { "YYYY-MM-DD" }
        $cmdArgs = "-Version `"$($m.Version)`" -ReleaseDate `"$date`""
        if (-not $bothOS) { $cmdArgs += " -OS $($osInfo[$m.OSFamily].AddOS)" }
        Write-Host "  .\scripts\Add-WacomDriver.ps1 $cmdArgs" -ForegroundColor White
    }
}
if ($missing | Where-Object { -not $_.ReleaseDate }) {
    Write-Host ""
    Write-Host "  (Fill in any YYYY-MM-DD from the release notes page.)" -ForegroundColor Gray
}
