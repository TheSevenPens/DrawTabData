// Node-only file changes with exact-byte rollback on a failed commit.
// Callers validate a complete candidate before applying this plan.
import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";

export type FilePlan = ReadonlyMap<string, Buffer | null>;

export function atomicWriteFile(file: string, bytes: string | Buffer): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(tmp, bytes);
    fs.renameSync(tmp, file);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

/** Reject absolute paths and traversal before touching any file. */
export function resolveOwnedPath(root: string, relative: string): string {
  if (path.isAbsolute(relative) || relative.split(/[\\/]/).some(p => p === "..") || relative.includes(":")) {
    throw new Error(`Not a repository-relative path: ${relative}`);
  }
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(path.resolve(root) + path.sep)) throw new Error(`Path escapes repository: ${relative}`);
  return resolved;
}

/** Exception-safe rollback; not crash-atomic publication across files. */
export function applyFilePlan(root: string, plan: FilePlan): void {
  const changes = [...plan].map(([rel, bytes]) => {
    const file = resolveOwnedPath(root, rel);
    const before = fs.existsSync(file) ? fs.readFileSync(file) : null;
    return { file, bytes, before };
  }).filter(x => x.bytes === null ? x.before !== null : !x.before?.equals(x.bytes));
  const applied: typeof changes = [];
  try {
    for (const change of changes) {
      if (change.bytes === null) fs.rmSync(change.file);
      else atomicWriteFile(change.file, change.bytes);
      applied.push(change);
    }
  } catch (error) {
    const errors: unknown[] = [error];
    for (const change of applied.reverse()) {
      try {
        if (change.before === null) fs.rmSync(change.file, { force: true });
        else atomicWriteFile(change.file, change.before);
      } catch (rollbackError) { errors.push(rollbackError); }
    }
    if (errors.length > 1) throw new AggregateError(errors, "Write failed and rollback could not restore every file");
    throw error;
  }
}
