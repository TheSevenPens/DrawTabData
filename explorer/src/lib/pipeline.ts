import { type Tablet } from "../../../lib/drawtab-loader.js";

// --- Step types ---

export type StepKind = "filter" | "sort" | "select" | "take";

export interface FilterStep {
  kind: "filter";
  field: string;
  operator: string;
  value: string;
}

export interface SortStep {
  kind: "sort";
  field: string;
  direction: "asc" | "desc";
}

export interface SelectStep {
  kind: "select";
  fields: string[];
}

export interface TakeStep {
  kind: "take";
  count: number;
}

export type Step = FilterStep | SortStep | SelectStep | TakeStep;

// --- Field metadata ---

export interface FieldDef {
  key: string;
  label: string;
  getValue: (t: Tablet) => string;
  type: "string" | "number" | "enum";
  enumValues?: string[];
}

export const FIELDS: FieldDef[] = [
  { key: "EntityId", label: "Entity ID", getValue: (t) => t.EntityId, type: "string" },
  { key: "ModelBrand", label: "Brand", getValue: (t) => t.ModelBrand, type: "enum", enumValues: ["HUION", "WACOM", "XENCELABS", "XPPEN"] },
  { key: "ModelId", label: "Model ID", getValue: (t) => t.ModelId, type: "string" },
  { key: "ModelName", label: "Name", getValue: (t) => t.ModelName, type: "string" },
  { key: "ModelType", label: "Type", getValue: (t) => t.ModelType, type: "enum", enumValues: ["PENTABLET", "PENDISPLAY"] },
  { key: "ModelLaunchYear", label: "Year", getValue: (t) => t.ModelLaunchYear, type: "number" },
  { key: "ModelAudience", label: "Audience", getValue: (t) => t.ModelAudience ?? "", type: "enum", enumValues: ["Consumer", "Enthusiast", "Professional"] },
  { key: "ModelFamily", label: "Family", getValue: (t) => t.ModelFamily ?? "", type: "string" },
  { key: "ModelStatus", label: "Status", getValue: (t) => t.ModelStatus ?? "", type: "enum", enumValues: ["ACTIVE", "AVAILABLE", "DISCONTINUED"] },
  { key: "ModelIncludedPen", label: "Included Pen", getValue: (t) => t.ModelIncludedPen ?? "", type: "string" },
  { key: "DigitizerType", label: "Digitizer Type", getValue: (t) => t.DigitizerType ?? "", type: "enum", enumValues: ["PASSIVE_EMR", "ACTIVE_EMR"] },
  { key: "DigitizerPressureLevels", label: "Pressure Levels", getValue: (t) => t.DigitizerPressureLevels ?? "", type: "number" },
  { key: "DigitizerReportRate", label: "Report Rate", getValue: (t) => t.DigitizerReportRate ?? "", type: "number" },
  { key: "DigitizerResolution", label: "Digitizer Resolution", getValue: (t) => t.DigitizerResolution ?? "", type: "number" },
  { key: "DigitizerTilt", label: "Tilt", getValue: (t) => t.DigitizerTilt ?? "", type: "number" },
  { key: "DigitizerAccuracyCenter", label: "Accuracy (Center)", getValue: (t) => t.DigitizerAccuracyCenter ?? "", type: "number" },
  { key: "DigitizerAccuracyCorner", label: "Accuracy (Corner)", getValue: (t) => t.DigitizerAccuracyCorner ?? "", type: "number" },
  { key: "DigitizerMaxHover", label: "Max Hover", getValue: (t) => t.DigitizerMaxHover ?? "", type: "number" },
  { key: "DigitizerSupportsTouch", label: "Touch", getValue: (t) => t.DigitizerSupportsTouch ?? "", type: "enum", enumValues: ["YES", "NO"] },
  {
    key: "DigitizerDimensions", label: "Active Area",
    getValue: (t) => { const d = t.DigitizerDimensions; return d ? `${d.Width} x ${d.Height}` : ""; },
    type: "string",
  },
  { key: "DisplayPanelTech", label: "Panel Tech", getValue: (t) => t.DisplayPanelTech ?? "", type: "enum", enumValues: ["IPS", "TFT", "AHVA", "OLED", "H-IPS", "MVA"] },
  { key: "DisplayBrightness", label: "Brightness", getValue: (t) => t.DisplayBrightness ?? "", type: "number" },
  { key: "DisplayContrast", label: "Contrast", getValue: (t) => t.DisplayContrast ?? "", type: "number" },
  { key: "DisplayColorBitDepth", label: "Bit Depth", getValue: (t) => t.DisplayColorBitDepth ?? "", type: "number" },
  { key: "DisplayLamination", label: "Lamination", getValue: (t) => t.DisplayLamination ?? "", type: "enum", enumValues: ["YES", "NO"] },
  { key: "DisplayAntiGlare", label: "Anti-Glare", getValue: (t) => t.DisplayAntiGlare ?? "", type: "enum", enumValues: ["AGFILM", "ETCHEDGLASS", "FILM"] },
  { key: "DisplayResponseTime", label: "Response Time", getValue: (t) => t.DisplayResponseTime ?? "", type: "number" },
  { key: "DisplayRefreshRate", label: "Refresh Rate", getValue: (t) => t.DisplayRefreshRate ?? "", type: "number" },
  {
    key: "DisplayResolution", label: "Display Resolution",
    getValue: (t) => { const d = t.DisplayResolution; return d ? `${d.Width} x ${d.Height}` : ""; },
    type: "string",
  },
  { key: "PhysicalWeight", label: "Weight (g)", getValue: (t) => t.PhysicalWeight ?? "", type: "number" },
  {
    key: "PhysicalDimensions", label: "Physical Dimensions",
    getValue: (t) => {
      const d = t.PhysicalDimensions;
      if (!d) return "";
      return d.Depth ? `${d.Width} x ${d.Height} x ${d.Depth}` : `${d.Width} x ${d.Height}`;
    },
    type: "string",
  },
];

const FIELD_MAP = new Map(FIELDS.map((f) => [f.key, f]));

export function getFieldDef(key: string): FieldDef | undefined {
  return FIELD_MAP.get(key);
}

// --- Default visible columns ---

export const DEFAULT_COLUMNS = [
  "EntityId", "ModelBrand", "ModelName", "ModelType", "ModelLaunchYear",
  "DigitizerPressureLevels", "DigitizerTilt", "DigitizerDimensions",
  "DisplayResolution", "PhysicalWeight", "ModelStatus",
];

// --- Operators ---

export function getOperatorsForField(fieldDef: FieldDef): { value: string; label: string }[] {
  if (fieldDef.type === "enum") {
    return [
      { value: "==", label: "equals" },
      { value: "!=", label: "not equals" },
    ];
  }
  if (fieldDef.type === "number") {
    return [
      { value: "==", label: "=" },
      { value: "!=", label: "!=" },
      { value: ">", label: ">" },
      { value: ">=", label: ">=" },
      { value: "<", label: "<" },
      { value: "<=", label: "<=" },
      { value: "empty", label: "is empty" },
      { value: "notempty", label: "is not empty" },
    ];
  }
  return [
    { value: "==", label: "equals" },
    { value: "!=", label: "not equals" },
    { value: "contains", label: "contains" },
    { value: "startswith", label: "starts with" },
    { value: "empty", label: "is empty" },
    { value: "notempty", label: "is not empty" },
  ];
}

// --- Pipeline execution ---

export function executePipeline(tablets: Tablet[], steps: Step[]): { data: Tablet[]; visibleFields: string[] } {
  let data = [...tablets];
  let visibleFields: string[] | null = null;

  for (const step of steps) {
    switch (step.kind) {
      case "filter":
        data = applyFilter(data, step);
        break;
      case "sort":
        data = applySort(data, step);
        break;
      case "select":
        visibleFields = step.fields;
        break;
      case "take":
        data = data.slice(0, step.count);
        break;
    }
  }

  return { data, visibleFields: visibleFields ?? DEFAULT_COLUMNS };
}

function applyFilter(tablets: Tablet[], step: FilterStep): Tablet[] {
  const fieldDef = getFieldDef(step.field);
  if (!fieldDef) return tablets;

  return tablets.filter((t) => {
    const val = fieldDef.getValue(t);
    switch (step.operator) {
      case "==": return val === step.value;
      case "!=": return val !== step.value;
      case "contains": return val.toLowerCase().includes(step.value.toLowerCase());
      case "startswith": return val.toLowerCase().startsWith(step.value.toLowerCase());
      case "empty": return val === "";
      case "notempty": return val !== "";
      case ">": return val !== "" && Number(val) > Number(step.value);
      case ">=": return val !== "" && Number(val) >= Number(step.value);
      case "<": return val !== "" && Number(val) < Number(step.value);
      case "<=": return val !== "" && Number(val) <= Number(step.value);
      default: return true;
    }
  });
}

function applySort(tablets: Tablet[], step: SortStep): Tablet[] {
  const fieldDef = getFieldDef(step.field);
  if (!fieldDef) return tablets;

  return [...tablets].sort((a, b) => {
    const va = fieldDef.getValue(a);
    const vb = fieldDef.getValue(b);
    const cmp = va.localeCompare(vb, undefined, { numeric: true });
    return step.direction === "asc" ? cmp : -cmp;
  });
}
