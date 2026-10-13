import { describe, expect, it } from "vitest";

import { applyPatches } from "../document/patch.ts";
import { footprintOf } from "../rig/fixture-type.ts";
import {
  BEAM,
  edit,
  held,
  modeOf,
  refused,
  RGB,
  rigged,
  STROBE,
} from "./type-stage.ts";

const keys = (document: Parameters<typeof modeOf>[0], ref = BEAM): string[] =>
  modeOf(document, ref).channels.map((channel) => channel.key);

describe("type.channel.add", () => {
  it("adds at the end, on the root and one byte unless told", () => {
    let document = edit(held(), "type.channel.add", BEAM).document;
    expect(modeOf(document, BEAM).channels.at(-1)).toEqual({
      key: "channel-11",
      element: "root",
      bytes: 1,
      default: 0,
    });
    document = edit(document, "type.channel.add", {
      ...STROBE,
      element: "panel-1",
      name: "Panel 1 Amber",
      bytes: 2,
    }).document;
    expect(modeOf(document, STROBE).channels.at(-1)).toEqual({
      key: "panel-1-amber",
      element: "panel-1",
      bytes: 2,
      default: 0,
    });
    expect(
      refused(document, "type.channel.add", { ...BEAM, element: "ring" }),
    ).toBe("The Mode has no Element “ring”.");
  });

  it("is refused when a Fixture's Footprint would grow into its neighbour, and accepted when there is room", () => {
    const document = rigged();
    expect(refused(document, "type.channel.add", RGB)).toBe(
      "Par has no room for it: Addresses 1 to 4 of Universe 1 overlap Strobe at 4. Repatch it first.",
    );
    // The Beam is last in its Universe, so it can grow.
    const grown = edit(document, "type.channel.add", BEAM);
    expect(footprintOf(modeOf(grown.document, BEAM))).toBe(13);
  });
});

describe("type.channel.update", () => {
  it("renames the key with every Encoding and Action that names it", () => {
    const renamed = edit(held(), "type.channel.update", {
      ...BEAM,
      channel: "control",
      name: "Lamp Control",
    });
    const mode = modeOf(renamed.document, BEAM);
    expect(keys(renamed.document)).toContain("lamp-control");
    expect(keys(renamed.document)).not.toContain("control");
    expect(mode.actions.reset?.channel).toBe("lamp-control");
    const gobo = edit(renamed.document, "type.channel.update", {
      ...BEAM,
      channel: "gobo",
      name: "Gobo Wheel",
    }).document;
    const root = modeOf(gobo, BEAM).elements.root?.parameters;
    expect(root?.gobo1?.encode).toEqual({ range: "gobo-wheel" });
    expect(root?.["gobo1-shake"]?.encode).toMatchObject({
      spread: "gobo-wheel",
      by: "gobo1",
    });
    // A name another Channel has is made unique.
    expect(
      keys(
        edit(gobo, "type.channel.update", {
          ...BEAM,
          channel: "speed",
          name: "Dimmer",
        }).document,
      ),
    ).toContain("dimmer-2");
  });

  it("changes width and rest byte, a property each", () => {
    const changed = edit(held(), "type.channel.update", {
      ...BEAM,
      channel: "dimmer",
      bytes: 2,
      rest: 12,
    });
    expect(
      modeOf(changed.document, BEAM).channels.find(
        (channel) => channel.key === "dimmer",
      ),
    ).toEqual({ key: "dimmer", element: "root", bytes: 2, default: 12 });
    // A Layout is a list, so it travels whole, and nothing else does.
    expect(changed.patches.map((patch) => patch.path.at(-1))).toEqual([
      "channels",
    ]);
  });

  it("refuses to move a Channel to another Element while a Parameter of its Element writes it", () => {
    let document = edit(held(), "type.element.add", {
      ...BEAM,
      name: "Ring",
    }).document;
    expect(
      refused(document, "type.channel.update", {
        ...BEAM,
        channel: "gobo",
        element: "ring",
      }),
    ).toBe(
      "Gobo of Beam Moving Head writes Channel 9 Gobo. Point it at another Channel or remove it first.",
    );
    document = edit(document, "type.channel.update", {
      ...BEAM,
      channel: "speed",
      element: "ring",
    }).document;
    expect(
      modeOf(document, BEAM).channels.find((each) => each.key === "speed")
        ?.element,
    ).toBe("ring");
    expect(
      refused(document, "type.channel.update", {
        ...BEAM,
        channel: "nope",
        rest: 1,
      }),
    ).toBe("The Mode has no Channel “nope”.");
  });
});

describe("type.channel.move and remove", () => {
  it("moves earlier and later on the wire", () => {
    let document = edit(held(), "type.channel.move", {
      ...RGB,
      channel: "blue",
      after: null,
    }).document;
    expect(keys(document, RGB)).toEqual(["blue", "red", "green"]);
    document = edit(document, "type.channel.move", {
      ...RGB,
      channel: "blue",
      after: "red",
    }).document;
    expect(keys(document, RGB)).toEqual(["red", "blue", "green"]);
    expect(
      refused(document, "type.channel.move", {
        ...RGB,
        channel: "blue",
        after: "blue",
      }),
    ).toBe("A Channel cannot be placed after itself.");
  });

  it("refuses a Channel a Parameter or an Action names, and the last one", () => {
    const document = held();
    expect(
      refused(document, "type.channel.remove", { ...BEAM, channel: "gobo" }),
    ).toBe(
      "Gobo of Beam Moving Head writes Channel 9 Gobo. Point it at another Channel or remove it first.",
    );
    expect(
      refused(document, "type.channel.remove", { ...BEAM, channel: "control" }),
    ).toBe(
      "Action “Reset” holds Channel 12 Control. Change or remove it first.",
    );
    const removed = edit(document, "type.channel.remove", {
      ...BEAM,
      channel: "speed",
    });
    expect(keys(removed.document)).not.toContain("speed");
    expect(applyPatches(removed.document, removed.inverse)).toEqual(document);
    let blank = edit(document, "type.mode.add", {
      typeKey: BEAM.typeKey,
      name: "Bare",
    }).document;
    expect(
      refused(blank, "type.channel.remove", {
        typeKey: BEAM.typeKey,
        modeKey: "bare",
        channel: "channel-1",
      }),
    ).toBe("A Mode needs at least one Channel.");
    blank = edit(blank, "type.channel.add", {
      typeKey: BEAM.typeKey,
      modeKey: "bare",
    }).document;
    expect(
      keys(
        edit(blank, "type.channel.remove", {
          typeKey: BEAM.typeKey,
          modeKey: "bare",
          channel: "channel-1",
        }).document,
        { typeKey: BEAM.typeKey, modeKey: "bare" },
      ),
    ).toEqual(["channel-2"]);
  });
});
