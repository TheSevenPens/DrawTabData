# Windows drawing tablet installer analysis

The sampled Windows installers bundle a configuration app, supporting executables, and one or more Windows driver packages. The archives let us identify exact files and intended architecture. Windows Driver Store staging, device binding, and post-uninstall state require a live test.

## Installer builds inspected

| Brand | Vendor build | Installer |
| --- | --- | --- |
| Wacom | `6.4.12-3` | `WacomTablet_6.4.12-3.exe` |
| Huion V15 | `15.7.6.1858` | `HuionTablet_WinDriver_v15.7.6.1858.exe` |
| Huion V20 | `20.0.1.123` | `HuionTabletInstall_20.0.1.123.exe` |
| XPPen | `4.0.13.251216` | `XPPenWin_4.0.13.251216.exe` |
| Xencelabs | `1.3.0-39` | `XencelabsWin_1.3.0-39.exe` |
| Xencelabs ARM64 | `1.3.4-75` | `XencelabsWin_Arm_64_1.3.4-75.exe` |

The [Windows inventory](windows-tablet-driver-filesystem.json) records each installer SHA-256, source URLs, and selected file fingerprints. The enclosing installer build, the version embedded in a binary, and the version declared in an INF are separate fields. The hashes apply to the executables in the table, including the XPPen executable extracted from its download ZIP.

## Application and system locations

| Brand | Documented or reported paths | Build-specific archive evidence |
| --- | --- | --- |
| Wacom | The vendor cleanup guide lists `C:\Program Files\Tablet\`, `%APPDATA%\WTablet\` and `%LOCALAPPDATA%\Wacom\`, plus named DLLs under Windows System32. The guide spans releases. | `6.4.12-3` contains `WTabletServicePro.exe`, `Wacom_Tablet.exe` and `Wintab32.dll`, including native ARM64 copies. `System32/ARM64` is the internal archive path. |
| Huion | The V15 `15.7.6.1858` inventory places the main app under `C:\Program Files\HuionTablet\`. An independent inventory for the separate V20 `20.1.1.90` build places `HuionTablet.exe` and `Uninstall.exe` under `%APPDATA%\HuionTablet\`. A first-hand report for `20.0.1.123` names the administrator account’s AppData without identifying its exact subfolder. | The V15 payload contains `HuionTabletCore.exe` and `HuionServer.exe`. The inspected V20 payload contains `TabletDriver.exe` and `TabletServer.exe`. Both contain `HuionTablet.exe`. |
| XPPen | The same-build inventory reports `C:\Program Files\XPPen\` with `XPPenTablet.exe`, `PentabletUIService.exe` and `unins000.exe`. | The signed installer includes x86/x64 and ARM64 branches. The app executable and vendor uninstaller are separate from the INF packages. |
| Xencelabs | The independent inventory corresponding to `1.3.0-39` reports `C:\Program Files\Xencelabs\` and `unins000.exe`. The ARM64 installation path remains unverified. | The ARM64 sample includes native `Xencelabs.exe`, `XencelabsService.exe`, and `XencelabsUIService.exe`. It also includes an x86 `WinTab32.dll` under the installer’s SysWOW64 destination token. |

## What differs across architectures and releases

- **Wacom** bundles eight INF files in the inspected ARM64 branch. They include HID router and mouse-filter packages, Wacom USB packages, and serial packages. The presence of these files does not establish which ones stage for a particular tablet.
- **Huion** bundles byte-identical x86 and x64 virtual HID package files in the inspected V15 and V20 builds for each architecture, including `vmulti.inf`, `vmulti.sys`, `huionhid.cat`, and `hidkmdf.sys`. V20 adds a separate ARM64 `hnvmulti.inf` package and helpers. The x86/x64 `TabletDriver.inf` files changed between the releases.
- **XPPen** ships `XPPenTablet.inf` for x86/x64 and `XPPenDevice.inf` with `hwugmoufiltr.inf` for ARM64 in the same installer. **Xencelabs** ships `XencelabsTablet.inf` in the inspected x86/x64 download and `XencelabsDevice.inf` with `hwugmoufiltr.inf` in its separate ARM64 download.
- **Shared filenames need a hash check.** The sampled x64 XPPen and Xencelabs VMulti and Hanvon Ugee mouse-filter packages have identical INF, CAT, and SYS bytes. Both ARM64 downloads contain `hwugmoufiltr.inf`, with INF versions `17.56.31.103` for XPPen and `15.43.1.751` for Xencelabs. Their INF, CAT, and SYS files all have different hashes.

## Uninstall evidence and live verification

The same-build XPPen inventory reports copies of the tablet and filter package files under its Program Files directory after uninstall. That leaves active binding and Driver Store staging open. A same-build Huion V15 report lists an uninstall registry key and Windows activity records. The Wacom and Xencelabs residue reports cover other builds and serve as comparison points.

For a live comparison, record the exact installer hash, Windows build, architecture, tablet model, and account used to install. Capture the application directory, user settings, registered uninstall command, services, Driver Store entries, and active device binding before install, after install, and after uninstall and reboot. For Huion V20, check whether the uninstall record is machine-wide or belongs to a user account. The AppData path itself leaves that question open.

See the [investigation methodology](README.md) and the [Windows inventory](windows-tablet-driver-filesystem.json) for evidence categories and source links.
