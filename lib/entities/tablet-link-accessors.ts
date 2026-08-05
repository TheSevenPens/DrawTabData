// Derived accessors: a tablet's canonical manufacturer product-page / user-manual
// URL, read from the single MANUFACTURER* entry in Model.Links. These replaced the
// stored Model.ProductLink / Model.UserManual fields — Links is now the sole store
// (see LinkTypeSchema; at most one MANUFACTURER* of each kind per tablet, enforced
// by the data-quality check). Return "" when absent.
import type { Tablet } from "../drawtab-loader.js";

export function tabletManufacturerProductLink(t: Tablet): string {
  return (t.Model.Links ?? []).find((l) => l.Type === "MANUFACTURERPRODUCTINFO")?.URL ?? "";
}

export function tabletManufacturerUserManual(t: Tablet): string {
  return (t.Model.Links ?? []).find((l) => l.Type === "MANUFACTURERUSERMANUAL")?.URL ?? "";
}
