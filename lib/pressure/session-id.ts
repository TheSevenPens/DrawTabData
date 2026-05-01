/**
 * Pressure-response session EntityId helpers.
 *
 * Sessions don't carry an EntityId in the JSON files (the schema has
 * Brand / InventoryId / Date but no EntityId field). The Explorer
 * surfaces sessions under the canonical /entity/<id> URL scheme by
 * computing the ID from those fields, so this helper is the single
 * source of truth for that derivation.
 *
 * Format: `<brand>.session.<inventoryid>_<date>`, all lowercase, with
 * any uppercase or whitespace in InventoryId normalized.
 *
 * Examples:
 *   { Brand: "WACOM", InventoryId: "WAP.0030", Date: "2025-03-25" }
 *   → "wacom.session.wap.0030_2025-03-25"
 */

export interface SessionIdentity {
  Brand: string;
  InventoryId: string;
  Date: string;
}

export function sessionEntityId(s: SessionIdentity): string {
  return `${s.Brand.toLowerCase()}.session.${s.InventoryId.trim().toLowerCase()}_${s.Date}`;
}

/**
 * Inverse of `sessionEntityId`. Returns the raw `<inventoryid>_<date>`
 * tail (still lowercase) so callers can do their own field parsing if
 * they need to. Returns null if the EntityId isn't a session ID.
 */
export function parseSessionEntityId(
  entityId: string,
): { brand: string; inventoryId: string; date: string } | null {
  const parts = entityId.split('.');
  if (parts.length < 3 || parts[1] !== 'session') return null;
  // Tail is everything after `<brand>.session.` — InventoryId may
  // itself contain dots (e.g. `wap.0030`), so we split on the last
  // underscore to separate the date.
  const tail = parts.slice(2).join('.');
  const lastUnderscore = tail.lastIndexOf('_');
  if (lastUnderscore < 0) return null;
  return {
    brand: parts[0],
    inventoryId: tail.slice(0, lastUnderscore),
    date: tail.slice(lastUnderscore + 1),
  };
}
