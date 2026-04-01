import { loadTablets, type Tablet } from "../lib/drawtab-loader.js";
import {
  type Step, type FilterStep, type SortStep, type SelectStep, type TakeStep,
  FIELDS, getFieldDef, getOperatorsForField, DEFAULT_COLUMNS,
  executePipeline,
} from "./pipeline.js";

let allTablets: Tablet[] = [];
let steps: Step[] = [];

const pipelineEl = document.getElementById("pipeline")!;
const addStepEl = document.getElementById("add-step")!;
const resultsBar = document.getElementById("results-bar")!;
const thead = document.getElementById("thead")!;
const tbody = document.getElementById("tbody")!;

// --- Add step buttons ---

function renderAddButtons() {
  addStepEl.innerHTML = "";
  const kinds: { kind: Step["kind"]; label: string }[] = [
    { kind: "filter", label: "+ Filter" },
    { kind: "sort", label: "+ Sort" },
    { kind: "select", label: "+ Select Columns" },
    { kind: "take", label: "+ Limit" },
  ];
  for (const { kind, label } of kinds) {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.addEventListener("click", () => addStep(kind));
    addStepEl.appendChild(btn);
  }
}

function addStep(kind: Step["kind"]) {
  switch (kind) {
    case "filter":
      steps.push({ kind: "filter", field: "ModelBrand", operator: "==", value: "" });
      break;
    case "sort":
      steps.push({ kind: "sort", field: "ModelBrand", direction: "asc" });
      break;
    case "select":
      // Only add if there isn't already a select step
      if (!steps.some((s) => s.kind === "select")) {
        steps.push({ kind: "select", fields: [...DEFAULT_COLUMNS] });
      }
      break;
    case "take":
      steps.push({ kind: "take", count: 50 });
      break;
  }
  renderAll();
}

function removeStep(index: number) {
  steps.splice(index, 1);
  renderAll();
}

// --- Render pipeline ---

function renderPipeline() {
  pipelineEl.innerHTML = "";

  // Source
  const source = document.createElement("div");
  source.className = "pipeline-source";
  source.innerHTML = `Tablets <span class="count">(${allTablets.length} records)</span>`;
  pipelineEl.appendChild(source);

  for (let i = 0; i < steps.length; i++) {
    // Pipe connector
    const pipe = document.createElement("div");
    pipe.className = "pipe-connector";
    pipe.textContent = "|";
    pipelineEl.appendChild(pipe);

    // Step
    const step = steps[i]!;
    const stepEl = document.createElement("div");
    stepEl.className = "step";

    const typeLabel = document.createElement("div");
    typeLabel.className = "step-type";

    const controls = document.createElement("div");
    controls.className = "step-controls";

    const removeBtn = document.createElement("button");
    removeBtn.className = "step-remove";
    removeBtn.textContent = "\u00d7";
    removeBtn.addEventListener("click", () => removeStep(i));

    switch (step.kind) {
      case "filter":
        typeLabel.textContent = "where";
        renderFilterControls(controls, step, i);
        break;
      case "sort":
        typeLabel.textContent = "sort by";
        renderSortControls(controls, step, i);
        break;
      case "select":
        typeLabel.textContent = "project";
        renderSelectControls(controls, step, i);
        break;
      case "take":
        typeLabel.textContent = "take";
        renderTakeControls(controls, step, i);
        break;
    }

    stepEl.appendChild(typeLabel);
    stepEl.appendChild(controls);
    stepEl.appendChild(removeBtn);
    pipelineEl.appendChild(stepEl);
  }
}

// --- Step controls ---

function renderFilterControls(container: HTMLElement, step: FilterStep, index: number) {
  // Field select
  const fieldSelect = document.createElement("select");
  for (const f of FIELDS) {
    const opt = document.createElement("option");
    opt.value = f.key;
    opt.textContent = f.label;
    if (f.key === step.field) opt.selected = true;
    fieldSelect.appendChild(opt);
  }
  fieldSelect.addEventListener("change", () => {
    step.field = fieldSelect.value;
    const newFieldDef = getFieldDef(step.field);
    const ops = newFieldDef ? getOperatorsForField(newFieldDef) : [];
    if (!ops.some((o) => o.value === step.operator)) {
      step.operator = ops[0]?.value ?? "==";
    }
    step.value = "";
    renderAll();
  });
  container.appendChild(fieldSelect);

  // Operator select
  const fieldDef = getFieldDef(step.field);
  const operators = fieldDef ? getOperatorsForField(fieldDef) : [];
  const opSelect = document.createElement("select");
  for (const op of operators) {
    const opt = document.createElement("option");
    opt.value = op.value;
    opt.textContent = op.label;
    if (op.value === step.operator) opt.selected = true;
    opSelect.appendChild(opt);
  }
  opSelect.addEventListener("change", () => {
    step.operator = opSelect.value;
    renderAll();
  });
  container.appendChild(opSelect);

  // Value input — enum gets a dropdown, others get text input
  const needsValue = step.operator !== "empty" && step.operator !== "notempty";
  if (needsValue && fieldDef?.type === "enum" && fieldDef.enumValues) {
    const valSelect = document.createElement("select");
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "-- select --";
    valSelect.appendChild(blank);
    for (const v of fieldDef.enumValues) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      if (v === step.value) opt.selected = true;
      valSelect.appendChild(opt);
    }
    valSelect.addEventListener("change", () => {
      step.value = valSelect.value;
      renderAll();
    });
    container.appendChild(valSelect);
  } else if (needsValue) {
    const input = document.createElement("input");
    input.type = fieldDef?.type === "number" ? "number" : "text";
    input.placeholder = "value...";
    input.value = step.value;
    let debounce: ReturnType<typeof setTimeout>;
    input.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        step.value = input.value;
        renderResults();
      }, 200);
    });
    container.appendChild(input);
  }
}

function renderSortControls(container: HTMLElement, step: SortStep, _index: number) {
  const fieldSelect = document.createElement("select");
  for (const f of FIELDS) {
    const opt = document.createElement("option");
    opt.value = f.key;
    opt.textContent = f.label;
    if (f.key === step.field) opt.selected = true;
    fieldSelect.appendChild(opt);
  }
  fieldSelect.addEventListener("change", () => {
    step.field = fieldSelect.value;
    renderAll();
  });
  container.appendChild(fieldSelect);

  const dirSelect = document.createElement("select");
  for (const d of [{ value: "asc", label: "ascending" }, { value: "desc", label: "descending" }]) {
    const opt = document.createElement("option");
    opt.value = d.value;
    opt.textContent = d.label;
    if (d.value === step.direction) opt.selected = true;
    dirSelect.appendChild(opt);
  }
  dirSelect.addEventListener("change", () => {
    step.direction = dirSelect.value as "asc" | "desc";
    renderAll();
  });
  container.appendChild(dirSelect);
}

function renderSelectControls(container: HTMLElement, step: SelectStep, _index: number) {
  const grid = document.createElement("div");
  grid.className = "columns-grid";
  for (const f of FIELDS) {
    const label = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = step.fields.includes(f.key);
    cb.addEventListener("change", () => {
      if (cb.checked) {
        step.fields.push(f.key);
      } else {
        step.fields = step.fields.filter((k) => k !== f.key);
      }
      renderResults();
    });
    label.appendChild(cb);
    label.appendChild(document.createTextNode(" " + f.label));
    grid.appendChild(label);
  }
  container.appendChild(grid);
}

function renderTakeControls(container: HTMLElement, step: TakeStep, _index: number) {
  const input = document.createElement("input");
  input.type = "number";
  input.min = "1";
  input.value = String(step.count);
  input.style.width = "80px";
  input.addEventListener("input", () => {
    const n = parseInt(input.value, 10);
    if (n > 0) {
      step.count = n;
      renderResults();
    }
  });
  container.appendChild(input);
  container.appendChild(document.createTextNode(" records"));
}

// --- Render results ---

function renderResults() {
  const { data, visibleFields } = executePipeline(allTablets, steps);
  const fieldDefs = visibleFields.map((k) => getFieldDef(k)).filter((f) => f !== undefined);

  resultsBar.textContent = `Showing ${data.length} of ${allTablets.length} tablets`;

  // Header
  thead.innerHTML = "";
  const tr = document.createElement("tr");
  for (const f of fieldDefs) {
    const th = document.createElement("th");
    th.textContent = f.label;
    tr.appendChild(th);
  }
  thead.appendChild(tr);

  // Body
  tbody.innerHTML = "";
  for (const tablet of data) {
    const row = document.createElement("tr");
    for (const f of fieldDefs) {
      const td = document.createElement("td");
      const val = f.getValue(tablet);
      td.textContent = val;
      if (!val) td.classList.add("dim");
      row.appendChild(td);
    }
    tbody.appendChild(row);
  }
}

// --- Render all ---

function renderAll() {
  renderPipeline();
  renderResults();
}

// --- Init ---

async function init() {
  allTablets = await loadTablets("");
  renderAddButtons();
  renderAll();
}

init();
