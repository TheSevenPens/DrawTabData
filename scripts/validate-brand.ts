// Run data quality checks for a single brand's tablet file.
// Usage: tsx scripts/validate-brand.ts XPPEN
//        tsx scripts/validate-brand.ts HUION

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import * as v from "valibot";
import { TabletSchema } from "../lib/schemas.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");

const brand = process.argv[2]?.toUpperCase();
if (!brand) {
  console.error("Usage: tsx scripts/validate-brand.ts <BRAND>");
  const files = fs.readdirSync(path.join(dataDir, "tablets")).filter(f => f.endsWith("-tablets.json"));
  console.error(`\nAvailable brands: ${files.map(f => f.replace("-tablets.json", "")).join(", ")}`);
  process.exit(1);
}

const filePath = path.join(dataDir, "tablets", `${brand}-tablets.json`);
if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
const tablets = data.DrawingTablets ?? [];

console.log(`Validating ${tablets.length} tablet(s) from ${brand}-tablets.json...\n`);

let issueCount = 0;

for (const tablet of tablets) {
  const result = v.safeParse(TabletSchema, tablet);
  if (!result.success) {
    issueCount++;
    const id = tablet.EntityId || tablet.ModelId || "(unknown)";
    console.log(`--- ${id} ---`);
    for (const issue of result.issues) {
      const pathStr = issue.path?.map((p: any) => p.key).join(".") || "(root)";
      console.log(`  ${pathStr}: ${issue.message}`);
    }
    console.log();
  }
}

// Check for duplicate EntityIds
const entityIds = tablets.map((t: any) => t.EntityId).filter(Boolean);
const seen = new Set<string>();
for (const id of entityIds) {
  if (seen.has(id)) {
    issueCount++;
    console.log(`Duplicate EntityId: ${id}`);
  }
  seen.add(id);
}

if (issueCount === 0) {
  console.log("No issues found.");
} else {
  console.log(`${issueCount} issue(s) found.`);
  process.exit(1);
}
