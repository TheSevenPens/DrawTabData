// Resolve a family named on the command line: the full EntityId
// ("xppen.tabletfamily.xppenartistgen2") or just its last segment
// ("xppenartistgen2"), case-insensitive. Shared by set-family.ts and
// show-family.ts so both accept the same spellings.

export function findFamily<T extends { EntityId: string }>(families: readonly T[], arg: string): T | undefined {
  const wanted = arg.trim().toLowerCase();
  return families.find(
    (f) => f.EntityId.toLowerCase() === wanted || f.EntityId.toLowerCase().split(".").pop() === wanted,
  );
}
