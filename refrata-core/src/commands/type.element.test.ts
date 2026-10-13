import { describe, expect, it } from "vitest";

import { applyPatches } from "../document/patch.ts";
import {
  BEAM,
  edit,
  held,
  modeOf,
  refused,
  rigged,
  run,
  STROBE,
} from "./type-stage.ts";

describe("type.element.add and update", () => {
  it("adds under a parent with a key from its name that a rename never changes", () => {
    let document = edit(held(), "type.element.add", {
      ...BEAM,
      name: "Pixel Ring",
    }).document;
    document = edit(document, "type.element.add", {
      ...BEAM,
      parent: "pixel-ring",
      name: "Pixel Ring",
    }).document;
    const mode = modeOf(document, BEAM);
    expect(mode.elements.root?.children).toEqual(["pixel-ring"]);
    expect(mode.elements["pixel-ring"]?.children).toEqual(["pixel-ring-2"]);
    expect(mode.elements["pixel-ring-2"]).toEqual({
      name: "Pixel Ring",
      children: [],
      tags: [],
      parameters: {},
    });
    document = edit(document, "type.element.update", {
      ...BEAM,
      element: "pixel-ring",
      name: "Halo",
      tags: ["ring", "ring", "outer"],
    }).document;
    expect(modeOf(document, BEAM).elements["pixel-ring"]).toMatchObject({
      name: "Halo",
      tags: ["ring", "outer"],
    });
    expect(refused(document, "type.element.add", { ...BEAM, name: "?" })).toBe(
      "Give the Element a name with a letter or a digit.",
    );
    expect(
      refused(document, "type.element.update", {
        ...BEAM,
        element: "pixel-ring",
        tags: ["Outer Ring"],
      }),
    ).toBe(
      "“Outer Ring” is not a Tag: use lowercase letters, digits and dashes.",
    );
  });
});

describe("type.element.move", () => {
  it("moves among siblings and under another parent, never under its own descendants", () => {
    let document = edit(held(), "type.element.move", {
      ...STROBE,
      element: "strobe",
      after: null,
    }).document;
    expect(modeOf(document, STROBE).elements.root?.children).toEqual([
      "strobe",
      "backlight",
    ]);
    document = edit(document, "type.element.move", {
      ...STROBE,
      element: "panel-8",
      parent: "strobe",
      after: "section-1",
    }).document;
    const mode = modeOf(document, STROBE);
    expect(mode.elements.backlight?.children).not.toContain("panel-8");
    expect(mode.elements.strobe?.children.slice(0, 3)).toEqual([
      "section-1",
      "panel-8",
      "section-2",
    ]);
    expect(
      refused(document, "type.element.move", {
        ...STROBE,
        element: "backlight",
        parent: "panel-1",
      }),
    ).toBe("An Element cannot go under itself or its own descendants.");
    expect(
      refused(document, "type.element.move", {
        ...STROBE,
        element: "root",
        parent: "strobe",
      }),
    ).toBe("The root Element stays at the top.");
  });
});

describe("type.element.remove", () => {
  it("removes an Element with its descendants: their Channels go to its parent, their Parameters go", () => {
    const document = held();
    const removed = edit(document, "type.element.remove", {
      ...STROBE,
      element: "backlight",
    });
    const mode = modeOf(removed.document, STROBE);
    expect(Object.keys(mode.elements)).not.toContain("backlight");
    expect(Object.keys(mode.elements)).not.toContain("panel-3");
    expect(mode.elements.root?.children).toEqual(["strobe"]);
    expect(
      mode.channels.find((channel) => channel.key === "panel-3-red")?.element,
    ).toBe("root");
    expect(mode.channels).toHaveLength(32);
    expect(applyPatches(removed.document, removed.inverse)).toEqual(document);
    expect(
      refused(document, "type.element.remove", { ...STROBE, element: "root" }),
    ).toBe("The root Element cannot be removed.");
  });

  it("on a type in use, drops what pointed at the Element, with warnings, and undo brings it all back", () => {
    let document = rigged();
    document = run(document, "address.set", {
      address: "element/strobe/panel-8/highlight",
      value: true,
    }).document;
    const removed = edit(document, "type.element.remove", {
      ...STROBE,
      element: "panel-8",
    });
    const after = removed.document;
    expect(after.fixtureSets.edge).toMatchObject({
      members: ["strobe/panel-7"],
    });
    const layer = after.layers.base;
    expect(
      layer?.kind === "look" ? layer.targets.map((target) => target.ref) : [],
    ).toEqual(["par/root"]);
    expect(Object.keys(after.links)).toEqual([]);
    expect(after.operational.highlight).toEqual({});
    expect(removed.warnings).toEqual([
      "Removed 1 Fixture Set member",
      "Removed 1 Layer Target",
      "Removed 1 Link",
    ]);
    expect(applyPatches(after, removed.inverse)).toEqual(document);
  });
});
