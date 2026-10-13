import { describe, expect, it } from "vitest";

import { applyPatches } from "../document/patch.ts";
import type { Document } from "../document/document.ts";
import {
  BEAM,
  edit,
  held,
  modeOf,
  refused,
  RGB,
  STROBE,
} from "./type-stage.ts";

const ROOT = { ...BEAM, element: "root" };

const parameter = (document: Document, attribute: string, ref = BEAM) =>
  modeOf(document, ref).elements.root?.parameters[attribute];

describe("type.parameter.add", () => {
  it("fills in the first rule that reads the Attribute's kind, on the Element's Channels", () => {
    let document = edit(held(), "type.parameter.add", {
      ...ROOT,
      attribute: "strobe",
    }).document;
    expect(parameter(document, "strobe")).toEqual({ encode: { scale: "pan" } });
    document = edit(document, "type.parameter.add", {
      ...ROOT,
      attribute: "control",
    }).document;
    expect(parameter(document, "control")).toEqual({
      options: [{ value: "none", label: "No function", bytes: [0, 9] }],
      encode: { range: "pan" },
    });
    // A colour starts as a mix, a boolean as the two halves of the Channel.
    let rgb = edit(held(), "type.parameter.remove", {
      ...RGB,
      element: "root",
      attribute: "color",
    }).document;
    rgb = edit(rgb, "type.parameter.add", {
      ...RGB,
      element: "root",
      attribute: "color",
    }).document;
    expect(parameter(rgb, "color", RGB)).toEqual({
      encode: { color: ["red", "green", "blue"] },
    });
    rgb = edit(rgb, "type.parameter.add", {
      ...RGB,
      element: "root",
      attribute: "prism",
    }).document;
    expect(parameter(rgb, "prism", RGB)).toEqual({
      encode: { switch: "red", off: [0, 127], on: [128, 255] },
    });
  });

  it("refuses what it cannot fill in, saying why", () => {
    const document = held();
    expect(
      refused(document, "type.parameter.add", {
        ...STROBE,
        element: "backlight",
        attribute: "dimmer",
      }),
    ).toBe("Backlight has no Channel. Give it one first.");
    expect(
      refused(document, "type.parameter.add", {
        ...ROOT,
        attribute: "shutter",
      }),
    ).toBe("Shutter has no Encoding rule yet, so a Mode cannot declare it.");
    expect(
      refused(document, "type.parameter.add", { ...ROOT, attribute: "dimmer" }),
    ).toBe("Beam Moving Head already has Dimmer.");
    expect(
      refused(document, "type.parameter.add", { ...ROOT, attribute: "laser" }),
    ).toBe("“laser” is not an Attribute.");
    expect(
      refused(document, "type.parameter.add", {
        ...STROBE,
        element: "section-1",
        attribute: "color",
      }),
    ).toBe("Color needs three Channels, and Section 1 has 1.");
  });
});

describe("type.parameter.update", () => {
  it("changes Default, Highlight, range, unit, notes and Settle, a property each", () => {
    const changed = edit(held(), "type.parameter.update", {
      ...ROOT,
      attribute: "tilt",
      default: 10,
      highlight: 45,
      min: -100,
      max: 100,
      unit: "deg",
      notes: "Measured",
    });
    expect(parameter(changed.document, "tilt")).toEqual({
      default: 10,
      highlight: 45,
      min: -100,
      max: 100,
      unit: "deg",
      notes: "Measured",
      encode: { scale: "tilt" },
    });
    expect(changed.patches.map((patch) => patch.path.at(-1)).sort()).toEqual([
      "default",
      "highlight",
      "max",
      "min",
      "notes",
      "unit",
    ]);
    const cleared = edit(changed.document, "type.parameter.update", {
      ...ROOT,
      attribute: "tilt",
      highlight: null,
      min: null,
      unit: "",
      notes: "",
    }).document;
    expect(parameter(cleared, "tilt")).toEqual({
      default: 10,
      max: 100,
      encode: { scale: "tilt" },
    });
    let settled = edit(cleared, "type.parameter.update", {
      ...ROOT,
      attribute: "color",
      settle: null,
    }).document;
    expect(parameter(settled, "color")?.settle).toBeUndefined();
    settled = edit(settled, "type.parameter.update", {
      ...ROOT,
      attribute: "color",
      settle: { base: 0.1, perSlot: 0.05 },
    }).document;
    expect(parameter(settled, "color")?.settle).toEqual({
      base: 0.1,
      perSlot: 0.05,
    });
  });

  it("moves a Default outside a new range to its nearest end, and refuses a value of the wrong kind", () => {
    const document = edit(held(), "type.parameter.update", {
      ...ROOT,
      attribute: "tilt",
      default: 80,
    }).document;
    expect(
      parameter(
        edit(document, "type.parameter.update", {
          ...ROOT,
          attribute: "tilt",
          max: 45,
        }).document,
        "tilt",
      )?.default,
    ).toBe(45);
    expect(
      refused(document, "type.parameter.update", {
        ...ROOT,
        attribute: "tilt",
        default: 500,
      }),
    ).toBe("The Default of Tilt must be between -90 and 90.");
    expect(
      refused(document, "type.parameter.update", {
        ...ROOT,
        attribute: "gobo1",
        highlight: "nope",
      }),
    ).toContain("The Highlight of Gobo must be one of open, medium");
    expect(
      refused(document, "type.parameter.update", {
        ...ROOT,
        attribute: "tilt",
        min: 90,
      }),
    ).toBe("The lowest value, 90, must be below the highest, 90.");
    expect(
      refused(document, "type.parameter.update", {
        ...ROOT,
        attribute: "prism",
        max: 2,
      }),
    ).toBe("Prism is a boolean; only a number has a range and a unit.");
    expect(
      refused(document, "type.parameter.update", {
        ...ROOT,
        attribute: "dimmer",
        settle: { base: 0.1, perSlot: 0 },
      }),
    ).toBe("Settle is for a colour on a wheel.");
  });

  it("changes the Attribute: the same kind keeps the Encoding, another starts fresh", () => {
    const document = held();
    const same = edit(document, "type.parameter.update", {
      ...ROOT,
      attribute: "gobo1",
      to: "control",
    }).document;
    const root = modeOf(same, BEAM).elements.root?.parameters;
    expect(root?.gobo1).toBeUndefined();
    expect(root?.control?.encode).toEqual({ range: "gobo" });
    expect(root?.control?.options).toEqual(
      parameter(document, "gobo1")?.options,
    );
    // The spread that followed it follows it still.
    expect(root?.["gobo1-shake"]?.encode).toMatchObject({ by: "control" });
    expect(
      refused(document, "type.parameter.update", {
        ...ROOT,
        attribute: "gobo1",
        to: "strobe",
      }),
    ).toBe(
      "Gobo shake follows Gobo. Remove it or make it follow another Parameter first.",
    );
    const other = edit(document, "type.parameter.update", {
      ...ROOT,
      attribute: "dimmer",
      to: "control",
    }).document;
    expect(parameter(other, "control")).toEqual({
      notes: "0 to 9 is off on the unit; 10 to 255 is dark to bright.",
      options: [{ value: "none", label: "No function", bytes: [0, 9] }],
      encode: { range: "pan" },
    });
    expect(
      refused(document, "type.parameter.update", {
        ...ROOT,
        attribute: "dimmer",
        to: "pan",
      }),
    ).toBe("Beam Moving Head already has Pan.");
  });
});

describe("type.parameter.remove", () => {
  it("refuses a Parameter a spread follows, and removes one nothing follows", () => {
    const document = held();
    expect(
      refused(document, "type.parameter.remove", {
        ...ROOT,
        attribute: "prism",
      }),
    ).toBe(
      "Prism rotation follows Prism. Remove it or make it follow another Parameter first.",
    );
    const removed = edit(document, "type.parameter.remove", {
      ...ROOT,
      attribute: "prism-rotation",
    });
    expect(parameter(removed.document, "prism-rotation")).toBeUndefined();
    expect(applyPatches(removed.document, removed.inverse)).toEqual(document);
    expect(
      parameter(
        edit(removed.document, "type.parameter.remove", {
          ...ROOT,
          attribute: "prism",
        }).document,
        "prism",
      ),
    ).toBeUndefined();
  });
});

describe("type.encoding.set", () => {
  it("offers only the rules that read the Attribute's kind", () => {
    const document = held();
    expect(
      refused(document, "type.encoding.set", {
        ...ROOT,
        attribute: "dimmer",
        rule: "range",
      }),
    ).toBe("Range reads a choice, and Dimmer is a number.");
    expect(
      refused(document, "type.encoding.set", {
        ...RGB,
        element: "root",
        attribute: "dimmer",
        rule: "spread",
      }),
    ).toBe(
      "Spread follows a choice or a switch of the same Element, and RGB has none.",
    );
  });

  it("starts a rule fresh, then points it at Channels of the Element", () => {
    let document = edit(held(), "type.encoding.set", {
      ...RGB,
      element: "root",
      attribute: "dimmer",
      rule: "scale",
      channel: "blue",
    }).document;
    expect(parameter(document, "dimmer", RGB)?.encode).toEqual({
      scale: "blue",
    });
    document = edit(document, "type.encoding.set", {
      ...RGB,
      element: "root",
      attribute: "dimmer",
      rule: "multiply",
    }).document;
    expect(parameter(document, "dimmer", RGB)?.encode).toEqual({
      multiply: ["red", "green", "blue"],
    });
    document = edit(document, "type.encoding.set", {
      ...RGB,
      element: "root",
      attribute: "color",
      rule: "wheel",
      dims: ["green"],
    }).document;
    expect(parameter(document, "color", RGB)).toMatchObject({
      swatches: [{ label: "White", color: [1, 1, 1], bytes: [0, 9] }],
      encode: { wheel: "red", multiply: ["green"] },
    });
    document = edit(document, "type.encoding.set", {
      ...RGB,
      element: "root",
      attribute: "color",
      rule: "color",
      channels: ["red", "green", "blue"],
    }).document;
    expect(parameter(document, "color", RGB)?.swatches).toBeUndefined();
    expect(
      refused(document, "type.encoding.set", {
        ...RGB,
        element: "root",
        attribute: "color",
        channel: "red",
      }),
    ).toBe("Color has no single Channel.");
    expect(
      refused(document, "type.encoding.set", {
        ...RGB,
        element: "root",
        attribute: "color",
        channels: ["red", "green"],
      }),
    ).toBe(
      "Color takes a red, a green and a blue Channel, and an optional white.",
    );
    expect(
      refused(held(), "type.encoding.set", {
        ...STROBE,
        element: "panel-1",
        attribute: "color",
        channels: ["panel-1-red", "panel-1-green", "panel-2-blue"],
      }),
    ).toBe("Channel 6 Panel 2 Blue belongs to Panel 2, not to Panel 1.");
  });

  it("sets a switch's ranges, and a spread keeps sharing the Channel it follows", () => {
    let document = edit(held(), "type.encoding.set", {
      ...ROOT,
      attribute: "prism",
      channel: "auto",
      off: [0, 49],
      on: [50, 99],
    }).document;
    expect(parameter(document, "prism")?.encode).toEqual({
      switch: "auto",
      off: [0, 49],
      on: [50, 99],
    });
    expect(parameter(document, "prism-rotation")?.encode).toMatchObject({
      spread: "auto",
      by: "prism",
    });
    expect(
      refused(document, "type.encoding.set", {
        ...ROOT,
        attribute: "prism",
        on: [200, 100],
      }),
    ).toBe("A byte range runs low to high, and 200 to 100 does not.");
    document = edit(document, "type.encoding.set", {
      ...ROOT,
      attribute: "prism-rotation",
      ranges: { on: null, off: [100, 255] },
    }).document;
    expect(parameter(document, "prism-rotation")?.encode).toEqual({
      spread: "auto",
      by: "prism",
      ranges: { off: [100, 255] },
    });
    document = edit(document, "type.encoding.set", {
      ...ROOT,
      attribute: "prism-rotation",
      follows: "gobo1",
      ranges: { open: [240, 255] },
    }).document;
    expect(parameter(document, "prism-rotation")?.encode).toEqual({
      spread: "gobo",
      by: "gobo1",
      ranges: { open: [240, 255] },
    });
    expect(
      refused(document, "type.encoding.set", {
        ...ROOT,
        attribute: "prism-rotation",
        ranges: { nope: [0, 1] },
      }),
    ).toBe("Gobo has no “nope” to hold a range for.");
    expect(
      refused(document, "type.encoding.set", {
        ...ROOT,
        attribute: "prism-rotation",
        follows: "dimmer",
      }),
    ).toBe(
      "Spread follows a choice or a switch of the same Element, and “dimmer” is not one.",
    );
  });
});

describe("type.option and type.swatch", () => {
  const GOBO = { ...ROOT, attribute: "gobo1" };
  const COLOR = { ...ROOT, attribute: "color" };

  it("adds an option where the last ends, with a value its label never changes afterwards", () => {
    const before = parameter(held(), "gobo1")?.options ?? [];
    const last = before.at(-1);
    let document = edit(held(), "type.option.update", {
      ...GOBO,
      option: last?.value,
      bytes: [84, 89],
    }).document;
    document = edit(document, "type.option.add", {
      ...GOBO,
      label: "Small",
    }).document;
    expect(parameter(document, "gobo1")?.options?.at(-1)).toEqual({
      value: "small-2",
      label: "Small",
      bytes: [90, 95],
    });
    document = edit(document, "type.option.update", {
      ...GOBO,
      option: "small-2",
      label: "Tiny Dots",
    }).document;
    expect(parameter(document, "gobo1")?.options?.at(-1)).toEqual({
      value: "small-2",
      label: "Tiny Dots",
      bytes: [90, 95],
    });
    expect(
      refused(document, "type.option.update", {
        ...GOBO,
        option: "small-2",
        bytes: [9, 3],
      }),
    ).toBe("A byte range runs low to high, and 9 to 3 does not.");
    expect(
      refused(document, "type.option.add", { ...COLOR, label: "Red" }),
    ).toBe("Color is not a choice and has no options.");
  });

  it("removes an option with the range a spread holds for it, but never the last", () => {
    let document = edit(held(), "type.parameter.update", {
      ...GOBO,
      default: "line",
    }).document;
    const removed = edit(document, "type.option.remove", {
      ...GOBO,
      option: "line",
    });
    document = removed.document;
    expect(
      parameter(document, "gobo1")?.options?.map((option) => option.value),
    ).not.toContain("line");
    expect(parameter(document, "gobo1")?.default).toBeUndefined();
    const shake = parameter(document, "gobo1-shake")?.encode;
    expect(
      shake !== undefined && "spread" in shake && "line" in shake.ranges,
    ).toBe(false);
    let control = edit(held(), "type.parameter.add", {
      ...ROOT,
      attribute: "control",
    }).document;
    expect(
      refused(control, "type.option.remove", {
        ...ROOT,
        attribute: "control",
        option: "none",
      }),
    ).toBe("Control needs at least one option.");
    control = edit(control, "type.option.add", {
      ...ROOT,
      attribute: "control",
      label: "Lamp on",
    }).document;
    expect(parameter(control, "control")?.options?.at(-1)).toEqual({
      value: "lamp-on",
      label: "Lamp on",
      bytes: [10, 19],
    });
  });

  it("adds, changes and removes swatches, but never the last", () => {
    const count = parameter(held(), "color")?.swatches?.length ?? 0;
    let document = edit(held(), "type.swatch.update", {
      ...COLOR,
      index: count - 1,
      bytes: [200, 209],
    }).document;
    document = edit(document, "type.swatch.add", COLOR).document;
    expect(parameter(document, "color")?.swatches?.at(-1)).toEqual({
      label: "New",
      color: [1, 1, 1],
      bytes: [210, 219],
    });
    document = edit(document, "type.swatch.update", {
      ...COLOR,
      index: count,
      label: "Lime",
      color: [0.5, 1, 0],
    }).document;
    expect(parameter(document, "color")?.swatches?.at(-1)).toEqual({
      label: "Lime",
      color: [0.5, 1, 0],
      bytes: [210, 219],
    });
    document = edit(document, "type.swatch.remove", {
      ...COLOR,
      index: count,
    }).document;
    expect(parameter(document, "color")?.swatches).toHaveLength(count);
    expect(
      refused(document, "type.swatch.remove", { ...COLOR, index: 99 }),
    ).toBe("Color has no swatch 100.");
    let wheel = edit(held(), "type.encoding.set", {
      ...RGB,
      element: "root",
      attribute: "color",
      rule: "wheel",
    }).document;
    expect(
      refused(wheel, "type.swatch.remove", {
        ...RGB,
        element: "root",
        attribute: "color",
        index: 0,
      }),
    ).toBe("A wheel needs at least one swatch.");
    wheel = edit(wheel, "type.swatch.update", {
      ...RGB,
      element: "root",
      attribute: "color",
      index: 0,
      bytes: [0, 255],
    }).document;
    expect(
      refused(wheel, "type.swatch.add", {
        ...RGB,
        element: "root",
        attribute: "color",
      }),
    ).toBe(
      "The last range ends at 255. Make room, or give the swatch its bytes.",
    );
  });
});
