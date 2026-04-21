import type { Tablet } from "../drawtab-loader.js";
import { brandName } from "../drawtab-loader.js";
import type { FieldDef, Step } from "../pipeline/types.js";

function notApplicable(t: Tablet): boolean {
  return t.Model.Type === "PENTABLET";
}

function displayVal(t: Tablet, val: string | undefined): string {
  if (notApplicable(t)) return "-";
  return val ?? "";
}

export const TABLET_FIELD_GROUPS = ["Model", "Digitizer", "Display", "Physical", "Standalone"];

export const TABLET_FIELDS: FieldDef<Tablet>[] = [
  // Model
  { key: "EntityId", label: "Entity ID", getValue: (t) => t.Meta.EntityId, type: "string", group: "Model" },
  { key: "FullName", label: "Full Name", getValue: (t) => `${brandName(t.Model.Brand)} ${t.Model.Name} (${t.Model.Id})`, type: "string", group: "Model", computed: true },
  { key: "NameAndModelId", label: "Name and Model ID", getValue: (t) => `${t.Model.Name} (${t.Model.Id})`, type: "string", group: "Model", computed: true },
  { key: "Brand", label: "Brand", getValue: (t) => t.Model.Brand, getDisplayValue: (t) => brandName(t.Model.Brand), getHref: (t) => `/brands/${t.Model.Brand}`, type: "enum", enumValues: ["GAOMON", "HUION", "SAMSUNG", "UGEE", "WACOM", "XENCELABS", "XPPEN"], group: "Model" },
  { key: "ModelId", label: "Model ID", getValue: (t) => t.Model.Id, type: "string", group: "Model" },
  { key: "ModelName", label: "Name", getValue: (t) => t.Model.Name, type: "string", group: "Model" },
  { key: "AlternateNames", label: "Alternate Names", getValue: (t) => (t.Model.AlternateNames ?? []).join(", "), type: "string", group: "Model", alwaysSearch: true },
  { key: "ModelType", label: "Type", getValue: (t) => t.Model.Type, type: "enum", enumValues: ["PENTABLET", "PENDISPLAY", "STANDALONE"], group: "Model" },
  { key: "ModelLaunchYear", label: "Year", getValue: (t) => t.Model.LaunchYear, type: "number", group: "Model" },
  {
    key: "Age", label: "Age (years)", computed: true, type: "number", group: "Model",
    getValue: (t) => {
      const year = parseInt(t.Model.LaunchYear, 10);
      return isNaN(year) ? "" : String(new Date().getFullYear() - year);
    },
  },
  { key: "ModelAudience", label: "Audience", getValue: (t) => t.Model.Audience ?? "", type: "enum", enumValues: ["Consumer", "Enthusiast", "Professional"], group: "Model" },
  { key: "ModelFamily", label: "Family", getValue: (t) => t.Model.Family ?? "", type: "string", group: "Model" },
  { key: "ModelStatus", label: "Status", getValue: (t) => t.Model.Status ?? "", type: "enum", enumValues: ["ACTIVE", "AVAILABLE", "DISCONTINUED"], group: "Model" },
  { key: "ModelIncludedPen", label: "Included Pen", getValue: (t) => (t.Model.IncludedPen ?? []).join(", "), type: "string", group: "Model" },
  { key: "ModelProductLink", label: "Product Link", getValue: (t) => t.Model.ProductLink ?? "", type: "string", group: "Model" },
  { key: "ModelUserManual", label: "User Manual", getValue: (t) => t.Model.UserManual ?? "", type: "string", group: "Model" },
  // Digitizer
  { key: "DigitizerType", label: "Digitizer Type", getValue: (t) => t.Digitizer?.Type ?? "", type: "enum", enumValues: ["PASSIVE_EMR", "ACTIVE_EMR"], group: "Digitizer" },
  { key: "DigitizerPressureLevels", label: "Pressure Levels", getValue: (t) => t.Digitizer?.PressureLevels ?? "", type: "number", group: "Digitizer" },
  { key: "DigitizerReportRate", label: "Report Rate (Hz)", getValue: (t) => t.Digitizer?.ReportRate ?? "", type: "number", group: "Digitizer" },
  { key: "DigitizerDensity", label: "Density (LPmm)", getValue: (t) => t.Digitizer?.Density ?? "", type: "number", group: "Digitizer", unit: "LPmm" },
  { key: "DigitizerTilt", label: "Tilt (degrees)", getValue: (t) => t.Digitizer?.Tilt ?? "", type: "number", group: "Digitizer" },
  { key: "DigitizerAccuracyCenter", label: "Accuracy Center (mm)", getValue: (t) => t.Digitizer?.AccuracyCenter ?? "", type: "number", group: "Digitizer", unit: "mm" },
  { key: "DigitizerAccuracyCorner", label: "Accuracy Corner (mm)", getValue: (t) => t.Digitizer?.AccuracyCorner ?? "", type: "number", group: "Digitizer", unit: "mm" },
  { key: "DigitizerMaxHover", label: "Max Hover (mm)", getValue: (t) => t.Digitizer?.MaxHover ?? "", type: "number", group: "Digitizer", unit: "mm" },
  { key: "DigitizerSupportsTouch", label: "Touch", getValue: (t) => t.Digitizer?.SupportsTouch ?? "", type: "enum", enumValues: ["YES", "NO"], group: "Digitizer" },
  {
    key: "DigitizerDimensions", label: "Dimensions (mm)", group: "Digitizer", unit: "mm",
    getValue: (t) => { const d = t.Digitizer?.Dimensions; return d ? `${d.Width} x ${d.Height}` : ""; },
    type: "string",
  },
  {
    key: "DigitizerAspectRatio", label: "Aspect Ratio", group: "Digitizer", computed: true, type: "number",
    getValue: (t) => {
      const d = t.Digitizer?.Dimensions;
      if (!d || d.Width == null || d.Height == null) return "";
      return (d.Width / d.Height).toFixed(3);
    },
  },
  {
    key: "DigitizerAspectRatioFraction", label: "Aspect Ratio (fraction)", group: "Digitizer", computed: true, type: "string",
    getValue: (t) => {
      const d = t.Digitizer?.Dimensions;
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
      const d = t.Digitizer?.Dimensions;
      if (!d || d.Width == null || d.Height == null) return "";
      const diagMm = Math.sqrt(d.Width * d.Width + d.Height * d.Height);
      const diagIn = diagMm * 0.03937;
      if (t.Model.Type === "PENTABLET") {
        if (diagIn >= 2 && diagIn < 6) return "Tiny";
        if (diagIn >= 6 && diagIn < 10) return "Small";
        if (diagIn >= 10 && diagIn < 14) return "Medium";
        if (diagIn >= 14 && diagIn < 20) return "Large";
        if (diagIn >= 20 && diagIn <= 29) return "Extra Large";
      } else if (t.Model.Type === "PENDISPLAY") {
        if (diagIn >= 11 && diagIn < 15) return "Small";
        if (diagIn >= 15 && diagIn < 20) return "Medium";
        if (diagIn >= 20 && diagIn < 30) return "Large";
        if (diagIn >= 30 && diagIn <= 34) return "Extra Large";
      } else if (t.Model.Type === "STANDALONE") {
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
      const d = t.Digitizer?.Dimensions;
      if (!d || d.Width == null || d.Height == null) return "";
      return Math.sqrt(d.Width * d.Width + d.Height * d.Height).toFixed(1);
    },
  },
  // Display
  { key: "DisplayPanelTech", label: "Panel Tech", getValue: (t) => displayVal(t, t.Display?.PanelTech), type: "enum", enumValues: ["IPS", "TFT", "AHVA", "OLED", "H-IPS", "MVA"], group: "Display" },
  { key: "DisplayBrightness", label: "Brightness (cd/m²)", getValue: (t) => displayVal(t, t.Display?.Brightness), type: "number", group: "Display" },
  { key: "DisplayBrightnessPeak", label: "Peak Brightness (cd/m²)", getValue: (t) => displayVal(t, t.Display?.BrightnessPeak), type: "number", group: "Display" },
  { key: "DisplayContrast", label: "Contrast", getValue: (t) => displayVal(t, t.Display?.Contrast), type: "number", group: "Display" },
  { key: "DisplayColorBitDepth", label: "Bit Depth", getValue: (t) => displayVal(t, t.Display?.ColorBitDepth), type: "number", group: "Display" },
  { key: "DisplayLamination", label: "Lamination", getValue: (t) => displayVal(t, t.Display?.Lamination), type: "enum", enumValues: ["YES", "NO"], group: "Display" },
  { key: "DisplayAntiGlare", label: "Anti-Glare", getValue: (t) => displayVal(t, t.Display?.AntiGlare), type: "enum", enumValues: ["AGFILM", "ETCHEDGLASS", "FILM"], group: "Display" },
  { key: "DisplayResponseTime", label: "Response Time (ms)", getValue: (t) => displayVal(t, t.Display?.ResponseTime), type: "number", group: "Display" },
  { key: "DisplayRefreshRate", label: "Refresh Rate (Hz)", getValue: (t) => displayVal(t, t.Display?.RefreshRate), type: "number", group: "Display" },
  {
    key: "DisplayPixelDimensions", label: "Pixel Dimensions", group: "Display",
    getValue: (t) => { if (notApplicable(t)) return "-"; const d = t.Display?.PixelDimensions; return d ? `${d.Width} x ${d.Height}` : ""; },
    type: "string",
  },
  {
    key: "DisplayDiagonal", label: "Diagonal (mm)", group: "Display", computed: true, type: "number", unit: "mm",
    getValue: (t) => {
      if (notApplicable(t)) return "-";
      const res = t.Display?.PixelDimensions;
      const dim = t.Digitizer?.Dimensions;
      if (!res || !dim || !dim.Width || !dim.Height) return "";
      return Math.sqrt(dim.Width * dim.Width + dim.Height * dim.Height).toFixed(1);
    },
  },
  {
    key: "DisplayDensity", label: "Density (px/mm)", group: "Display", computed: true, type: "number", unit: "px/mm",
    getValue: (t) => {
      if (notApplicable(t)) return "-";
      const res = t.Display?.PixelDimensions;
      const dim = t.Digitizer?.Dimensions;
      if (!res || !dim || !res.Width || !dim.Width) return "";
      return (res.Width / dim.Width).toFixed(2);
    },
  },
  {
    key: "DisplayPixelDimensionsCategory", label: "Resolution Category", group: "Display", computed: true, type: "string",
    getValue: (t) => {
      if (notApplicable(t)) return "-";
      const d = t.Display?.PixelDimensions;
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
  { key: "PhysicalWeight", label: "Weight (g)", getValue: (t) => t.Physical?.Weight ?? "", type: "number", group: "Physical", unit: "g" },
  {
    key: "PhysicalDimensions", label: "Dimensions (mm)", group: "Physical", unit: "mm",
    getValue: (t) => {
      const d = t.Physical?.Dimensions;
      if (!d) return "";
      return d.Depth ? `${d.Width} x ${d.Height} x ${d.Depth}` : `${d.Width} x ${d.Height}`;
    },
    type: "string",
  },
  // Standalone — Compute
  { key: "ComputeOS", label: "OS", getValue: (t) => t.Standalone?.OS ?? "", type: "string", group: "Standalone" },
  { key: "ComputeProcessor", label: "Processor", getValue: (t) => t.Standalone?.Processor ?? "", type: "string", group: "Standalone" },
  { key: "ComputeGPU", label: "GPU", getValue: (t) => t.Standalone?.GPU ?? "", type: "string", group: "Standalone" },
  { key: "ComputeRAM", label: "RAM (GB)", getValue: (t) => t.Standalone?.RAM ?? "", type: "number", group: "Standalone" },
  { key: "ComputeStorage", label: "Storage (GB)", getValue: (t) => t.Standalone?.Storage ?? "", type: "number", group: "Standalone" },
  { key: "ComputeExpandableStorage", label: "Expandable Storage", getValue: (t) => t.Standalone?.ExpandableStorage ?? "", type: "enum", enumValues: ["YES", "NO"], group: "Standalone" },
  { key: "ComputeMemoryCardSlot", label: "Memory Card Slot", getValue: (t) => t.Standalone?.MemoryCardSlot ?? "", type: "string", group: "Standalone" },
  // Standalone — Battery
  { key: "BatteryCapacity", label: "Capacity (mAh)", getValue: (t) => t.Standalone?.BatteryCapacity ?? "", type: "number", group: "Standalone" },
  { key: "BatteryLife", label: "Battery Life (hrs)", getValue: (t) => t.Standalone?.BatteryLife ?? "", type: "number", group: "Standalone" },
  { key: "BatteryChargingWatts", label: "Charging (W)", getValue: (t) => t.Standalone?.BatteryChargingWatts ?? "", type: "number", group: "Standalone" },
  // Standalone — Connectivity
  { key: "ConnectivityWifi", label: "Wi-Fi", getValue: (t) => t.Standalone?.Wifi ?? "", type: "string", group: "Standalone" },
  { key: "ConnectivityBluetooth", label: "Bluetooth", getValue: (t) => t.Standalone?.Bluetooth ?? "", type: "string", group: "Standalone" },
  { key: "ConnectivityUSB", label: "USB", getValue: (t) => t.Standalone?.USB ?? "", type: "string", group: "Standalone" },
  // Standalone — Hardware
  { key: "HardwareSpeakers", label: "Speakers", getValue: (t) => t.Standalone?.Speakers ?? "", type: "enum", enumValues: ["YES", "NO"], group: "Standalone" },
  { key: "HardwareFrontCamera", label: "Front Camera (MP)", getValue: (t) => t.Standalone?.FrontCamera ?? "", type: "number", group: "Standalone" },
  { key: "HardwareRearCamera", label: "Rear Camera (MP)", getValue: (t) => t.Standalone?.RearCamera ?? "", type: "number", group: "Standalone" },
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
      "Brand", "NameAndModelId", "ModelType", "ModelLaunchYear",
      "DigitizerDiagonal", "ModelIncludedPen",
    ],
  },
  { kind: "sort", field: "Brand", direction: "asc" },
];
