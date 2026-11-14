# macOS drawing tablet installer analysis

Three sampled macOS drivers ship installer packages, and the sampled Huion release ships an application bundle in a disk image. The flat packages expose declared destinations and install scripts. The disk image exposes Huion’s app and nested helpers. These observations come from archive inspection and script review. No installer or uninstaller was executed.

## Installer builds inspected

| Brand | Vendor build | Distribution | Package identifier and component version |
| --- | --- | --- | --- |
| Wacom | `6.4.15-2` | `WacomTablet_6.4.15-2.dmg` | `com.wacom.TabletInstaller`, `0` |
| Huion | `20.0.1.109` | `HuionTablet_MacDriver_20.0.1.109.dmg` | App bundle `com.huion.HuionTablet` |
| XPPen | `4.0.21_261026` | Distribution ZIP containing a DMG and component PKG | `com.pkg.XPPen`, `1.0` |
| Xencelabs | `1.3.5-99` | `XencelabsMac_1.3.5-99.dmg` | `com.ugee.Xencelabs`, `2.0` |

The [macOS inventory](macos-tablet-driver-filesystem.json) records download links, SHA-256 values, component PKG identifiers and hashes, and selected Mach-O and bundle metadata. The main app binaries sampled for all four brands are universal, with Intel x86-64 and Apple silicon ARM64 slices. Embedded signing metadata and PKG certificate subjects were inspected. Signature trust, notarization, and Gatekeeper acceptance remain untested.

## Declared paths and app contents

| Brand | Main app and helpers | System integration visible in the sample |
| --- | --- | --- |
| Wacom | Wacom Center and tablet apps under `/Applications/Wacom Tablet.localized/`. The driver app `WacomTabletDriver.app` sits in that directory’s `.Tablet/` subdirectory. | Payload writes include LaunchAgents, LaunchDaemons, preference panes, and privileged helpers. Examples are `/Library/LaunchAgents/com.wacom.wacomtablet.plist` and the `Wacom_IOManager.app` and `com.wacom.DataStoreMgr.app` bundles under `/Library/PrivilegedHelperTools/`. |
| Huion | The disk image contains `HuionTablet.app` with `HuionDriver.app`, `HuionOSD.app`, and `HuionTouch.app` nested under `Contents/Resources/`. | Huion documents dragging the app to `/Applications` and granting Accessibility permission. Paths the app may create on first launch remain open for this build. |
| XPPen | The PKG declares `/Applications/XPPen/XPPenTablet.app` and `/Applications/XPPen/UninstallXPPen.app`. | The package places `XPPenDriver.app`, `PenTabletInfo.app`, and `XTouchDriver.app` under `/Library/Application Support/PenDriver/`, and `com.ugee.Pentablet2.0.plist` under `/Library/LaunchAgents/`. |
| Xencelabs | The component PKG declares `/Applications/Xencelabs` as its install root. It includes `Xencelabs.app`, `UninstallXencelabs.app`, and driver and agent apps under `Driver/`. | A post-install script copies the launch agent out of the application directory into `/Library/LaunchAgents/` if that directory exists. |

## What the package scripts do

### Wacom

The pre-install script attempts to unload named agents and daemons and processes an obsolete-file list that includes older tablet bundles, startup items, helpers, plug-ins, and kernel extensions. It also ensures that `/Library/Application Support/Tablet/` and a `com.wacom.installdata` marker exist, with conditional copy and permission changes.

The post-install script attempts to load the DataStoreMgr, IOManager, and tablet launch agents and the update helper daemon. It also contains migration logic for older Wacom group containers under `/Users/*/Library/`, including a conditional preference copy into the tablet app’s container. This matters when comparing a clean install with an upgrade on a Mac that already has Wacom settings.

### Huion

The inspected sample is a drag-to-Applications app distribution. The list of nested helpers is visible in the archive. The user’s Accessibility grant, the installed location of the app, and any registration or changes made by first launch or the in-app uninstaller require a live capture.

### XPPen

The extracted pre-install script asks macOS to quit `XPPenTablet`, `XPPenDriver`, and `XTouchDriver`. The launch-agent plist is already in the package payload. This identifies the file laid down at install time. Whether the agent loads in a given login session remains open.

### Xencelabs

The pre-install script asks macOS to quit `Xencelabs`, `XencelabsAgent`, `XencelabsDriver`, and `XenTouchDriver`. The post-install script conditionally copies `/Applications/Xencelabs/.guide/com.xencelabs.xencelabstablet.plist` to `/Library/LaunchAgents/com.xencelabs.xencelabstablet.plist`. That destination would be missed by a comparison that checks only the PKG’s declared app directory.

## What to verify on a live system

- Record the package or image hash, macOS version, hardware architecture, and whether the install is clean or an upgrade.
- Compare package receipts, app and helper paths, launchd state, Background Items, user preferences, and Accessibility and Input Monitoring grants where relevant. Capture the same state after vendor uninstall and reboot.
- For Huion, compare the installed bundle and its first-launch changes. For Xencelabs, check the script-copied launch agent. For Wacom, compare clean install and upgrade behavior. For XPPen, check the launch agent and support directory after removal.
- Inspect any active system extensions separately. Wacom’s manual lists legacy items across versions, and their presence on a particular Mac still needs confirmation.

See the [investigation methodology](README.md) and the [macOS inventory](macos-tablet-driver-filesystem.json) for evidence categories, hashes, and source links.
