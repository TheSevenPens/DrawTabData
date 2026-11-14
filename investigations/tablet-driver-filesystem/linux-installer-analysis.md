# Linux drawing tablet installer analysis

This analysis covers three official x86-64 Debian packages from Huion, XPPen, and Xencelabs. All three declare a userspace application, an application-menu launcher, a desktop-session autostart entry, and a udev rule. The differences are in the package scripts and in how each driver starts and stores configuration. The packages were read as archives. Installation, removal, and reboot behavior remain untested on a live Linux system.

## Packages inspected

| Brand | Vendor release | DEB package name and version | SHA-256 of the inspected DEB |
| --- | --- | --- | --- |
| Huion | `15.0.0.193` | `HuionTablet`, `15.0.0.193` | `cc563c2358dd0ba13c245f97341d20fecfa8509bfa5c75c8258c895f48b6fa02` |
| XPPen | `4.0.15-260422` | `XPPenLinux`, `4.0` | `414cc9ffb9855520d31874b767920472893af0692b79f851f36c26dc2894aecb` |
| Xencelabs | `1.3.4-26` | `xencelabs`, `1.3.4` | `f2c0094b95fd9af271325d5ac1ebc67cf32a8f4e1160fc5207390db1190f3148` |

Each package declares `amd64`, and the main executables have x86-64 ELF headers. The XPPen and Xencelabs DEB versions omit details present in the vendor release identifiers. Use the DEB hash to distinguish exact samples. The vendor links and file records are in the [Linux inventory](linux-tablet-driver-filesystem.json).

## Declared filesystem paths

| Brand | Application and helpers | Menu and login autostart | Device integration |
| --- | --- | --- | --- |
| Huion | `/usr/lib/huiontablet/` contains `huiontablet`, `huionCore`, their shell wrappers, and a bundled copy of `xdotool` under `xdotool/`. | `/usr/share/applications/huiontablet.desktop` and `/etc/xdg/autostart/huiontablet.desktop` call `huiontablet.sh` with `manual_launch` and `autostart` respectively. | `/usr/lib/udev/rules.d/20-huion.rules`. The package also includes a copy under the application’s `res/rule/` directory. |
| XPPen | `/usr/lib/pentablet/` contains `PenTablet`, `PenTablet.sh`, bundled libraries, and configuration under `conf/xppen/`. | `/usr/share/applications/xppentablet.desktop` and `/etc/xdg/autostart/xppentablet.desktop` call `PenTablet.sh`. The autostart entry adds `/mini`. | `/lib/udev/rules.d/10-xp-pen.rules`. |
| Xencelabs | `/usr/lib/xencelabs/` contains `xencelabs`, `start.sh`, and `restar.sh`. | `/usr/share/applications/xencelabs.desktop` and `/etc/xdg/autostart/xencelabs.desktop` both call `start.sh`. | `/lib/udev/rules.d/10-xencelabs.rules` and `/etc/systemd/system/xencelabs.service`. The unit runs `restar.sh` and declares `WantedBy=multi-user.target`. |

These paths are from the package archives. On distributions where `/lib` resolves to `/usr/lib`, the different udev prefixes can resolve into the same directory. Xencelabs is the only sampled DEB that contains a systemd unit. The unit’s presence and `WantedBy` declaration leave its enabled and active state open.

## What the package scripts do

### Huion

The `postinst` script conditionally copies the bundled `xdotool` to `/bin/xdotool` and `libxdo.so.3` to `/usr/lib/libxdo.so.3` if the respective files are absent. It also checks a distribution-specific destination for the library, `/lib/x86_64-linux-gnu/libxdo.so.3` on Ubuntu or `/usr/lib64/libxdo.so.3` on CentOS. If `/etc/bluetooth/input.conf` exists, the script uncomments a matching `#UserspaceHID=true` line.

The removal scripts attempt to stop the app processes and clean up the application directory, udev rule, and selected per-user PID and log files. The inspected removal scripts contain no corresponding reversal for the copied system tools and libraries or the Bluetooth configuration edit. Those are candidates to check after a live uninstall. [Huion DEB download](https://driverdl.huion.com/driver/Linux/HuionTablet_LinuxDriver_v15.0.0.193.x86_64.deb)

### XPPen

The `postinst` script runs permission changes on selected launchers, app files, bundled libraries, and configuration directories. Its commands add write permissions for all users to the selected paths. The same script creates `/tmp/qtsingleapp-Pentab-9c9b-lockfile`. The `prerm` script attempts to remove that lockfile, and `postrm` prints a completion message.

The `preinst` script also attempts to delete `/var/lib/dpkg/lock` and `/var/lib/dpkg/lock-frontend` if present. This is a package-manager side effect visible in the script. Whether it occurs in a given installation and how it affects that run remain untested. [XPPen Deco Pro SW/MW downloads](https://www.xp-pen.com/download/deco-pro-sw-mw.html)

### Xencelabs

The `postinst` script takes the first username from `who` and tries to copy the bundled configuration into `/home/<user>/.local/share/xencelabs/config/`. It changes permissions on the data directory and the copied configuration and creates `/tmp/qtsingleapp-Xencel-fb8d-lockfile`. Which account receives the copy depends on the sessions visible to `who` when the script runs.

The `postrm` script attempts to remove the lockfile. The `prerm` script exits before reaching its later block that would delete the user-data directory. That makes the copied configuration a specific candidate for post-uninstall verification. [Xencelabs downloads](https://www.xencelabs.com/us/support/download-drivers)

## What to verify on a live system

- **Huion:** Check whether the system helper copies were created, whether the Bluetooth configuration changed, and whether uninstall reverses either effect.
- **XPPen:** Compare file modes before and after installation. Check whether the temporary lockfile is removed and capture package-manager messages during the install.
- **Xencelabs:** Record which account receives the copied configuration, whether the systemd unit is enabled or active, and which user files remain after removal.

For each test, record the DEB hash, distribution and version, login session, and package-manager action. Capture the baseline, installed state, and post-removal state, including after reboot where relevant. Keep live observations separate from the archived package evidence. Wacom’s Linux findings in this investigation concern its native Linux driver stack. This comparison is limited to the three inspected DEBs and does not establish RPM or tar-installer behavior.

See the [investigation methodology](README.md) for how the files were extracted and identified.
