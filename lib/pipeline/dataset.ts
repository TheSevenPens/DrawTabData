// Generic, named-collection container. Holds zero or more lazily-loaded
// `Query<T>` instances keyed by string name. Subclasses can either expose
// typed accessors that delegate to `.get<T>(name)`, or callers can use
// the `DataSet` directly as an untyped registry.
//
// Loaders are memoized per-name — the supplied loader function is invoked
// at most once per DataSet instance, and every `Query.toArray()` call
// reuses the resulting Promise.

import type { AnyFieldDef } from "./types.js";
import { Query } from "./query.js";

export class DataSet {
  private readonly collections = new Map<string, Query<unknown>>();

  /**
   * Register a named collection. Returns the `Query<T>` so the caller can
   * keep a typed reference. The loader is invoked at most once for the
   * lifetime of this DataSet instance.
   */
  registerCollection<T>(
    name: string,
    loader: () => Promise<T[]>,
    fields: AnyFieldDef[],
  ): Query<T> {
    let cached: Promise<T[]> | undefined;
    const memoizedLoader = (): Promise<T[]> => (cached ??= loader());
    const q = new Query<T>(memoizedLoader, fields, []);
    this.collections.set(name, q as Query<unknown>);
    return q;
  }

  /** Look up a previously-registered collection by name. */
  get<T>(name: string): Query<T> {
    const q = this.collections.get(name);
    if (!q) throw new Error(`No collection named '${name}'`);
    return q as Query<T>;
  }

  /** Names of registered collections, in registration order. */
  collectionNames(): string[] {
    return Array.from(this.collections.keys());
  }
}
