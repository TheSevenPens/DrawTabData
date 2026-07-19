#!/usr/bin/env node
/**
 * Pulls OpenTabletDriver's per-model tablet configurations from GitHub into
 * data/otd/otd-tablets.json — a reference dataset of the authoritative OTD
 * model `Name` (plus USB identifiers) for every configured tablet.
 *
 * Unlike extract-wacom-products.mjs (which parses a cached source file), this
 * fetches over the network so it can be re-run whenever OTD updates upstream.
 * It is deterministic: it resolves the ref to a commit SHA and pins every
 * file read to that SHA, so re-running with OTD unchanged rewrites an
 * identical file (no wall-clock noise — provenance is the commit, not "now").
 *
 * Usage:
 *   node scripts/extract-otd-configs.mjs            # latest master
 *   node scripts/extract-otd-configs.mjs <ref|sha>  # pin to a ref or SHA
 *   GITHUB_TOKEN=… node scripts/extract-otd-configs.mjs   # raise API limit
 *
 * Source: github.com/OpenTabletDriver/OpenTabletDriver
 *   glob  OpenTabletDriver.Configurations/Configurations/<Vendor>/<Model>.json
 *   field top-level "Name" is the model key (NOT the filename, NOT ProductID —
 *         many models share a VendorID+ProductID pair; see issue #308).
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const OWNER = 'OpenTabletDriver';
const REPO = 'OpenTabletDriver';
const PREFIX = 'OpenTabletDriver.Configurations/Configurations/';
const REF = process.argv[2] || 'master';
const CONCURRENCY = 12;

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'data', 'otd');
const outPath = join(outDir, 'otd-tablets.json');

const token = process.env.GITHUB_TOKEN;
const apiHeaders = {
	'User-Agent': 'DrawTabDataExplorer',
	Accept: 'application/vnd.github+json',
	...(token ? { Authorization: `Bearer ${token}` } : {}),
};

async function api(path) {
	const res = await fetch(`https://api.github.com/${path}`, { headers: apiHeaders });
	if (!res.ok) throw new Error(`GitHub API ${res.status} for ${path}: ${await res.text()}`);
	return res.json();
}

// 1. Resolve the ref to an immutable commit SHA (so file reads are reproducible).
const commit = await api(`repos/${OWNER}/${REPO}/commits/${REF}`);
const sha = commit.sha;
const commitDate = commit.commit?.committer?.date ?? commit.commit?.author?.date ?? null;
console.log(`OTD ${OWNER}/${REPO} @ ${REF} -> ${sha} (${commitDate})`);

// 2. One tree call at that SHA; keep only <Vendor>/<Model>.json (one level deep).
const tree = await api(`repos/${OWNER}/${REPO}/git/trees/${sha}?recursive=1`);
const paths = tree.tree
	.filter((n) => n.type === 'blob')
	.map((n) => n.path)
	.filter((p) => p.startsWith(PREFIX) && p.toLowerCase().endsWith('.json'))
	.map((p) => p.slice(PREFIX.length))
	.filter((rel) => (rel.match(/\//g) || []).length === 1);
console.log(`${paths.length} config files under ${PREFIX}*/*.json`);

// 3. Read each config at the pinned SHA, BOM-tolerant, and pull Name + IDs.
const rawUrl = (rel) =>
	`https://raw.githubusercontent.com/${OWNER}/${REPO}/${sha}/${encodeURI(PREFIX + rel)}`;

const results = new Array(paths.length);
let idx = 0;
const failures = [];
async function worker() {
	while (idx < paths.length) {
		const i = idx++;
		const rel = paths[i];
		try {
			const res = await fetch(rawUrl(rel), { headers: { 'User-Agent': 'DrawTabDataExplorer' } });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const j = JSON.parse((await res.text()).replace(/^﻿/, ''));
			const ids = Array.isArray(j.DigitizerIdentifiers) ? j.DigitizerIdentifiers : [];
			results[i] = {
				vendor: rel.split('/')[0],
				file: rel,
				name: typeof j.Name === 'string' ? j.Name : null,
				identifiers: ids.map((d) => ({
					vendorID: typeof d?.VendorID === 'number' ? d.VendorID : null,
					productID: typeof d?.ProductID === 'number' ? d.ProductID : null,
				})),
			};
		} catch (e) {
			failures.push(`${rel}: ${e.message}`);
		}
	}
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const tablets = results.filter(Boolean).sort((a, b) => a.file.localeCompare(b.file));
if (failures.length) {
	console.error(`WARNING: ${failures.length} config(s) failed:\n  ${failures.slice(0, 10).join('\n  ')}`);
	process.exitCode = 1;
}
const missingName = tablets.filter((t) => !t.name);
if (missingName.length) console.error(`WARNING: ${missingName.length} config(s) had no Name field`);

const out = {
	source: {
		repo: `${OWNER}/${REPO}`,
		ref: REF,
		commit: sha,
		commitDate,
		configGlob: `${PREFIX}*/*.json`,
	},
	tablets,
};

mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(`Wrote ${tablets.length} OTD tablets to ${outPath}`);
