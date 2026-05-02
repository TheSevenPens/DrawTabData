/**
 * Data-quality checks over pressure-response sessions.
 *
 * Ported from PenPressureData/app/src/lib/dataQuality.js on 2026-05-01.
 * All functions are pure and operate on the canonical
 * `PressureResponse` schema from this submodule.
 */

import type { PressureResponse } from '../schemas.js';
import { sessionEntityId } from './session-id.js';

export interface NonMonotonicSession {
  session: PressureResponse;
  firstDrop: { index: number; from: number; to: number };
}

export interface PenAggregate {
  brand: string;
  penEntityId: string;
  inventoryId: string;
}

export interface MissingLowEndPen extends PenAggregate {
  lowestLogical: number;
  sessionCount: number;
}

export interface SingleSessionPen extends PenAggregate {
  date: string;
  sessionEntityId: string;
}

export interface StaleMeasurement extends PenAggregate {
  lastDate: string;
  daysAgo: number;
}

export type RemeasureReason = 'missing-low-end' | 'single-session' | 'stale';

export interface RemeasureRecommendation extends PenAggregate {
  reasons: RemeasureReason[];
}

/**
 * Sessions where logical pressure (y) drops at any point as physical
 * pressure (x) increases. A valid session is monotonically
 * non-decreasing on the logical axis.
 */
export function findNonMonotonicSessions(
  sessions: readonly PressureResponse[],
): NonMonotonicSession[] {
  const out: NonMonotonicSession[] = [];
  for (const s of sessions) {
    const records = s.Records;
    let maxSeen = -Infinity;
    let dropIndex = -1;
    let dropFrom = 0;
    let dropTo = 0;
    for (let i = 0; i < records.length; i++) {
      const y = records[i][1];
      if (y < maxSeen) {
        dropIndex = i;
        dropFrom = maxSeen;
        dropTo = y;
        break;
      }
      if (y > maxSeen) maxSeen = y;
    }
    if (dropIndex >= 0) {
      out.push({ session: s, firstDrop: { index: dropIndex, from: dropFrom, to: dropTo } });
    }
  }
  return out;
}

/**
 * Pens whose lowest observed logical % across all sessions is still
 * above `threshold`. Such pens may have missed the activation
 * threshold, making P00 (IAF) estimates unreliable.
 */
export function findMissingLowEnd(
  sessions: readonly PressureResponse[],
  threshold = 0.5,
): MissingLowEndPen[] {
  const byPen = new Map<string, MissingLowEndPen>();
  for (const s of sessions) {
    if (!byPen.has(s.InventoryId)) {
      byPen.set(s.InventoryId, {
        brand: s.Brand,
        penEntityId: s.PenEntityId,
        inventoryId: s.InventoryId,
        lowestLogical: Infinity,
        sessionCount: 0,
      });
    }
    const entry = byPen.get(s.InventoryId)!;
    entry.sessionCount++;
    for (const [, y] of s.Records) {
      if (y < entry.lowestLogical) entry.lowestLogical = y;
    }
  }
  const out: MissingLowEndPen[] = [];
  for (const entry of byPen.values()) {
    if (entry.lowestLogical === Infinity) continue;
    if (entry.lowestLogical > threshold) out.push(entry);
  }
  return out.sort((a, b) => b.lowestLogical - a.lowestLogical);
}

/** Pens with only one pressure-response session. */
export function findSingleSessionPens(
  sessions: readonly PressureResponse[],
): SingleSessionPen[] {
  const byPen = new Map<string, PressureResponse[]>();
  for (const s of sessions) {
    if (!byPen.has(s.InventoryId)) byPen.set(s.InventoryId, []);
    byPen.get(s.InventoryId)!.push(s);
  }
  const out: SingleSessionPen[] = [];
  for (const arr of byPen.values()) {
    if (arr.length === 1) {
      const s = arr[0];
      out.push({
        brand: s.Brand,
        penEntityId: s.PenEntityId,
        inventoryId: s.InventoryId,
        date: s.Date,
        sessionEntityId: sessionEntityId(s),
      });
    }
  }
  return out.sort(
    (a, b) =>
      a.brand.localeCompare(b.brand) ||
      a.penEntityId.localeCompare(b.penEntityId) ||
      a.inventoryId.localeCompare(b.inventoryId),
  );
}

/**
 * Pens whose most recent session is older than `days` days ago.
 * `now` is injectable for testability.
 */
export function findStaleMeasurements(
  sessions: readonly PressureResponse[],
  days = 365,
  now: Date = new Date(),
): StaleMeasurement[] {
  const byPen = new Map<string, { brand: string; penEntityId: string; date: string }>();
  for (const s of sessions) {
    const existing = byPen.get(s.InventoryId);
    if (!existing || s.Date > existing.date) {
      byPen.set(s.InventoryId, {
        brand: s.Brand,
        penEntityId: s.PenEntityId,
        date: s.Date,
      });
    }
  }
  const out: StaleMeasurement[] = [];
  for (const [inventoryId, entry] of byPen) {
    const last = new Date(entry.date);
    if (isNaN(last.getTime())) continue;
    const daysAgo = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
    if (daysAgo > days) {
      out.push({
        brand: entry.brand,
        penEntityId: entry.penEntityId,
        inventoryId,
        lastDate: entry.date,
        daysAgo,
      });
    }
  }
  return out.sort((a, b) => b.daysAgo - a.daysAgo);
}

/**
 * Pens recommended for re-measurement: union of the missing-low-end,
 * single-session, and stale checks. Each entry lists which reasons
 * apply, sorted by reason count (most reasons first).
 */
export function findRecommendedForRemeasurement(
  sessions: readonly PressureResponse[],
): RemeasureRecommendation[] {
  const recs = new Map<
    string,
    { brand: string; penEntityId: string; inventoryId: string; reasons: Set<RemeasureReason> }
  >();

  function tag(item: PenAggregate, reason: RemeasureReason) {
    if (!recs.has(item.inventoryId)) {
      recs.set(item.inventoryId, {
        brand: item.brand,
        penEntityId: item.penEntityId,
        inventoryId: item.inventoryId,
        reasons: new Set(),
      });
    }
    recs.get(item.inventoryId)!.reasons.add(reason);
  }

  for (const item of findMissingLowEnd(sessions)) tag(item, 'missing-low-end');
  for (const item of findSingleSessionPens(sessions)) tag(item, 'single-session');
  for (const item of findStaleMeasurements(sessions)) tag(item, 'stale');

  return [...recs.values()]
    .map((r) => ({
      brand: r.brand,
      penEntityId: r.penEntityId,
      inventoryId: r.inventoryId,
      reasons: [...r.reasons].sort() as RemeasureReason[],
    }))
    .sort(
      (a, b) =>
        b.reasons.length - a.reasons.length ||
        a.brand.localeCompare(b.brand) ||
        a.penEntityId.localeCompare(b.penEntityId) ||
        a.inventoryId.localeCompare(b.inventoryId),
    );
}
