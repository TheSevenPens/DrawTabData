import type { Tablet } from "../drawtab-loader.js";
import { brandName } from "../drawtab-loader.js";
import type { FieldDef, Step } from "../pipeline/types.js";

function notApplicable(t: Tablet): boolean {
  return t.ModelType === "PENTABLET";
}

function displayVal(t: Tablet, val: string | undefined): string {
  if (notApplicable(t)) return "-";
  return val ?? "";
}

export const TABLET_FIELD_GROUPS = ["Model", "Digitizer", "Display", "Physical", "Standalone"];

export const TABLET_FIELDS: FieldDef<Tablet>[] = [
  // Model
  { key: "EntityId", label: "Entity ID", getValue: (t) => t.EntityId, type: "string", group: "Model" },
  { key: "FullName", label: "Full Name", getValue: (t) => `${brandName(t.Brand)} ${t.ModelName} (${t.ModelId})`, type: "string", group: "Model", computed: true },
  { key: "Brand", label: "Brand", getValue: (t) => t.Brand, type: "enum", enumValues: ["GAOMON", "HUION", "SAMSUNG", "UGEE", "WACOM", "XENCELABS", "XPPEN"], group: "Model" },
  { key: "ModelId", label: "Model ID", getValue: (t) => t.ModelId, type: "string", group: "Model" },
  { key: "ModelName", label: "Name", getValue: (t) => t.ModelName, type: "string", group: "Model" },
  { key: "ModelType", label: "Type", getValue: (t) => t.ModelType, type: "enum", enumValues: ["PENTABLET", "PENDISPLAY", "STANDALONE"], group: "Model" },
  { key: "ModelLaunchYear", label: "Year", getValue: (t) => t.ModelLaunchYear, type: "number", group: "Model" },
  {
    key: "Age", label: "Age (years)", computed: true, type: "number", group: "Model",
    getValue: (t) => {
      const year = parseInt(t.ModelLaunchYear, 10);
      return isNaN(year) ? "" : String(new Date().getFullYear() - year);
    },
  },
  { key: "ModelAudience", label: "Audience", getValue: (t) => t.ModelAudience ?? "", type: "enum", enumValues: ["Consumer", "Enthusiast", "Professional"], group: "Model" },
  { key: "ModelFamily", label: "Family", getValue: (t) => t.ModelFamily ?? "", type: "string", group: "Model" },
  { key: "ModelStatus", label: "Status", getValue: (t) => t.ModelStatus ?? "", type: "enum", enumValues: ["ACTIVE", "AVAILABLE", "DISCONTINUED"], group: "Model" },
  { key: "ModelIncludedPen", label: "Included Pen", getValue: (t) => (t.ModelIncludedPen ?? []).join(", "), type: "string", group: "Model" },
  // Digitizer
  { key: "DigitizerType", label: "Digitizer Type", getValue: (t) => t.DigitizerType ?? "", type: "enum", enumValues: ["PASSIVE_EMR", "ACTIVE_EMR"], group: "Digitizer" },
  { key: "DigitizerPressureLevels", label: "Pressure Levels", getValue: (t) => t.DigitizerPressureLevels ?? "", type: "number", group: "Digitizer" },
  { key: "DigitizerReportRate", label: "Report Rate (Hz)", getValue: (t) => t.DigitizerReportRate ?? "", type: "number", group: "Digitizer" },
  { key: "DigitizerDensity", label: "Density (LPmm)", getValue: (t) => t.DigitizerDensity ?? "", type: "number", group: "Digitizer", unit: "LPmm" },
  { key: "DigitizerTilt", label: "Tilt (degrees)", getValue: (t) => t.DigitizerTilt ?? "", type: "number", group: "Digitizer" },
  { key: "DigitizerAccuracyCenter", label: "Accuracy Center (mm)", getValue: (t) => t.DigitizerAccuracyCenter ?? "", type: "number", group: "Digitizer", unit: "mm" },
  { key: "DigitizerAccuracyCorner", label: "Accuracy Corner (mm)", getValue: (t) => t.DigitizerAccuracyCorner ?? "", type: "number", group: "Digitizer", unit: "mm" },
  { key: "DigitizerMaxHover", label: "Max Hover (mm)", getValue: (t) => t.DigitizerMaxHover ?? "", type: "number", group: "Digitizer", unit: "mm" },
  { key: "DigitizerSupportsTouch", label: "Touch", getValue: (t) => t.DigitizerSupportsTouch ?? "", type: "enum", enumValues: ["YES", "NO"], group: "Digitizer" },
  {
    key: "DigitizerDimensions", label: "Dimensions (mm)", group: "Digitizer", unit: "mm",
    getValue: (t) => { const d = t.DigitizerDimensions; return d ? `${d.Width} x ${d.Height}` : ""; },
    type: "string",
  },
  {
    key: "DigitizerAspectRatio", label: "Aspect Ratio", group: "Digitizer", computed: true, type: "number",
    getValue: (t) => {
      const d = t.DigitizerDimensions;
      if (!d || d.Width == null || d.Height == null) return "";
      return (d.Width / d.Height).toFixed(3);
    },
  },
  {
    key: "DigitizerAspectRatioFraction", label: "Aspect Ratio (fraction)", group: "Digitizer", computed: true, type: "string",
    getValue: (t) => {
      const d = t.DigitizerDimensions;
      if (!d || d.Width == null || d.Height == null) return "";
      const h = 16 / (d.Width / d.Height);
      const rounded = Math.round(h);
      const hStr = Math.abs(h - rounded) < 0.01 ? String(rounded) : h.toFixed(2);
      return `16:${hStr}`;
    },
  },
  {
    key: "DigitizerSizeCategory", label: "Size Category", group: "Digitizer", computed: true, type: "string",
    getValue: (t) => {
      const d = t.DigitizerDimensions;
      if (!d || d.Width == null || d.Height == null) return "";
      const diagMm = Math.sqrt(d.Width * d.Width + d.Height * d.Height);
      const diagIn = diagMm * 0.03937;
      if (t.ModelType === "PENTABLET") {
        if (diagIn >= 2 && diagIn < 6) return "Tiny";
        if (diagIn >= 6 && diagIn < 10) return "Small";
        if (diagIn >= 10 && diagIn < 14) return "Medium";
        if (diagIn >= 14 && diagIn < 20) return "Large";
        if (diagIn >= 20 && diagIn <= 29) return "Extra Large";
      } else if (t.ModelType === "PENDISPLAY") {
        if (diagIn >= 11 && diagIn < 15) return "Small";
        if (diagIn >= 15 && diagIn < 20) return "Medium";
        if (diagIn >= 20 && diagIn < 30) return "Large";
        if (diagIn >= 30 && diagIn <= 34) return "Extra Large";
      } else if (t.ModelType === "STANDALONE") {
        if (diagIn >= 11 && diagIn < 15) return "Small";
        if (diagIn >= 15 && diagIn < 20) return "Medium";
        if (diagIn >= 20 && diagIn < 30) return "Large";
        if (diagIn >= 30 && diagIn <= 34) return "Extra Large";
      }
      return "Other";
    },
  },
  {
    key: "DigitizerDiagonal", label: "Diagonal (mm)", group: "Digitizer", computed: true, type: "number", unit: "mm",
    getValue: (t) => {
      const d = t.DigitizerDimensions;
      if (!d || d.Width == null || d.Height == null) return "";
      return Math.sqrt(d.Width * d.Width + d.Height * d.Height).toFixed(1);
    },
  },
  // Display
  { key: "DisplayPanelTech", label: "Panel Tech", getValue: (t) => displayVal(t, t.DisplayPanelTech), type: "enum", enumValues: ["IPS", "TFT", "AHVA", "OLED", "H-IPS", "MVA"], group: "Display" },
  { key: "DisplayBrightness", label: "Brightness (cd/m²)", getValue: (t) => displayVal(t, t.DisplayBrightness), type: "number", group: "Display" },
  { key: "DisplayBrightnessPeak", label: "Peak Brightness (cd/m²)", getValue: (t) => displayVal(t, t.DisplayBrightnessPeak), type: "number", group: "Display" },
  { key: "DisplayContrast", label: "Contrast", getValue: (t) => displayVal(t, t.DisplayContrast), type: "number", group: "Display" },
  { key: "DisplayColorBitDepth", label: "Bit Depth", getValue: (t) => displayVal(t, t.DisplayColorBitDepth), type: "number", group: "Display" },
  { key: "DisplayLamination", label: "Lamination", getValue: (t) => displayVal(t, t.DisplayLamination), type: "enum", enumValues: ["YES", "NO"], group: "Display" },
  { key: "DisplayAntiGlare", label: "Anti-Glare", getValue: (t) => displayVal(t, t.DisplayAntiGlare), type: "enum", enumValues: ["AGFILM", "ETCHEDGLASS", "FILM"], group: "Display" },
  { key: "DisplayResponseTime", label: "Response Time (ms)", getValue: (t) => displayVal(t, t.DisplayResponseTime), type: "number", group: "Display" },
  { key: "DisplayRefreshRate", label: "Refresh Rate (Hz)", getValue: (t) => displayVal(t, t.DisplayRefreshRate), type: "number", group: "Display" },
  {
    key: "DisplayPixelDimensions", label: "Pixel Dimensions", group: "Display",
    getValue: (t) => { if (notApplicable(t)) return "-"; const d = t.DisplayPixelDimensions; return d ? `${d.Width} x ${d.Height}` : ""; },
    type: "string",
  },
  {
    key: "DisplayDiagonal", label: "Diagonal (mm)", group: "Display", computed: true, type: "number", unit: "mm",
    getValue: (t) => {
      if (notApplicable(t)) return "-";
      const res = t.DisplayPixelDimensions;
      const dim = t.DigitizerDimensions;
      if (!res || !dim || !dim.Width || !dim.Height) return "";
      return Math.sqrt(dim.Width * dim.Width + dim.Height * dim.Height).toFixed(1);
    },
  },
  {
    key: "DisplayDensity", label: "Density (px/mm)", group: "Display", computed: true, type: "number", unit: "px/mm",
    getValue: (t) => {
      if (notApplicable(t)) return "-";
      const res = t.DisplayPixelDimensions;
      const dim = t.DigitizerDimensions;
      if (!res || !dim || !res.Width || !dim.Width) return "";
      return (res.Width / dim.Width).toFixed(2);
    },
  },
  {
    key: "DisplayPixelDimensionsCategory", label: "Resolution Category", group: "Display", computed: true, type: "string",
    getValue: (t) => {
      if (notApplicable(t)) return "-";
      const d = t.DisplayPixelDimensions;
      if (!d || !d.Width || !d.Height) return "";
      const w = d.Width, h = d.Height;
      if (w === 1920 && h === 1080) return "Full HD";
      if ((w === 2560 && h === 1440) || (w === 2560 && h === 1600)) return "2.5K";
      if (w === 2880 && h === 1800) return "3K";
      if (w === 3840 && h === 2160) return "4K";
      return "Other";
    },
  },
  // Physical
  { key: "PhysicalWeight", label: "Weight (g)", getValue: (t) => t.PhysicalWeight ?? "", type: "number", group: "Physical", unit: "g" },
  {
    key: "PhysicalDimensions", label: "Dimensions (mm)", group: "Physical", unit: "mm",
    getValue: (t) => {
      const d = t.PhysicalDimensions;
      if (!d) return "";
      return d.Depth ? `${d.Width} x ${d.Height} x ${d.Depth}` : `${d.Width} x ${d.Height}`;
    },
    type: "string",
  },
  // Compute
  { key: "ComputeOS", label: "OS", getValue: (t) => t.ComputeOS ?? "", type: "string", group: "Standalone" },
  { key: "ComputeProcessor", label: "Processor", getValue: (t) => t.ComputeProcessor ?? "", type: "string", group: "Standalone" },
  { key: "ComputeGPU", label: "GPU", getValue: (t) => t.ComputeGPU ?? "", type: "string", group: "Standalone" },
  { key: "ComputeRAM", label: "RAM (GB)", getValue: (t) => t.ComputeRAM ?? "", type: "number", group: "Standalone" },
  { key: "ComputeStorage", label: "Storage (GB)", getValue: (t) => t.ComputeStorage ?? "", type: "number", group: "Standalone" },
  { key: "ComputeExpandableStorage", label: "Expandable Storage", getValue: (t) => t.ComputeExpandableStorage ?? "", type: "enum", enumValues: ["YES", "NO"], group: "Standalone" },
  { key: "ComputeMemoryCardSlot", label: "Memory Card Slot", getValue: (t) => t.ComputeMemoryCardSlot ?? "", type: "string", group: "Standalone" },
  // Battery
  { key: "BatteryCapacity", label: "Capacity (mAh)", getValue: (t) => t.BatteryCapacity ?? "", type: "number", group: "Standalone" },
  { key: "BatteryLife", label: "Battery Life (hrs)", getValue: (t) => t.BatteryLife ?? "", type: "number", group: "Standalone" },
  { key: "BatteryChargingWatts", label: "Charging (W)", getValue: (t) => t.BatteryChargingWatts ?? "", type: "number", group: "Standalone" },
  // Connectivity
  { key: "ConnectivityWifi", label: "Wi-Fi", getValue: (t) => t.ConnectivityWifi ?? "", type: "string", group: "Standalone" },
  { key: "ConnectivityBluetooth", label: "Bluetooth", getValue: (t) => t.ConnectivityBluetooth ?? "", type: "string", group: "Standalone" },
  { key: "ConnectivityUSB", label: "USB", getValue: (t) => t.ConnectivityUSB ?? "", type: "string", group: "Standalone" },
  // Hardware
  { key: "HardwareSpeakers", label: "Speakers", getValue: (t) => t.HardwareSpeakers ?? "", type: "enum", enumValues: ["YES", "NO"], group: "Standalone" },
  { key: "HardwareFrontCamera", label: "Front Camera (MP)", getValue: (t) => t.HardwareFrontCamera ?? "", type: "number", group: "Standalone" },
  { key: "HardwareRearCamera", label: "Rear Camera (MP)", getValue: (t) => t.HardwareRearCamera ?? "", type: "number", group: "Standalone" },
];

export const TABLET_DEFAULT_COLUMNS = [
  "EntityId", "Brand", "ModelName", "ModelType", "ModelLaunchYear", "Age",
  "DigitizerPressureLevels", "DigitizerTilt", "DigitizerDimensions",
  "DisplayPixelDimensions", "PhysicalWeight", "ModelStatus",
];

export const TABLET_DEFAULT_VIEW: Step[] = [
  {
    kind: "select",
    fields: [
      "EntityId", "FullName", "ModelType", "ModelLaunchYear",
      "DigitizerDiagonal", "ModelIncludedPen",
    ],
  },
  { kind: "sort", field: "Brand", direction: "asc" },
];
