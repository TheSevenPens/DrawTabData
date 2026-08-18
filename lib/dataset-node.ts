// Node-only entry point for DrawTabDataSet.
//
// dataset.ts is reachable from every browser bundle that touches the data
// layer, so it must not statically import anything that reaches node:fs.
// The disk loader therefore isn't imported there — it's injected, and this
// module is the one place that does the injecting. Importing this file from
// browser code is the mistake it exists to make obvious.
//
//   import { createDiskDataSet } from "$data/lib/dataset-node.js";
//   const ds = createDiskDataSet({ dataDir: "data-repo/data", userId: "sevenpens" });

import { DrawTabDataSet } from "./dataset.js";
import { ShardedDiskLoader } from "./drawtab-loader-node.js";

export function createDiskDataSet(opts: {
  dataDir: string;
  userId?: string;
}): DrawTabDataSet {
  return new DrawTabDataSet(
    { kind: "disk", dataDir: opts.dataDir, userId: opts.userId },
    { diskLoaderFactory: (dataDir, loaderOpts) => new ShardedDiskLoader(dataDir, loaderOpts) },
  );
}
