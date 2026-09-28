# Updating Wacom Driver Data

This guide explains how to add newly released Wacom drivers to `data/drivers/WACOM-drivers.json`.

## Quick Version

```powershell
# 1. List missing drivers; it prints the exact commands to add them
.\scripts\Check-WacomDriverUpdates.ps1

# 2. Run the commands it printed, e.g.
.\scripts\Add-WacomDriver.ps1 -Version "6.4.14-1" -ReleaseDate "2026-08-26"
.\scripts\Add-WacomDriver.ps1 -Version "6.4.14-2" -ReleaseDate "2026-09-22" -OS macOS

# 3. Commit and push
git add data/drivers/WACOM-drivers.json
git commit -m "Add driver 6.4.13-1 for Windows and macOS"
git push
```

Then bump the submodule in any consumer projects (Wacom-Driver-List, DrawTabDataExplorer).

## Detailed Steps

### Step 1: Check for New Drivers

```powershell
.\scripts\Check-WacomDriverUpdates.ps1
```

This fetches Wacom's update manifest (`https://link.wacom.com/wdc/update.xml`) and checks **every** driver it lists against `WACOM-drivers.json`, Windows and macOS separately. It reports either "UP TO DATE" or each missing driver with its release date, followed by the `Add-WacomDriver.ps1` commands that add them.

What it handles that is easy to miss by hand:

- **Windows and macOS can have different build numbers.** 6.4.14 shipped as 6.4.14-1 on Windows but 6.4.14-2 on macOS, so each OS is checked on its own.
- **The manifest lists only the current build.** When a build replaces an earlier one (macOS 6.4.14-2 replaced 6.4.14-1), the earlier one drops out of the manifest. For each missing version the script probes the CDN for lower builds of that release on both OSes and reports them as "superseded".
- **Repackaged builds** (`WacomTablet_6.3.24-5a_WDC.exe`) are stored under their file-name version and count as present.

Options: `-NoProbe` skips the CDN probe and release-date lookups; `-ManifestPath` reads a saved manifest; `-DataDir` checks a copy of the data.

You can also check manually at: https://www.wacom.com/en-us/support/product-support/drivers

### Step 2: Get the Release Date

`Check-WacomDriverUpdates.ps1` fills this in for you. The date is not in the XML manifest; it comes from the "Released on ..." line of the release notes page. To look one up by hand:

- **Windows**: `https://cdn.wacom.com/u/productsupport/drivers/win/professional/releasenotes/Windows_{VERSION}.html`
- **macOS**: `https://cdn.wacom.com/u/productsupport/drivers/mac/professional/releasenotes/Mac_{VERSION}.html`

Replace `{VERSION}` with the version string (e.g., `6.4.12-3`). The date is at the top of the page.

### Step 3: Add the Driver Entries

```powershell
.\scripts\Add-WacomDriver.ps1 -Version "6.4.13-1" -ReleaseDate "2026-06-15"
```

**Options:**

| Parameter | Description |
|-----------|-------------|
| `-Version` | Required. Version string exactly as Wacom uses it (e.g., `6.4.13-1`) |
| `-ReleaseDate` | Release date in `YYYY-MM-DD` format. Omit to leave blank. |
| `-OS` | `Both` (default), `Windows`, or `macOS`. Use if only one OS was released. |
| `-DryRun` | Preview what would be added without modifying files. |

The script will refuse to run if the DriverUID already exists.

### Step 4: Commit and Push

```bash
git add data/drivers/WACOM-drivers.json
git commit -m "Add driver {VERSION} for Windows and macOS"
git push
```

### Step 5: Update Consumer Projects

Projects that use this data as a submodule need to bump their reference:

```bash
cd <consumer-project>
cd data-repo
git pull
cd ..
git add data-repo
git commit -m "Bump data submodule"
git push
```

## URL Patterns

Wacom uses predictable CDN URL patterns:

| Type | Pattern |
|------|---------|
| Windows download | `https://cdn.wacom.com/u/productsupport/drivers/win/professional/WacomTablet_{VERSION}.exe` |
| macOS download | `https://cdn.wacom.com/u/productsupport/drivers/mac/professional/WacomTablet_{VERSION}.dmg` |
| Windows release notes | `https://cdn.wacom.com/u/productsupport/drivers/win/professional/releasenotes/Windows_{VERSION}.html` |
| macOS release notes | `https://cdn.wacom.com/u/productsupport/drivers/mac/professional/releasenotes/Mac_{VERSION}.html` |

## Manual Edit (Without Scripts)

Each entry needs these fields:

```json
{
  "DriverVersion": "6.4.13-1",
  "OSFamily": "WINDOWS",
  "ReleaseDate": "2026-06-15",
  "DriverURLWacom": "https://cdn.wacom.com/u/productsupport/drivers/win/professional/WacomTablet_6.4.13-1.exe",
  "DriverURLArchiveDotOrg": "",
  "ReleaseNotesURL": "https://cdn.wacom.com/u/productsupport/drivers/win/professional/releasenotes/Windows_6.4.13-1.html",
  "DriverUID": "6.4.13-1_WINDOWS",
  "Brand": "WACOM",
  "EntityId": "WACOM.DRIVER.6.4.13-1_WINDOWS",
  "_id": "<new-uuid>",
  "_CreateDate": "<ISO-timestamp>",
  "_ModifiedDate": "<ISO-timestamp>"
}
```

## Troubleshooting

**Script says "duplicate entry"**: The driver is already in the data. Run `Check-WacomDriverUpdates.ps1` to verify.

**Push rejected**: The remote may have newer commits. Run `git pull --rebase` before pushing.
