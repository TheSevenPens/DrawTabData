import * as fs from "fs";
import * as path from "path";

// --- Types ---

interface Tablet {
  [key: string]: string | undefined;
}

interface TabletFile {
  DrawingTablets: Tablet[];
}

interface Issue {
  file: string;
  entityId: string;
  field: string;
  issue: string;
  value?: string;
}

// --- Field definitions ---

const REQUIRED_FIELDS = [
  "EntityId",
  "ModelBrand",
  "ModelId",
  "ModelName",
  "ModelType",
  "ModelLaunchYear",
  "_id",
  "_CreateDate",
  "_ModifiedDate",
];

const ENUM_FIELDS: Record<string, string[]> = {
  ModelBrand: ["HUION", "WACOM", "XENCELABS", "XPPEN"],
  ModelType: ["PENTABLET", "PENDISPLAY"],
  ModelAudience: ["Consumer", "Enthusiast", "Professional"],
  ModelStatus: ["ACTIVE", "AVAILABLE", "DISCONTINUED"],
  DigitizerType: ["PASSIVE_EMR", "ACTIVE_EMR"],
  DigitizerSupportsTouch: ["YES", "NO"],
  DisplayLamination: ["YES", "NO"],
  DisplayAntiGlare: ["AGFILM", "ETCHEDGLASS", "FILM"],
  DisplayPanelTech: ["IPS", "TFT", "AHVA", "OLED", "H-IPS", "MVA"],
  DisplayColorBitDepth: ["6", "8", "10"],
  PhysicalWeightInclStand: ["YES", "NO"],
};

const NUMERIC_FIELDS = [
  "DigitizerPressureLevels",
  "DigitizerResolution",
  "DigitizerReportRate",
  "DigitizerTilt",
  "DigitizerAccuracyCenter",
  "DigitizerAccuracyCorner",
  "DigitizerMaxHover",
  "DisplayBrightness",
  "DisplayContrast",
  "DisplayResponseTime",
  "DisplayRefreshRate",
  "DisplayViewingAngleHorizontal",
  "DisplayViewingAngleVertical",
  "PhysicalWeight",
];

const DIMENSION_FIELDS: Record<string, number> = {
  DigitizerDimensions: 2, // W x H
  DisplayResolution: 2, // W x H
  PhysicalDimensions: 3, // W x H x D
};

const DISPLAY_ONLY_FIELDS = [
  "DisplayAntiGlare",
  "DisplayBrightness",
  "DisplayColorBitDepth",
  "DisplayColorGamuts",
  "DisplayContrast",
  "DisplayLamination",
  "DisplayPanelTech",
  "DisplayRefreshRate",
  "DisplayResolution",
  "DisplayResponseTime",
  "DisplayViewingAngleHorizontal",
  "DisplayViewingAngleVertical",
];

const ALL_KNOWN_FIELDS = [
  "EntityId",
  "ModelBrand",
  "ModelId",
  "ModelName",
  "ModelType",
  "ModelLaunchYear",
  "ModelAudience",
  "ModelFamily",
  "ModelIncludedPen",
  "ModelProductLink",
  "ModelStatus",
  "DigitizerType",
  "DigitizerPressureLevels",
  "DigitizerDimensions",
  "DigitizerResolution",
  "DigitizerReportRate",
  "DigitizerTilt",
  "DigitizerAccuracyCenter",
  "DigitizerAccuracyCorner",
  "DigitizerMaxHover",
  "DigitizerSupportsTouch",
  ...DISPLAY_ONLY_FIELDS,
  "DisplayColorGamuts",
  "PhysicalDimensions",
  "PhysicalWeight",
  "PhysicalWeightInclStand",
  "_id",
  "_CreateDate",
  "_ModifiedDate",
];

// --- Checks ---

function checkRequired(tablet: Tablet, file: string): Issue[] {
  const issues: Issue[] = [];
  const eid = tablet.EntityId ?? tablet.ModelId ?? "UNKNOWN";
  for (const field of REQUIRED_FIELDS) {
    if (!tablet[field] || tablet[field]!.trim() === "") {
      issues.push({ file, entityId: eid, field, issue: "missing required field" });
    }
  }
  return issues;
}

function checkWhitespace(tablet: Tablet, file: string): Issue[] {
  const issues: Issue[] = [];
  const eid = tablet.EntityId ?? "UNKNOWN";
  for (const [field, value] of Object.entries(tablet)) {
    if (value !== undefined && value !== value.trim()) {
      issues.push({
        file,
        entityId: eid,
        field,
        issue: "value has leading/trailing whitespace",
        value: JSON.stringify(value),
      });
    }
  }
  return issues;
}

function checkEnums(tablet: Tablet, file: string): Issue[] {
  const issues: Issue[] = [];
  const eid = tablet.EntityId ?? "UNKNOWN";
  for (const [field, allowed] of Object.entries(ENUM_FIELDS)) {
    const value = tablet[field];
    if (value !== undefined && !allowed.includes(value)) {
      issues.push({
        file,
        entityId: eid,
        field,
        issue: `invalid value, expected one of: ${allowed.join(", ")}`,
        value,
      });
    }
  }
  return issues;
}

function checkNumeric(tablet: Tablet, file: string): Issue[] {
  const issues: Issue[] = [];
  const eid = tablet.EntityId ?? "UNKNOWN";
  for (const field of NUMERIC_FIELDS) {
    const value = tablet[field];
    if (value !== undefined && isNaN(Number(value))) {
      issues.push({
        file,
        entityId: eid,
        field,
        issue: "expected a numeric value",
        value,
      });
    }
  }
  return issues;
}

function checkDimensions(tablet: Tablet, file: string): Issue[] {
  const issues: Issue[] = [];
  const eid = tablet.EntityId ?? "UNKNOWN";
  for (const [field, expectedParts] of Object.entries(DIMENSION_FIELDS)) {
    const value = tablet[field];
    if (value === undefined) continue;
    const parts = value.split(/\s*x\s*/);
    if (parts.length !== expectedParts || parts.some((p) => isNaN(Number(p)))) {
      issues.push({
        file,
        entityId: eid,
        field,
        issue: `expected format with ${expectedParts} numeric parts separated by " x "`,
        value,
      });
    }
  }
  return issues;
}

function checkEntityId(tablet: Tablet, file: string): Issue[] {
  const issues: Issue[] = [];
  const eid = tablet.EntityId ?? "UNKNOWN";
  if (tablet.ModelBrand && tablet.ModelId) {
    const expected =
      tablet.ModelBrand.toUpperCase() +
      "." +
      tablet.ModelId.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (tablet.EntityId !== expected) {
      issues.push({
        file,
        entityId: eid,
        field: "EntityId",
        issue: `does not match derived value`,
        value: `got "${tablet.EntityId}", expected "${expected}"`,
      });
    }
  }
  return issues;
}

function checkDisplayFieldsOnPenTablet(tablet: Tablet, file: string): Issue[] {
  const issues: Issue[] = [];
  const eid = tablet.EntityId ?? "UNKNOWN";
  if (tablet.ModelType === "PENTABLET") {
    for (const field of DISPLAY_ONLY_FIELDS) {
      if (tablet[field] !== undefined) {
        issues.push({
          file,
          entityId: eid,
          field,
          issue: "display field present on a PENTABLET",
          value: tablet[field],
        });
      }
    }
  }
  return issues;
}

function checkUnknownFields(tablet: Tablet, file: string): Issue[] {
  const issues: Issue[] = [];
  const eid = tablet.EntityId ?? "UNKNOWN";
  for (const field of Object.keys(tablet)) {
    if (!ALL_KNOWN_FIELDS.includes(field)) {
      issues.push({
        file,
        entityId: eid,
        field,
        issue: "unknown field",
      });
    }
  }
  return issues;
}

function checkUuidFormat(tablet: Tablet, file: string): Issue[] {
  const issues: Issue[] = [];
  const eid = tablet.EntityId ?? "UNKNOWN";
  const uuid = tablet._id;
  if (uuid !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uuid)) {
    issues.push({ file, entityId: eid, field: "_id", issue: "invalid UUID format", value: uuid });
  }
  return issues;
}

function checkIsoDate(tablet: Tablet, file: string): Issue[] {
  const issues: Issue[] = [];
  const eid = tablet.EntityId ?? "UNKNOWN";
  for (const field of ["_CreateDate", "_ModifiedDate"]) {
    const value = tablet[field];
    if (value !== undefined && isNaN(Date.parse(value))) {
      issues.push({ file, entityId: eid, field, issue: "invalid ISO 8601 date", value });
    }
  }
  return issues;
}

// --- Runner ---

function checkDuplicateEntityIds(allTablets: { file: string; tablet: Tablet }[]): Issue[] {
  const issues: Issue[] = [];
  const seen = new Map<string, string>();
  for (const { file, tablet } of allTablets) {
    const eid = tablet.EntityId;
    if (!eid) continue;
    const prev = seen.get(eid);
    if (prev) {
      issues.push({
        file,
        entityId: eid,
        field: "EntityId",
        issue: `duplicate EntityId (also in ${prev})`,
      });
    } else {
      seen.set(eid, file);
    }
  }
  return issues;
}

export function runDataQuality(dataDir: string): Issue[] {
  const tabletsDir = path.join(dataDir, "tablets");
  const files = fs.readdirSync(tabletsDir).filter((f) => f.endsWith("-tablets.json"));

  const allIssues: Issue[] = [];
  const allTablets: { file: string; tablet: Tablet }[] = [];

  for (const file of files) {
    const filePath = path.join(tabletsDir, file);
    const raw = fs.readFileSync(filePath, "utf-8");
    const data: TabletFile = JSON.parse(raw);

    for (const tablet of data.DrawingTablets) {
      allTablets.push({ file, tablet });
      allIssues.push(
        ...checkRequired(tablet, file),
        ...checkWhitespace(tablet, file),
        ...checkEnums(tablet, file),
        ...checkNumeric(tablet, file),
        ...checkDimensions(tablet, file),
        ...checkEntityId(tablet, file),
        ...checkDisplayFieldsOnPenTablet(tablet, file),
        ...checkUnknownFields(tablet, file),
        ...checkUuidFormat(tablet, file),
        ...checkIsoDate(tablet, file),
      );
    }
  }

  allIssues.push(...checkDuplicateEntityIds(allTablets));

  return allIssues;
}
