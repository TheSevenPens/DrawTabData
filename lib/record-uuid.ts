/** One UUID namespace across all authored dataset records. */
export function recordUuid(record: Record<string, unknown>): string | undefined {
  const meta = record.Meta as Record<string, unknown> | undefined;
  const id = meta?._id ?? record._id;
  return typeof id === "string" && id ? id.toLowerCase() : undefined;
}

export interface UuidRecord {
  file: string;
  entityId?: string;
  record: Record<string, unknown>;
}

export function duplicateUuids(records: readonly UuidRecord[]): { current: UuidRecord; prior: UuidRecord; uuid: string }[] {
  const seen = new Map<string, UuidRecord>();
  const duplicates: { current: UuidRecord; prior: UuidRecord; uuid: string }[] = [];
  for (const current of records) {
    const uuid = recordUuid(current.record);
    if (!uuid) continue;
    const prior = seen.get(uuid);
    if (prior) duplicates.push({ current, prior, uuid });
    else seen.set(uuid, current);
  }
  return duplicates;
}
