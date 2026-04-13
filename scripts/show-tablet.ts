// Show all populated fields for a specific tablet by EntityId or ModelId.
// Usage: tsx scripts/show-tablet.ts WACOM.TABLET.PTK870
//        tsx scripts/show-tablet.ts PTK870

import * as path from "path";
import { fileURLToPath } from "url";
import { loadTabletsFromDisk, getDiagonal } from "../lib/drawtab-loader-node.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");

const query = process.argv[2];
if (!query) {
  console.error("Usage: tsx scripts/show-tablet.ts <EntityId|ModelId>");
  process.exit(1);
}

const tablets = loadTabletsFromDisk(dataDir);
const tablet = tablets.find(t => t.EntityId === query || t.ModelId === query);

if (!tablet) {
  console.error(`Tablet not found: ${query}`);
  console.error(`Try one of: ${tablets.slice(0, 5).map(t => t.EntityId).join(", ")}...`);
  process.exit(1);
}

console.log(`=== ${tablet.Brand} ${tablet.ModelName} (${tablet.ModelId}) ===\n`);

function printSection(label: string, entries: [string, string][]) {
  const populated = entries.filter(([, v]) => v && v !== "-");
  if (populated.length === 0) return;
  console.log(`--- ${label} ---`);
  const maxKey = Math.max(...populated.map(([k]) => k.length));
  for (const [key, val] of populated) {
    console.log(`  ${key.padEnd(maxKey)}  ${val}`);
  }
  console.log();
}

const diag = getDiagonal(tablet.DigitizerDimensions);
const d = tablet.DigitizerDimensions;
const px = tablet.DisplayPixelDimensions;
const pd = tablet.PhysicalDimensions;
const cg = tablet.DisplayColorGamuts;

printSection("Model", [
  ["EntityId", tablet.EntityId],
  ["Brand", tablet.Brand],
  ["ModelId", tablet.ModelId],
  ["ModelName", tablet.ModelName],
  ["ModelType", tablet.ModelType],
  ["ModelLaunchYear", tablet.ModelLaunchYear],
  ["ModelAudience", tablet.ModelAudience ?? ""],
  ["ModelFamily", tablet.ModelFamily ?? ""],
  ["ModelIncludedPen", (tablet.ModelIncludedPen ?? []).join(", ")],
  ["ModelProductLink", tablet.ModelProductLink ?? ""],
  ["ModelStatus", tablet.ModelStatus ?? ""],
]);

printSection("Digitizer", [
  ["DigitizerType", tablet.DigitizerType ?? ""],
  ["PressureLevels", tablet.DigitizerPressureLevels ?? ""],
  ["ReportRate", tablet.DigitizerReportRate ?? ""],
  ["Density (LPmm)", tablet.DigitizerDensity ?? ""],
  ["Tilt (degrees)", tablet.DigitizerTilt ?? ""],
  ["AccuracyCenter (mm)", tablet.DigitizerAccuracyCenter ?? ""],
  ["AccuracyCorner (mm)", tablet.DigitizerAccuracyCorner ?? ""],
  ["MaxHover (mm)", tablet.DigitizerMaxHover ?? ""],
  ["Touch", tablet.DigitizerSupportsTouch ?? ""],
  ["Dimensions (mm)", d ? `${d.Width} x ${d.Height}` : ""],
  ["Diagonal (mm)", diag ? diag.toFixed(1) : ""],
]);

printSection("Display", [
  ["PanelTech", tablet.DisplayPanelTech ?? ""],
  ["Brightness (cd/m2)", tablet.DisplayBrightness ?? ""],
  ["Contrast", tablet.DisplayContrast ?? ""],
  ["ColorBitDepth", tablet.DisplayColorBitDepth ?? ""],
  ["ColorGamuts", cg ? Object.entries(cg).map(([k, v]) => `${k}: ${v}%`).join(", ") : ""],
  ["Lamination", tablet.DisplayLamination ?? ""],
  ["AntiGlare", tablet.DisplayAntiGlare ?? ""],
  ["ResponseTime (ms)", tablet.DisplayResponseTime ?? ""],
  ["RefreshRate (Hz)", tablet.DisplayRefreshRate ?? ""],
  ["PixelDimensions", px ? `${px.Width} x ${px.Height}` : ""],
  ["ViewingAngle (H/V)", tablet.DisplayViewingAngleHorizontal ? `${tablet.DisplayViewingAngleHorizontal} / ${tablet.DisplayViewingAngleVertical}` : ""],
]);

printSection("Physical", [
  ["Weight (g)", tablet.PhysicalWeight ?? ""],
  ["Dimensions (mm)", pd ? `${pd.Width} x ${pd.Height}${pd.Depth ? ` x ${pd.Depth}` : ""}` : ""],
]);

printSection("System", [
  ["_id", tablet._id],
  ["_CreateDate", tablet._CreateDate],
  ["_ModifiedDate", tablet._ModifiedDate],
]);
