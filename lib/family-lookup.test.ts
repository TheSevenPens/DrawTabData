import { describe, expect, it } from "vitest";
import { findFamily } from "./family-lookup.js";

const families = [
  { EntityId: "xppen.tabletfamily.xppenartistgen2", FamilyName: "Artist Gen 2" },
  { EntityId: "wacom.tabletfamily.wacom_intuospro_2025", FamilyName: "Intuos Pro 2025" },
];

describe("findFamily", () => {
  it("matches the full EntityId or its last segment, case-insensitively", () => {
    expect(findFamily(families, "xppen.tabletfamily.xppenartistgen2")?.FamilyName).toBe("Artist Gen 2");
    expect(findFamily(families, "XPPenArtistGen2")?.FamilyName).toBe("Artist Gen 2");
    expect(findFamily(families, " wacom_intuospro_2025 ")?.FamilyName).toBe("Intuos Pro 2025");
  });

  it("returns undefined for an unknown or partial name", () => {
    expect(findFamily(families, "artistgen")).toBeUndefined();
  });
});
