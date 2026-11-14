# Installing multiple tablet drivers on the same computer

This investigation compares sampled drivers for external drawing tablets and pen displays on Windows, macOS, and Linux. We inspected installer archives, selected file metadata, and package scripts. We also reviewed vendor guidance and a first-hand Windows coexistence report. Installer contents establish what ships with a build. Runtime conflicts, install-order effects, and uninstall outcomes remain unverified unless an external source explicitly reports them.

## Windows

### What the installers show

- **WinTab has shared locations.** The inspected Wacom and Huion x64 `Wintab32.dll` copies differ. The Xencelabs ARM64 installer contains an x86 WinTab DLL under its SysWOW64 destination token. Huion also documents system-directory WinTab files in its troubleshooting guide. These findings establish different binaries and shared destination candidates. Which DLL a given installer writes or an application loads needs a live trace. [Windows inventory](windows-tablet-driver-filesystem.json) · [Huion WinTab troubleshooting](https://support.huion.com/en/support/solutions/articles/44002332146)
- **Two x64 samples bundle identical packages.** XPPen `4.0.13.251216` and Xencelabs `1.3.0-39` include byte-identical VMulti and Hanvon Ugee mouse-filter INF, CAT, and SYS files. Shared bytes establish a potential dependency overlap. Whether Windows stages one copy and whether either vendor uninstaller removes a package the other uses remain open. [Windows installer analysis](windows-installer-analysis.md) · [Microsoft driver removal documentation](https://learn.microsoft.com/en-us/windows-hardware/drivers/install/how-devices-and-driver-packages-are-uninstalled)
- **The ARM64 filters overlap in name, service, and device match.** XPPen `4.0.13.251216` and Xencelabs `1.3.4-75` both bundle `hwugmoufiltr.inf`, declare the `hwugmoufiltr` service, and list `HID\PenTablet&Col01`. Their INF versions are `17.56.31.103` and `15.43.1.751` respectively. Their INF, catalog, and driver binary hashes differ. Which package Windows stages or binds when both are present remains open. [Windows inventory](windows-tablet-driver-filesystem.json)

### What manufacturers say

- **Huion explicitly instructs Windows users to uninstall existing tablet drivers, including drivers from other brands, before installing its driver.** It identifies conflict as the reason. [Huion Windows installation guide](https://support.huion.com/en/support/solutions/articles/44001163588)
- **XPPen’s Artist 12 3rd instructions explicitly tell users to remove drivers for other brands of drawing tablets or displays before installation.** The instruction appears in the shared pre-installation section before the OS-specific steps. [XPPen Artist 12 3rd manual](https://www.xp-pen.com/user-manual/artist-12-3rd.html)
- **Xencelabs says its driver works with most other drawing-device drivers.** Its specific Windows 10/11 caveat concerns Wacom and applications using WinTab. It describes install order and disconnecting the Wacom tablet as relevant to switching tablets in that case. The caveat is scoped to WinTab applications. [Xencelabs coexistence guidance](https://solutions.xencelabs.com/en/support/solutions/articles/67000672297-will-the-xencelabs-driver-co-exist-with-other-manufactures-drivers-)

A separate first-hand Wacom and Huion report describes a setup that switched WinTab DLLs and driver services to change tablets. That is evidence about one setup. [Wacom and Huion first-hand report](https://github.com/cleniosds/wacom-huion-switcher)

**Live verification.** Compare each driver alone and both install orders. Record the WinTab DLL path and hash loaded by the same drawing app, pressure with WinTab and Windows Ink, and the staged and active device packages. Repeat after uninstalling one brand and rebooting. Test ARM64 separately.

## macOS

### What the installers show

- In the extracted records for Wacom `6.4.15-2`, Huion `20.0.1.109`, XPPen `4.0.21_261026`, and Xencelabs `1.3.5-99`, we found no exact collision among recorded declared destinations or main executable bundle IDs. Huion’s sample is an app in a disk image, so its package records do not establish first-launch destinations. The comparison covers selected archive members and declared paths. [macOS inventory](macos-tablet-driver-filesystem.json)
- **Background helpers have distinct launch paths.** Wacom ships launch agents and daemons, and its post-install script attempts to load named jobs. XPPen ships `/Library/LaunchAgents/com.ugee.Pentablet2.0.plist`. Xencelabs’ post-install script conditionally copies `com.xencelabs.xencelabstablet.plist` into `/Library/LaunchAgents/`. These separate jobs can be present together. The presence of a plist leaves its loaded state and device access open. [macOS installer analysis](macos-installer-analysis.md)
- **Device access and privacy grants need separate checks.** Huion documents Accessibility permission and a case where users should exit the driver before switching accounts. Two active helpers processing the same tablet or input stream could affect event delivery, mapping, or buttons. The archives do not establish whether any pair opens the same device or emits overlapping events. [Huion macOS installation guide](https://support.huion.com/en/support/solutions/articles/44001854273-how-to-install-huion-driver-on-macos) · [Huion account-switching guidance](https://support.huion.com/en/support/solutions/articles/44002497316-how-to-maintain-huion-s-tablet-work-normally-when-switching-multiple-accounts)

### What manufacturers say

- **Huion explicitly tells Mac users to uninstall a previous tablet driver, including one from another brand, before installation.** It warns that multiple drivers can conflict. [Huion macOS installation guide](https://support.huion.com/en/support/solutions/articles/44001854273-how-to-install-huion-driver-on-macos)
- **XPPen gives the same cross-brand removal instruction** in the shared pre-installation section of its Artist 12 3rd manual, which includes macOS installation steps. [XPPen Artist 12 3rd manual](https://www.xp-pen.com/user-manual/artist-12-3rd.html)
- **Xencelabs publishes general coexistence guidance.** Its specific Wacom and WinTab caveat covers Windows. That article does not supply a Mac-specific test matrix for individual vendor pairs. [Xencelabs coexistence guidance](https://solutions.xencelabs.com/en/support/solutions/articles/67000672297-will-the-xencelabs-driver-co-exist-with-other-manufactures-drivers-)

**Live verification.** Start each brand alone and then together with one tablet connected. Record active jobs, the logged-in account, privacy grants, and pressure, mapping, and buttons. Check the same state after closing the settings apps, logging in again, and uninstalling one brand.

## Linux

### What the installers show

- **The three DEB payloads have distinct file destinations.** We compared all regular-file and symlink paths from Huion `15.0.0.193`, XPPen `4.0.15-260422`, and Xencelabs `1.3.4-26` and found no exact path collisions. All three install login autostart entries. The comparison covers payload paths, and scripts can create or modify other files. [Linux installer analysis](linux-installer-analysis.md)
- **XPPen and Xencelabs ship identical udev rules under different names.** `10-xp-pen.rules` and `10-xencelabs.rules` both set permissions for USB devices matching vendor ID `28bd` without a product-ID constraint. The rules allow access. Whether the two running programs open the same tablet and emit duplicate events remains unverified. [Linux inventory](linux-tablet-driver-filesystem.json) · [udev rule semantics](https://www.freedesktop.org/software/systemd/man/latest/udev.html)
- **All three set the same shared input-node mode.** Each sampled udev rule assigns `0666` to `uinput`. Huion also assigns that mode to `uhid` and its post-install script conditionally enables `UserspaceHID` in `/etc/bluetooth/input.conf`. Another installed package can continue to supply the same `uinput` rule after one brand is removed. Effective permissions and Bluetooth behavior still need a live check. [Linux inventory](linux-tablet-driver-filesystem.json) · [Linux installer analysis](linux-installer-analysis.md)
- **The kernel driver can also be active.** A tablet may already produce input through the distribution’s native stack. OpenTabletDriver documents unloading and blacklisting some tablet kernel modules as part of its own setup. That is a documented interaction with the native stack, separate from the behavior of these three vendor DEBs. [OpenTabletDriver Linux permissions and module documentation](https://opentabletdriver.net/Wiki/Documentation/RequiredPermissions)

### What manufacturers say

- **XPPen explicitly asks users to uninstall other brands’ tablet or display drivers** in the shared pre-installation section of the Artist 12 3rd manual, which includes Linux installation steps. The instruction concerns vendor driver software. The manual does not direct users to remove built-in kernel drivers. [XPPen Artist 12 3rd manual](https://www.xp-pen.com/user-manual/artist-12-3rd.html)
- **Huion’s Linux guide describes installation and removal.** The explicit cross-brand uninstall instruction cited above comes from Huion’s Windows and macOS guides. Xencelabs’ general coexistence article does not identify a specific Linux brand pair or installation order. [Huion Linux installation guide](https://support.huion.com/en/support/solutions/articles/44002328461) · [Xencelabs coexistence guidance](https://solutions.xencelabs.com/en/support/solutions/articles/67000672297-will-the-xencelabs-driver-co-exist-with-other-manufactures-drivers-)

**Live verification.** On one distribution and desktop session, capture input with the native stack alone, each vendor driver alone, and then both drivers started with one tablet connected. Check which processes open the device, whether the desktop sees an additional virtual input device, and whether pressure, buttons, or mapping change. Repeat after removing one brand and rebooting. Record the distribution, kernel, X11 or Wayland session, and DEB hash.

See the [investigation methodology](README.md) for how the packages and file records were collected.
