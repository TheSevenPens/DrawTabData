import { loadTablets, getBrands, filterByBrand, filterByType, type Tablet } from "../lib/drawtab-loader.js";

interface Column {
  key: string;
  label: string;
  render: (t: Tablet) => string;
}

const columns: Column[] = [
  { key: "EntityId", label: "Entity ID", render: (t) => t.EntityId },
  { key: "ModelBrand", label: "Brand", render: (t) => t.ModelBrand },
  { key: "ModelName", label: "Name", render: (t) => t.ModelName },
  { key: "ModelType", label: "Type", render: (t) => t.ModelType === "PENDISPLAY" ? "Pen Display" : "Pen Tablet" },
  { key: "ModelLaunchYear", label: "Year", render: (t) => t.ModelLaunchYear },
  { key: "DigitizerPressureLevels", label: "Pressure", render: (t) => t.DigitizerPressureLevels ?? "" },
  { key: "DigitizerTilt", label: "Tilt", render: (t) => t.DigitizerTilt ? `${t.DigitizerTilt}°` : "" },
  {
    key: "DigitizerDimensions",
    label: "Active Area",
    render: (t) => {
      const d = t.DigitizerDimensions;
      return d ? `${d.Width} × ${d.Height} mm` : "";
    },
  },
  {
    key: "DisplayResolution",
    label: "Resolution",
    render: (t) => {
      const d = t.DisplayResolution;
      return d ? `${d.Width} × ${d.Height}` : "";
    },
  },
  {
    key: "PhysicalWeight",
    label: "Weight",
    render: (t) => t.PhysicalWeight ? `${t.PhysicalWeight} g` : "",
  },
  { key: "ModelStatus", label: "Status", render: (t) => t.ModelStatus ?? "" },
];

let allTablets: Tablet[] = [];
let sortKey = "ModelBrand";
let sortAsc = true;

const brandFilter = document.getElementById("brand-filter") as HTMLSelectElement;
const typeFilter = document.getElementById("type-filter") as HTMLSelectElement;
const thead = document.getElementById("thead")!;
const tbody = document.getElementById("tbody")!;
const countEl = document.getElementById("count")!;

function renderHeader() {
  const tr = document.createElement("tr");
  for (const col of columns) {
    const th = document.createElement("th");
    const arrow = col.key === sortKey ? (sortAsc ? " ▲" : " ▼") : "";
    th.textContent = col.label + arrow;
    th.addEventListener("click", () => {
      if (sortKey === col.key) {
        sortAsc = !sortAsc;
      } else {
        sortKey = col.key;
        sortAsc = true;
      }
      renderHeader();
      renderTable();
    });
    tr.appendChild(th);
  }
  thead.innerHTML = "";
  thead.appendChild(tr);
}

function getFilteredTablets(): Tablet[] {
  let tablets = allTablets;
  const brand = brandFilter.value;
  const type = typeFilter.value;
  if (brand) tablets = filterByBrand(tablets, brand);
  if (type) tablets = filterByType(tablets, type as Tablet["ModelType"]);
  return tablets;
}

function sortTablets(tablets: Tablet[]): Tablet[] {
  const col = columns.find((c) => c.key === sortKey);
  if (!col) return tablets;
  return [...tablets].sort((a, b) => {
    const va = col.render(a);
    const vb = col.render(b);
    const cmp = va.localeCompare(vb, undefined, { numeric: true });
    return sortAsc ? cmp : -cmp;
  });
}

function renderTable() {
  const filtered = getFilteredTablets();
  const sorted = sortTablets(filtered);

  countEl.textContent = `Showing ${sorted.length} of ${allTablets.length} tablets`;

  tbody.innerHTML = "";
  for (const tablet of sorted) {
    const tr = document.createElement("tr");
    for (const col of columns) {
      const td = document.createElement("td");
      const val = col.render(tablet);
      td.textContent = val;
      if (!val) td.classList.add("dim");
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
}

async function init() {
  allTablets = await loadTablets("");

  const brands = getBrands(allTablets);
  for (const brand of brands) {
    const opt = document.createElement("option");
    opt.value = brand;
    opt.textContent = brand;
    brandFilter.appendChild(opt);
  }

  brandFilter.addEventListener("change", renderTable);
  typeFilter.addEventListener("change", renderTable);

  renderHeader();
  renderTable();
}

init();
