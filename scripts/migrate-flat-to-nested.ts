/**
 * One-time migration: restructures tablet JSON files from the flat field
 * layout to the nested group layout (Meta / Model / Digitizer / Display /
 * Physical / Standalone).
 *
 * Usage:
 *   npx tsx scripts/migrate-flat-to-nested.ts
 *
 * Run from the data-repo root directory.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data", "tablets");

type FlatTablet = Record<string, unknown>;

function migrateTablet(flat: FlatTablet): Record<string, unknown> {
  return {
    Meta: {
      EntityId: flat.EntityId,
      _id: flat._id,
      _CreateDate: flat._CreateDate,
      _ModifiedDate: flat._ModifiedDate,
    },
    Model: {
      Brand: flat.Brand,
      Id: flat.ModelId,
      Name: flat.ModelName,
      Type: flat.ModelType,
      LaunchYear: flat.ModelLaunchYear,
      ...(flat.ModelAudience !== undefined && { Audience: flat.ModelAudience }),
      ...(flat.ModelFamily !== undefined && { Family: flat.ModelFamily }),
      ...(flat.ModelIncludedPen !== undefined && { IncludedPen: flat.ModelIncludedPen }),
      ...(flat.ModelProductLink !== undefined && { ProductLink: flat.ModelProductLink }),
      ...(flat.ModelStatus !== undefined && { Status: flat.ModelStatus }),
    },
    ...(hasDigitizer(flat) && {
      Digitizer: {
        ...(flat.DigitizerType !== undefined && { Type: flat.DigitizerType }),
        ...(flat.DigitizerPressureLevels !== undefined && { PressureLevels: flat.DigitizerPressureLevels }),
        ...(flat.DigitizerDimensions !== undefined && { Dimensions: flat.DigitizerDimensions }),
        ...(flat.DigitizerDensity !== undefined && { Density: flat.DigitizerDensity }),
        ...(flat.DigitizerReportRate !== undefined && { ReportRate: flat.DigitizerReportRate }),
        ...(flat.DigitizerTilt !== undefined && { Tilt: flat.DigitizerTilt }),
        ...(flat.DigitizerAccuracyCenter !== undefined && { AccuracyCenter: flat.DigitizerAccuracyCenter }),
        ...(flat.DigitizerAccuracyCorner !== undefined && { AccuracyCorner: flat.DigitizerAccuracyCorner }),
        ...(flat.DigitizerMaxHover !== undefined && { MaxHover: flat.DigitizerMaxHover }),
        ...(flat.DigitizerSupportsTouch !== undefined && { SupportsTouch: flat.DigitizerSupportsTouch }),
      },
    }),
    ...(hasDisplay(flat) && {
      Display: {
        ...(flat.DisplayPixelDimensions !== undefined && { PixelDimensions: flat.DisplayPixelDimensions }),
        ...(flat.DisplayPanelTech !== undefined && { PanelTech: flat.DisplayPanelTech }),
        ...(flat.DisplayBrightness !== undefined && { Brightness: flat.DisplayBrightness }),
        ...(flat.DisplayBrightnessPeak !== undefined && { BrightnessPeak: flat.DisplayBrightnessPeak }),
        ...(flat.DisplayContrast !== undefined && { Contrast: flat.DisplayContrast }),
        ...(flat.DisplayColorBitDepth !== undefined && { ColorBitDepth: flat.DisplayColorBitDepth }),
        ...(flat.DisplayColorGamuts !== undefined && { ColorGamuts: flat.DisplayColorGamuts }),
        ...(flat.DisplayLamination !== undefined && { Lamination: flat.DisplayLamination }),
        ...(flat.DisplayAntiGlare !== undefined && { AntiGlare: flat.DisplayAntiGlare }),
        ...(flat.DisplayResponseTime !== undefined && { ResponseTime: flat.DisplayResponseTime }),
        ...(flat.DisplayRefreshRate !== undefined && { RefreshRate: flat.DisplayRefreshRate }),
        ...(flat.DisplayViewingAngleHorizontal !== undefined && { ViewingAngleHorizontal: flat.DisplayViewingAngleHorizontal }),
        ...(flat.DisplayViewingAngleVertical !== undefined && { ViewingAngleVertical: flat.DisplayViewingAngleVertical }),
      },
    }),
    ...(hasPhysical(flat) && {
      Physical: {
        ...(flat.PhysicalDimensions !== undefined && { Dimensions: flat.PhysicalDimensions }),
        ...(flat.PhysicalWeight !== undefined && { Weight: flat.PhysicalWeight }),
        ...(flat.PhysicalWeightInclStand !== undefined && { WeightInclStand: flat.PhysicalWeightInclStand }),
      },
    }),
    ...(hasStandalone(flat) && {
      Standalone: {
        ...(flat.ComputeOS !== undefined && { OS: flat.ComputeOS }),
        ...(flat.ComputeProcessor !== undefined && { Processor: flat.ComputeProcessor }),
        ...(flat.ComputeGPU !== undefined && { GPU: flat.ComputeGPU }),
        ...(flat.ComputeRAM !== undefined && { RAM: flat.ComputeRAM }),
        ...(flat.ComputeStorage !== undefined && { Storage: flat.ComputeStorage }),
        ...(flat.ComputeExpandableStorage !== undefined && { ExpandableStorage: flat.ComputeExpandableStorage }),
        ...(flat.ComputeMemoryCardSlot !== undefined && { MemoryCardSlot: flat.ComputeMemoryCardSlot }),
        ...(flat.BatteryCapacity !== undefined && { BatteryCapacity: flat.BatteryCapacity }),
        ...(flat.BatteryLife !== undefined && { BatteryLife: flat.BatteryLife }),
        ...(flat.BatteryChargingWatts !== undefined && { BatteryChargingWatts: flat.BatteryChargingWatts }),
        ...(flat.ConnectivityWifi !== undefined && { Wifi: flat.ConnectivityWifi }),
        ...(flat.ConnectivityBluetooth !== undefined && { Bluetooth: flat.ConnectivityBluetooth }),
        ...(flat.ConnectivityUSB !== undefined && { USB: flat.ConnectivityUSB }),
        ...(flat.HardwareSpeakers !== undefined && { Speakers: flat.HardwareSpeakers }),
        ...(flat.HardwareFrontCamera !== undefined && { FrontCamera: flat.HardwareFrontCamera }),
        ...(flat.HardwareRearCamera !== undefined && { RearCamera: flat.HardwareRearCamera }),
      },
    }),
  };
}

function hasDigitizer(flat: FlatTablet): boolean {
  const keys = [
    "DigitizerType", "DigitizerPressureLevels", "DigitizerDimensions",
    "DigitizerDensity", "DigitizerReportRate", "DigitizerTilt",
    "DigitizerAccuracyCenter", "DigitizerAccuracyCorner",
    "DigitizerMaxHover", "DigitizerSupportsTouch",
  ];
  return keys.some(k => flat[k] !== undefined);
}

function hasDisplay(flat: FlatTablet): boolean {
  const keys = [
    "DisplayPixelDimensions", "DisplayPanelTech", "DisplayBrightness",
    "DisplayBrightnessPeak", "DisplayContrast", "DisplayColorBitDepth",
    "DisplayColorGamuts", "DisplayLamination", "DisplayAntiGlare",
    "DisplayResponseTime", "DisplayRefreshRate",
    "DisplayViewingAngleHorizontal", "DisplayViewingAngleVertical",
  ];
  return keys.some(k => flat[k] !== undefined);
}

function hasPhysical(flat: FlatTablet): boolean {
  const keys = ["PhysicalDimensions", "PhysicalWeight", "PhysicalWeightInclStand"];
  return keys.some(k => flat[k] !== undefined);
}

function hasStandalone(flat: FlatTablet): boolean {
  const keys = [
    "ComputeOS", "ComputeProcessor", "ComputeGPU", "ComputeRAM", "ComputeStorage",
    "ComputeExpandableStorage", "ComputeMemoryCardSlot",
    "BatteryCapacity", "BatteryLife", "BatteryChargingWatts",
    "ConnectivityWifi", "ConnectivityBluetooth", "ConnectivityUSB",
    "HardwareSpeakers", "HardwareFrontCamera", "HardwareRearCamera",
  ];
  return keys.some(k => flat[k] !== undefined);
}

const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith("-tablets.json"));
let totalMigrated = 0;

for (const file of files) {
  const filePath = path.join(DATA_DIR, file);
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw) as { DrawingTablets: FlatTablet[] };

  const migrated = data.DrawingTablets.map(migrateTablet);
  const output = JSON.stringify({ DrawingTablets: migrated }, null, 2);
  fs.writeFileSync(filePath, output + "\n", "utf-8");

  console.log(`  ${file}: ${migrated.length} tablets migrated`);
  totalMigrated += migrated.length;
}

console.log(`\nDone. ${totalMigrated} tablets migrated across ${files.length} files.`);
