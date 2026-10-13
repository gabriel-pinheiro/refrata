import { describe, expect, it } from "vitest";

import { applyPatches } from "../document/patch.ts";
import {
  BEAM,
  edit,
  held,
  modeOf,
  refused,
  RGB,
  rigged,
} from "./type-stage.ts";

describe("type.mode.add, update and remove", () => {
  it("adds a blank Mode or a copy of another, the key from the name", () => {
    let document = edit(held(), "type.mode.add", {
      typeKey: BEAM.typeKey,
      name: "16ch Extended",
      from: "12ch",
    }).document;
    const copy = modeOf(document, { ...BEAM, modeKey: "16ch-extended" });
    expect(copy).toEqual({ ...modeOf(document, BEAM), name: "16ch Extended" });
    document = edit(document, "type.mode.add", {
      typeKey: BEAM.typeKey,
      name: "16ch extended",
    }).document;
    const blank = modeOf(document, { ...BEAM, modeKey: "16ch-extended-2" });
    expect(blank.channels).toEqual([
      { key: "channel-1", element: "root", bytes: 1, default: 0 },
    ]);
    expect(blank.elements.root?.name).toBe("Beam Moving Head");
    expect(
      refused(document, "type.mode.add", {
        typeKey: BEAM.typeKey,
        name: "Wide",
        from: "nope",
      }),
    ).toBe("Beam Moving Head has no Mode “nope”.");
    expect(
      refused(document, "type.mode.add", { typeKey: BEAM.typeKey, name: "—" }),
    ).toBe("Give the Mode a name with a letter or a digit.");
  });

  it("renames without the key following, sets notes and the Shape Template", () => {
    let document = edit(held(), "type.mode.update", {
      ...BEAM,
      name: "Standard",
      notes: "As shipped",
      shape: { template: "bar", tag: "pixel", count: 4 },
    }).document;
    expect(modeOf(document, BEAM)).toMatchObject({
      name: "Standard",
      notes: "As shipped",
      shape: { template: "bar", tag: "pixel", count: 4 },
    });
    const single = edit(document, "type.mode.update", {
      ...BEAM,
      notes: "",
      shape: { template: "single" },
    });
    document = single.document;
    expect("notes" in modeOf(document, BEAM)).toBe(false);
    expect(modeOf(document, BEAM).shape).toEqual({ template: "single" });
    // The shape's own properties went one by one, not the Mode whole.
    expect(single.patches.map((patch) => patch.path.at(-1)).sort()).toEqual([
      "count",
      "notes",
      "tag",
      "template",
    ]);
  });

  it("refuses the last Mode and a Mode a Fixture is on", () => {
    let document = rigged();
    expect(refused(document, "type.mode.remove", RGB)).toBe(
      "A Fixture Type needs at least one Mode.",
    );
    document = edit(document, "type.mode.add", {
      typeKey: RGB.typeKey,
      name: "Wide",
      from: "3ch",
    }).document;
    expect(refused(document, "type.mode.remove", RGB)).toBe(
      "Par is on Mode “3ch”. Change its Mode first.",
    );
    const removed = edit(document, "type.mode.remove", {
      typeKey: RGB.typeKey,
      modeKey: "wide",
    });
    expect(
      Object.keys(removed.document.fixtureTypes[RGB.typeKey]!.type.modes),
    ).toEqual(["3ch"]);
    expect(applyPatches(removed.document, removed.inverse)).toEqual(document);
  });
});
