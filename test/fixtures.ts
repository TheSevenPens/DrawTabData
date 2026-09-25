import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
export const FIXTURE_DATE = "2026-01-01T00:00:00.000Z";
export function tracking(id: string) {
  const h = createHash("sha256").update(id).digest("hex");
  return { _id: `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`,
    _CreateDate: FIXTURE_DATE, _ModifiedDate: FIXTURE_DATE };
}
export function tabletFixture(brand: string, id: string, extra: Record<string, unknown> = {}) {
  const entityId = `${brand.toLowerCase()}.tablet.${id}`;
  return { Meta: { EntityId: entityId, ...tracking(entityId) },
    Model: { Brand: brand, Id: id.toUpperCase(), Name: `Tablet ${id}`, Type: "PENTABLET", ReleaseYear: "", ...extra } };
}
export function penFixture(brand: string, id: string) {
  const EntityId = `${brand.toLowerCase()}.pen.${id}`;
  return { EntityId, Brand: brand, PenId: id, PenName: id, PenFamily: "", ReleaseYear: "", ...tracking(EntityId) };
}
export function sessionFixture(EntityId: string) {
  const match = /session\.(.+)_(\d{4}-\d{2}-\d{2})(?:_(.+))?$/.exec(EntityId)!;
  return { EntityId, Brand: EntityId.split(".")[0].toUpperCase(), InventoryId: match[1].toUpperCase(), Date: match[2],
    ...(match[3] ? { IdSuffix: match[3] } : {}), PenEntityId: "", PenFamily: "", User: "", TabletEntityId: "",
    Driver: "", OS: "", Notes: "", Records: [[10, 0], [2.5, 1.25]], ...tracking(EntityId) };
}
/** Preserve deliberately empty migrated collections through Git commits. */
export function initSources(root: string): void {
  for (const collection of ["tablets", "pens", "pressure-response"]) {
    const dir = path.join(root, "source", collection);
    fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, ".gitkeep"), "");
  }
}
