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
  computed?: boolean;
  group: string;
}

export const FIELD_GROUPS = ["Model", "Digitizer", "Display", "Physical", "Computed"];

export const FIELDS: FieldDef[] = [
  // Model
  { key: "EntityId", label: "Entity ID", getValue: (t) => t.EntityId, type: "string", group: "Model" },
  { key: "ModelBrand", label: "Brand", getValue: (t) => t.ModelBrand, type: "enum", enumValues: ["HUION", "WACOM", "XENCELABS", "XPPEN"], group: "Model" },
  { key: "ModelId", label: "Model ID", getValue: (t) => t.ModelId, type: "string", group: "Model" },
  { key: "ModelName", label: "Name", getValue: (t) => t.ModelName, type: "string", group: "Model" },
  { key: "ModelType", label: "Type", getValue: (t) => t.ModelType, type: "enum", enumValues: ["PENTABLET", "PENDISPLAY"], group: "Model" },
  { key: "ModelLaunchYear", label: "Year", getValue: (t) => t.ModelLaunchYear, type: "number", group: "Model" },
  { key: "ModelAudience", label: "Audience", getValue: (t) => t.ModelAudience ?? "", type: "enum", enumValues: ["Consumer", "Enthusiast", "Professional"], group: "Model" },
  { key: "ModelFamily", label: "Family", getValue: (t) => t.ModelFamily ?? "", type: "string", group: "Model" },
  { key: "ModelStatus", label: "Status", getValue: (t) => t.ModelStatus ?? "", type: "enum", enumValues: ["ACTIVE", "AVAILABLE", "DISCONTINUED"], group: "Model" },
  { key: "ModelIncludedPen", label: "Included Pen", getValue: (t) => t.ModelIncludedPen ?? "", type: "string", group: "Model" },
  // Digitizer
  { key: "DigitizerType", label: "Digitizer Type", getValue: (t) => t.DigitizerType ?? "", type: "enum", enumValues: ["PASSIVE_EMR", "ACTIVE_EMR"], group: "Digitizer" },
  { key: "DigitizerPressureLevels", label: "Pressure Levels", getValue: (t) => t.DigitizerPressureLevels ?? "", type: "number", group: "Digitizer" },
  { key: "DigitizerReportRate", label: "Report Rate", getValue: (t) => t.DigitizerReportRate ?? "", type: "number", group: "Digitizer" },
  { key: "DigitizerResolution", label: "Digitizer Resolution", getValue: (t) => t.DigitizerResolution ?? "", type: "number", group: "Digitizer" },
  { key: "DigitizerTilt", label: "Tilt", getValue: (t) => t.DigitizerTilt ?? "", type: "number", group: "Digitizer" },
  { key: "DigitizerAccuracyCenter", label: "Accuracy (Center)", getValue: (t) => t.DigitizerAccuracyCenter ?? "", type: "number", group: "Digitizer" },
  { key: "DigitizerAccuracyCorner", label: "Accuracy (Corner)", getValue: (t) => t.DigitizerAccuracyCorner ?? "", type: "number", group: "Digitizer" },
  { key: "DigitizerMaxHover", label: "Max Hover", getValue: (t) => t.DigitizerMaxHover ?? "", type: "number", group: "Digitizer" },
  { key: "DigitizerSupportsTouch", label: "Touch", getValue: (t) => t.DigitizerSupportsTouch ?? "", type: "enum", enumValues: ["YES", "NO"], group: "Digitizer" },
  {
    key: "DigitizerDimensions", label: "Active Area", group: "Digitizer",
    getValue: (t) => { const d = t.DigitizerDimensions; return d ? `${d.Width} x ${d.Height}` : ""; },
    type: "string",
  },
  // Display
  { key: "DisplayPanelTech", label: "Panel Tech", getValue: (t) => t.DisplayPanelTech ?? "", type: "enum", enumValues: ["IPS", "TFT", "AHVA", "OLED", "H-IPS", "MVA"], group: "Display" },
  { key: "DisplayBrightness", label: "Brightness", getValue: (t) => t.DisplayBrightness ?? "", type: "number", group: "Display" },
  { key: "DisplayContrast", label: "Contrast", getValue: (t) => t.DisplayContrast ?? "", type: "number", group: "Display" },
  { key: "DisplayColorBitDepth", label: "Bit Depth", getValue: (t) => t.DisplayColorBitDepth ?? "", type: "number", group: "Display" },
  { key: "DisplayLamination", label: "Lamination", getValue: (t) => t.DisplayLamination ?? "", type: "enum", enumValues: ["YES", "NO"], group: "Display" },
  { key: "DisplayAntiGlare", label: "Anti-Glare", getValue: (t) => t.DisplayAntiGlare ?? "", type: "enum", enumValues: ["AGFILM", "ETCHEDGLASS", "FILM"], group: "Display" },
  { key: "DisplayResponseTime", label: "Response Time", getValue: (t) => t.DisplayResponseTime ?? "", type: "number", group: "Display" },
  { key: "DisplayRefreshRate", label: "Refresh Rate", getValue: (t) => t.DisplayRefreshRate ?? "", type: "number", group: "Display" },
  {
    key: "DisplayResolution", label: "Display Resolution", group: "Display",
    getValue: (t) => { const d = t.DisplayResolution; return d ? `${d.Width} x ${d.Height}` : ""; },
    type: "string",
  },
  // Physical
  { key: "PhysicalWeight", label: "Weight (g)", getValue: (t) => t.PhysicalWeight ?? "", type: "number", group: "Physical" },
  {
    key: "PhysicalDimensions", label: "Physical Dimensions", group: "Physical",
    getValue: (t) => {
      const d = t.PhysicalDimensions;
      if (!d) return "";
      return d.Depth ? `${d.Width} x ${d.Height} x ${d.Depth}` : `${d.Width} x ${d.Height}`;
    },
    type: "string",
  },
  // Computed
  {
    key: "Age", label: "Age (years)", computed: true, type: "number", group: "Computed",
    getValue: (t) => {
      const year = parseInt(t.ModelLaunchYear, 10);
      return isNaN(year) ? "" : String(new Date().getFullYear() - year);
    },
  },
];

const FIELD_MAP = new Map(FIELDS.map((f) => [f.key, f]));

export function getFieldDef(key: string): FieldDef | undefined {
  return FIELD_MAP.get(key);
}

// --- Default visible columns ---

export const DEFAULT_COLUMNS = [
  "EntityId", "ModelBrand", "ModelName", "ModelType", "ModelLaunchYear", "Age",
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
