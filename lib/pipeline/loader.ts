// Generic loader contract used by `DataSet.registerCollection`. A loader
// is anything with a `load()` method that resolves to an array of `T`.
// The DataSet does not care where the data comes from — URL, disk,
// IndexedDB, in-memory mock — only that it can be materialised.
//
// `LoaderSource` is the standard discriminated union for the two common
// origins (HTTP/static-asset fetch, local filesystem). Project-specific
// loader implementations can read it directly or define their own.

export interface Loader<T> {
  load(): Promise<T[]>;
}

export type LoaderSource =
  | { kind: "url"; baseUrl: string }
  | { kind: "disk"; dataDir: string };
