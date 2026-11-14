# How the tablet driver JSON inventories were built

The inventories describe drawing-tablet drivers on Windows, macOS, and Linux. They combine direct inspection of versioned installer downloads with vendor documentation and independent observations. Their purpose is to help an analyst identify a file or package, trace the evidence for its location, and decide what still needs to be checked on a live system.

## Dataset files

| File | Directly inspected payloads | Extracted file records |
| --- | --- | ---: |
| [Windows](windows-tablet-driver-filesystem.json) | Wacom, Huion, XPPen, and Xencelabs, including selected Windows ARM64 payloads | 192 |
| [macOS](macos-tablet-driver-filesystem.json) | Wacom, Huion, XPPen, and Xencelabs | 459 |
| [Linux](linux-tablet-driver-filesystem.json) | Huion, XPPen, and Xencelabs DEB packages | 169 |

The files share a schema version of `1.1` and the same core collections. The Linux inventory also records sourced observations about distribution and community drivers, including the Wacom stack. Selected additional manufacturers have documentation-only coverage. The file counts represent selected payload members and do not measure the size of a complete installation.

The scope is external drawing tablets and pen displays. The inventories cover a selection of exact driver builds and retain earlier documented paths when the source did not identify a build. They were assembled from evidence available on November 14, 2026.

## From sources to records

1. **Find a build-specific source.** Use official vendor model catalogs, release notes, and download links to establish the identity of a sample. Use vendor cleanup instructions and independent inventory or community reports to establish which paths were documented or reported on particular systems. A model catalog entry and a third-party observation can describe different builds, so each claim keeps its own version and source references.
2. **Fingerprint the download.** Record the enclosing driver release as `driver_version`, retain the download URL, and hash the actual bytes with SHA-256. Where a download wraps another package, retain the identity of the inspected layer when available. For example, the macOS records can identify both a distribution archive and its component PKG.
3. **Unpack without running.** Inspect the installer or package as an archive. Read its manifests, executable headers, and selected configuration files and scripts. Do not infer that a bundled script ran or that an archive path was written to the live filesystem.
4. **Record file identity and path evidence separately.** Each selected extracted file receives a build reference, archive path, SHA-256, size, and any available architecture, version, or signing data. Filesystem claims capture documented, reported, or package-declared locations. Driver Store candidates are recorded as places to verify.
5. **Join and check.** Resolve each source reference and file link. Where an installer contains multiple same-name binaries, retain the separate records. Check the build, architecture, archive path, and hash before treating records as equivalent.

## What was read on each platform

### Windows

- Used archive listings and extraction for the sampled installers. This included Windows `tar` for Wacom, Inno Setup readers for XPPen and Xencelabs, and Python ZIP parsing for Huion’s embedded archives. The Huion records can include the offset of a ZIP's end-of-central-directory header so the archive segment can be identified again.
- Read PE machine headers, Windows file version resources, and file sizes. Checked extracted binaries and catalogs with `Get-AuthenticodeSignature`. The installer’s signer and signature status are separate from those of the files it contains.
- Read original INF names, `DriverVer`, catalog declarations, and service names. For selected ARM64 packages, recorded the INF, CAT, and SYS fingerprints together. An INF-to-catalog link records the INF declaration. Membership of an individual file in that catalog was not verified.
- Compared package members byte for byte. The selected x64 XPPen and Xencelabs builds ship identical VMulti and Hanvon Ugee mouse-filter package members. The inspected ARM64 mouse filters share a filename and have different hashes. Preserve the architecture and exact build when analyzing either comparison.
- Stored Windows cleanup-path reports separately from payload evidence. A filesystem claim can reference candidate installer bytes for the same build, even when the bytes on the reported system were never captured.

### macOS

- Listed and extracted the DMG or ZIP contents. For flat PKGs, read the XAR package metadata and unpacked the CPIO payload. For Huion’s sampled app distribution, inspected the app bundle and selected embedded helpers directly.
- Read `PackageInfo` for declared installation roots, package identifiers, and component versions. Where available, read bundle identifiers, short versions, build versions, and executable names from `Info.plist`.
- Read Mach-O headers for each executable slice. For embedded code signatures, captured CodeDirectory identifiers, team IDs, flags, and hashes where present. For component PKGs, captured signer certificate subjects, issuers, and SHA-256 certificate fingerprints from the XAR signature metadata.
- Recorded package-declared paths separately from vendor cleanup paths. macOS signature trust, notarization, Gatekeeper acceptance, and the results of installation scripts were outside the static inspection.

### Linux

- Read each sampled DEB as an `ar` archive and inspected its `control.tar` and `data.tar` members. Captured the package name, version, architecture, maintainer, and dependencies from the control file. Kept the vendor release version separate from the DEB's declared package version.
- Read ELF headers for binary architecture. Recorded checksums, declared paths, file modes, and symlink targets where represented in the payload. A symlink record hashes its target string.
- Included relevant executable, service, desktop, rules, and configuration files where present. Maintainer scripts are archive records with no installed destination assumed. External files created by scripts require a separate check. Package and repository signature verification was outside this inspection.

## How to read and join the JSON

- **`builds`** maps a build key to the sample's brand, exact enclosing driver version, package metadata, hash, and sources.
- **`claims`** records assertions about artifacts. Start here to analyze locations, evidence status, and coverage. Each claim has its own `source_ids`. A null `driver_version` means the source did not identify an exact build. A null `folder` means the record asserts no installed folder.
- **`files`** maps a file ID to exact extracted bytes and their metadata. Follow `claims[].payload_file_ids` to look up candidate file records. Use `build_id` to join each file to its versioned sample. Windows package claims may also link to files through `payload_members[].payload_file_ids`.
- **`sources`** resolves source IDs within that JSON file. Cross-platform joins should include `platform` because build keys and source IDs are local to a dataset.
- **`file_metadata_method`**, **`evidence_status`**, and platform-specific notes explain what each result can support. For example, Windows Authenticode results describe a check performed on the inspection machine. A `NotSigned` result for an extracted file leaves possible catalog coverage open.

For a practical match, start with platform, brand, and exact build, then compare the file's architecture and SHA-256. Use bundle IDs, package identifiers, signer details, or INF metadata to investigate ambiguous names. Compare installer release versions and component versions in their respective fields.

## Reproducing the investigation

Choose an exact build from the `builds` collection, resolve its download sources, and check the SHA-256 of the downloaded package against `installer_sha256` before inspecting it. Download links can move or be replaced. If the hash differs, record a new sample and preserve the existing build evidence.

Inspect the package as described above, using the archive member paths in `files` to locate the bytes. Validate that all source and file links resolve, each linked file belongs to the asserted build, and same-name variants remain independently addressable. Track any later live install, removal, or device-binding observation as new evidence.

The investigation directory contains the published data and this methodology. The original extraction scripts, downloaded packages, and local intermediate files were used during the research outside this repository.
