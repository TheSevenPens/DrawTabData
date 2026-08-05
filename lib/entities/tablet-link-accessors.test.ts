import { describe, it, expect } from "vitest";
import { tabletManufacturerProductLink, tabletManufacturerUserManual } from "./tablet-link-accessors.js";
import type { Tablet } from "../drawtab-loader.js";

const tab = (links?: unknown[]) => ({ Model: { Links: links } }) as unknown as Tablet;

describe("tablet manufacturer link accessors", () => {
  it("returns the MANUFACTURER* entry's URL, ignoring plain PRODUCTINFO/USERMANUAL", () => {
    const t = tab([
      { Type: "REVIEW", URL: "https://r" },
      { Type: "PRODUCTINFO", URL: "https://p-other" },
      { Type: "MANUFACTURERPRODUCTINFO", URL: "https://p" },
      { Type: "MANUFACTURERUSERMANUAL", URL: "https://m" },
    ]);
    expect(tabletManufacturerProductLink(t)).toBe("https://p");
    expect(tabletManufacturerUserManual(t)).toBe("https://m");
  });

  it("returns '' when the manufacturer entry is absent or there are no links", () => {
    expect(tabletManufacturerProductLink(tab([{ Type: "PRODUCTINFO", URL: "https://x" }]))).toBe("");
    expect(tabletManufacturerUserManual(tab())).toBe("");
    expect(tabletManufacturerProductLink(tab())).toBe("");
  });
});
