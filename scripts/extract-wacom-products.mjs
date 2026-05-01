#!/usr/bin/env node
/**
 * Extracts Wacom-update product data from data/wacom-update/source.xml
 * into data/wacom-update/products.json.
 *
 * Refresh source.xml from `link.wacom.com/wdc/update.xml` first; this
 * script doesn't fetch over the network.
 *
 * Usage: node scripts/extract-wacom-products.mjs
 *
 * Originally lived in TheSevenPens/Wacom-Driver-List
 * (scripts/extract-products.js); moved here on 2026-05-01 as part of
 * the Wacom-Driver-List → DrawTabDataExplorer migration.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const xmlPath = join(root, 'data', 'wacom-update', 'source.xml');
const outPath = join(root, 'data', 'wacom-update', 'products.json');

const xml = readFileSync(xmlPath, 'utf8');

function parseProducts(section) {
	const products = [];
	const productRegex = /<ArrayElement type="map">([\s\S]*?)<\/ArrayElement>/g;
	let m;
	while ((m = productRegex.exec(section)) !== null) {
		const block = m[1];
		const get = (tag) => {
			const r = new RegExp('<' + tag + ' type="(?:string|integer|bool)">(.*?)</' + tag + '>');
			const found = r.exec(block);
			return found ? found[1] : null;
		};
		const name = get('name');
		if (!name) continue;
		products.push({
			name,
			sensorid: get('sensorid'),
			model: get('model'),
			drivermin: get('drivermin'),
			drivermax: get('drivermax'),
		});
	}
	return products;
}

function getProductsSection(platformXml) {
	const m = platformXml.match(/<products type="array">([\s\S]*)<\/products>/);
	return m ? m[1] : '';
}

const winMatch = xml.match(/<win type="map">([\s\S]*?)<\/win>/);
const macMatch = xml.match(/<mac type="map">([\s\S]*?)<\/mac>/);

const winProducts = winMatch ? parseProducts(getProductsSection(winMatch[1])) : [];
const macProducts = macMatch ? parseProducts(getProductsSection(macMatch[1])) : [];

// Merge by name, deduplicate platforms
const merged = new Map();
for (const p of winProducts) {
	merged.set(p.name, { ...p, platforms: ['Windows'] });
}
for (const p of macProducts) {
	if (merged.has(p.name)) {
		const existing = merged.get(p.name);
		if (!existing.platforms.includes('MacOS')) existing.platforms.push('MacOS');
		if (!existing.model && p.model) existing.model = p.model;
	} else {
		merged.set(p.name, { ...p, platforms: ['MacOS'] });
	}
}

// Fix known-incorrect model numbers from the manifest
const modelFixes = {
	CTC6110BT: 'CTC6110WL',
	CTC4110BT: 'CTC4110WL',
};
function fixModel(model) {
	return model && modelFixes[model] ? modelFixes[model] : model;
}

// Manifest entries that don't correspond to real shipped tablets
const removeModels = ['PT470BT', 'PTK870K022D', 'PTK870BT', 'PTK670BT'];

// Normalize: strip dash from DTH-/DTK-/DTU- name prefixes (DTC unaffected)
const modelPrefixes = ['DTH-', 'DTK-', 'DTU-'];
function normalizeName(name) {
	for (const prefix of modelPrefixes) {
		if (name.startsWith(prefix)) name = prefix.slice(0, 3) + name.slice(prefix.length);
	}
	return name;
}

const modelStarts = ['DTH', 'DTK', 'DTU', 'DTC'];
function looksLikeModelNumber(name) {
	return modelStarts.some((p) => name.startsWith(p));
}

const result = [...merged.values()]
	.filter((p) => !removeModels.includes(p.model))
	.map((p) => {
		p.name = normalizeName(p.name);
		p.model = fixModel(p.model);
		if (!p.model && looksLikeModelNumber(p.name)) p.model = p.name;
		return p;
	})
	.sort((a, b) => a.name.localeCompare(b.name));

writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
console.log(`Wrote ${result.length} products to ${outPath}`);
