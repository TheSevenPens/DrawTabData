/**
 * Pressure-response session EntityId helpers.
 *
 * Every session stores its EntityId, like tablets and pens do. The value
 * is derived from Brand / InventoryId / Date, and data-quality checks that
 * it still matches:
 *
 *   `<brand>.session.<inventoryid>_<date>`            e.g. wacom.session.wap.0030_2025-03-25
 *   `<brand>.session.<inventoryid>_<date>_<suffix>`   when IdSuffix is set
 *
 * IdSuffix is the disambiguator for a pen measured more than once on the
 * same day — WAP.0009 was measured on 2026-05-25 on both a Cintiq and a
 * Galaxy Book, and before the ID was stored both sessions answered to the
 * same /entity URL. It mirrors the tablet Model.IdSuffix (#32): the first
 * session keeps the plain ID, so existing links don't move.
 */

export interface SessionIdentity {
  Brand: string;
  InventoryId: string;
  Date: string;
  IdSuffix?: string;
}

const normalizeSuffix = (s: string) => s.replace(/[^A-Za-z0-9]/g, "").toLowerCase();

/** The EntityId a session's fields imply (what data-quality compares against). */
export function deriveSessionEntityId(s: SessionIdentity): string {
  const base = `${s.Brand.toLowerCase()}.session.${s.InventoryId.trim().toLowerCase()}_${s.Date}`;
  return s.IdSuffix ? `${base}_${normalizeSuffix(s.IdSuffix)}` : base;
}

/** A session's EntityId: the stored one, else the derived form. */
export function sessionEntityId(s: SessionIdentity & { EntityId?: string }): string {
  return s.EntityId || deriveSessionEntityId(s);
}

/**
 * Inverse of `deriveSessionEntityId`. Returns the lowercase parts, with
 * `idSuffix` only when the ID has one. Null if it isn't a session ID.
 */
export function parseSessionEntityId(
  entityId: string,
): { brand: string; inventoryId: string; date: string; idSuffix?: string } | null {
  const parts = entityId.split(".");
  if (parts.length < 3 || parts[1] !== "session") return null;
  // Tail is everything after `<brand>.session.` — InventoryId may itself
  // contain dots (e.g. `wap.0030`). The date is the anchor: an optional
  // suffix follows it, the inventory id precedes it.
  const tail = parts.slice(2).join(".");
  const m = /^(.+)_(\d{4}-\d{2}-\d{2})(?:_([a-z0-9]+))?$/.exec(tail);
  if (!m) return null;
  return {
    brand: parts[0],
    inventoryId: m[1],
    date: m[2],
    ...(m[3] ? { idSuffix: m[3] } : {}),
  };
}
