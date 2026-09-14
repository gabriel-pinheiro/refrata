import { describe, expect, it } from "vitest";

import rgbJson from "../../../refrata-library/generic/rgb-3ch.json" with { type: "json" };
import strobeJson from "../../../refrata-library/showtech/st-960.json" with { type: "json" };
import { listAddresses, resolveAddress } from "../address/address.ts";
import { executeCommand } from "../command/execute.ts";
import { resolveDocument } from "../composition/resolve.ts";
import { emptyDocument, type Document } from "../document/document.ts";
import { flattenStack } from "../document/layers.ts";
import { orderedEntries } from "../document/order.ts";
import { applyPatches } from "../document/patch.ts";
import { formatFrame, universeFrame } from "../rig/frames.ts";
import { createBuiltInRegistry } from "./index.ts";

const registry = createBuiltInRegistry();

function run(document: Document, name: string, payload: unknown) {
  const result = executeCommand(registry, document, name, payload);
  if (!result.ok) throw new Error(result.error);
  return result;
}

function failure(document: Document, name: string, payload: unknown): string {
  const result = executeCommand(registry, document, name, payload);
  if (result.ok) throw new Error(`${name} was accepted.`);
  return result.error;
}

function apply(document: Document, steps: readonly [string, unknown][]) {
  let current = document;
  for (const [name, payload] of steps)
    current = run(current, name, payload).document;
  return current;
}

/** A Par and a Strobe, Scene Verse with Look Layer Base on both roots. */
function stage(): Document {
  return apply(emptyDocument("Club"), [
    [
      "fixture.create",
      {
        id: "par",
        typeKey: "generic/rgb-3ch",
        modeKey: "3ch",
        fixtureType: rgbJson,
        name: "Par",
      },
    ],
    [
      "fixture.create",
      {
        id: "strobe",
        typeKey: "showtech/st-960",
        modeKey: "32ch",
        fixtureType: strobeJson,
        name: "Strobe",
      },
    ],
    ["scene.create", { id: "verse", name: "Verse" }],
    [
      "layer.create",
      {
        id: "base",
        sceneId: "verse",
        name: "Base",
        targets: ["par/root", "strobe/root"],
      },
    ],
  ]);
}

function resolved(document: Document, ref: string) {
  return resolveDocument(document).get(ref);
}

describe("Scenes", () => {
  it("creates, names uniquely, orders, duplicates with Layers and refuses to remove the active one", () => {
    let document = stage();
    expect(document.installation.activeScene).toBe("verse");
    document = run(document, "scene.create", {
      id: "chorus",
      name: "Verse",
    }).document;
    expect(document.scenes.chorus?.name).toBe("Verse 1");
    expect(orderedEntries(document.scenes).map((s) => s.id)).toEqual([
      "verse",
      "chorus",
    ]);
    document = run(document, "scene.move", {
      sceneId: "chorus",
      after: null,
    }).document;
    expect(orderedEntries(document.scenes).map((s) => s.id)).toEqual([
      "chorus",
      "verse",
    ]);
    document = run(document, "scene.rename", {
      sceneId: "chorus",
      name: "Chorus",
    }).document;
    const copied = run(document, "scene.duplicate", {
      sceneId: "verse",
      id: "verse2",
    }).document;
    expect(copied.scenes.verse2?.name).toBe("Verse 1");
    const copies = Object.values(copied.layers).filter(
      (l) => l.sceneId === "verse2",
    );
    expect(copies).toHaveLength(1);
    expect(copies[0]).toMatchObject({ kind: "look", name: "Base" });
    expect(failure(document, "scene.remove", { sceneId: "verse" })).toContain(
      "active",
    );
    const removal = run(document, "scene.remove", { sceneId: "chorus" });
    expect(removal.document.scenes.chorus).toBeUndefined();
    expect(applyPatches(removal.document, removal.inverse)).toEqual(document);
  });

  it("plays a Scene through its trigger Address, as a cut", () => {
    let document = stage();
    document = run(document, "scene.create", {
      id: "chorus",
      name: "Chorus",
    }).document;
    const played = run(document, "address.trigger", {
      address: "scene/chorus/play",
    });
    expect(played.definition.kind).toBe("performance");
    expect(played.document.installation.activeScene).toBe("chorus");
    expect(played.events).toEqual(["scene/chorus/play"]);
    expect(
      failure(document, "address.trigger", { address: "scene/nope/play" }),
    ).toContain("Unknown");
  });
});

describe("Layers", () => {
  it("stacks Look Layers and Groups topmost first, moves, ungroups and removes with Links", () => {
    let document = stage();
    document = apply(document, [
      [
        "layer.create",
        { id: "g", kind: "group", sceneId: "verse", name: "Folder" },
      ],
      [
        "layer.create",
        { id: "top", sceneId: "verse", name: "Top", parentId: "g" },
      ],
    ]);
    expect(flattenStack(document.layers, "verse").map((l) => l.id)).toEqual([
      "g",
      "top",
      "base",
    ]);
    document = run(document, "layer.move", {
      layerId: "base",
      sceneId: "verse",
      parentId: "g",
      after: "top",
    }).document;
    expect(flattenStack(document.layers, "verse").map((l) => l.id)).toEqual([
      "g",
      "top",
      "base",
    ]);
    expect(document.layers.base?.parentId).toBe("g");
    expect(
      failure(document, "layer.move", {
        layerId: "g",
        sceneId: "verse",
        parentId: "g",
        after: null,
      }),
    ).toContain("itself");
    document = apply(document, [
      [
        "controller.create",
        {
          id: "fader",
          kind: "number",
          name: "Fader",
          addresses: ["layer/top/opacity"],
        },
      ],
      ["macro.create", { id: "hit", name: "Hit" }],
      [
        "macro.actions.add",
        {
          macroId: "hit",
          actions: [{ kind: "toggle", address: "layer/top/enabled" }],
        },
      ],
    ]);
    expect(
      failure(document, "layer.update", { layerId: "top", opacity: 0.5 }),
    ).toContain("controlled by Fader");
    const ungrouped = run(document, "layer.ungroup", { layerId: "g" }).document;
    expect(flattenStack(ungrouped.layers, "verse").map((l) => l.id)).toEqual([
      "top",
      "base",
    ]);
    expect(ungrouped.layers.top?.parentId).toBeNull();
    const removal = run(document, "layer.remove", { layerId: "g" });
    expect(removal.warnings).toEqual([
      "Removed 1 Macro action targeting “Folder”",
      "Removed 1 Link",
    ]);
    expect(Object.keys(removal.document.layers)).toEqual([]);
    expect(Object.keys(removal.document.links)).toEqual([]);
  });

  it("duplicates a Layer with its rows and Links", () => {
    let document = stage();
    document = apply(document, [
      [
        "layer.row.set",
        {
          layerId: "base",
          targets: ["par/root"],
          attribute: "dimmer",
          value: 0.4,
        },
      ],
      [
        "controller.create",
        {
          id: "fader",
          kind: "number",
          name: "Fader",
          addresses: ["layer/base/row/par/root/dimmer"],
        },
      ],
    ]);
    const copied = run(document, "layer.duplicate", {
      layerId: "base",
      id: "base2",
    }).document;
    expect(copied.layers.base2).toMatchObject({
      name: "Base 1",
      rows: { "par/root": { dimmer: { value: 0.4, alpha: 1 } } },
    });
    expect(
      Object.values(copied.links)
        .map((l) => l.address)
        .sort(),
    ).toEqual([
      "layer/base/row/par/root/dimmer",
      "layer/base2/row/par/root/dimmer",
    ]);
    expect(flattenStack(copied.layers, "verse").map((l) => l.id)).toEqual([
      "base",
      "base2",
    ]);
  });

  it("manages Targets: validates, keeps order, drops rows and Links with a Target", () => {
    let document = stage();
    expect(
      failure(document, "layer.targets.add", {
        layerId: "base",
        targets: ["nope/root"],
      }),
    ).toContain("does not exist");
    expect(
      failure(document, "layer.targets.add", {
        layerId: "base",
        targets: ["strobe/panel-9"],
      }),
    ).toContain("no Element");
    document = run(document, "layer.targets.add", {
      layerId: "base",
      targets: ["strobe/panel-3"],
      after: null,
    }).document;
    expect(document.layers.base).toMatchObject({
      targets: [
        { ref: "strobe/panel-3", spread: false },
        { ref: "par/root" },
        { ref: "strobe/root" },
      ],
    });
    document = run(document, "layer.targets.move", {
      layerId: "base",
      target: "strobe/panel-3",
      after: "strobe/root",
    }).document;
    expect(
      (document.layers.base as { targets: { ref: string }[] }).targets.map(
        (t) => t.ref,
      ),
    ).toEqual(["par/root", "strobe/root", "strobe/panel-3"]);
    document = apply(document, [
      [
        "layer.row.set",
        {
          layerId: "base",
          targets: ["strobe/panel-3"],
          attribute: "color",
          value: [1, 1, 1, 1],
        },
      ],
      [
        "controller.create",
        {
          id: "tint",
          kind: "color",
          name: "Tint",
          addresses: ["layer/base/row/strobe/panel-3/color"],
        },
      ],
    ]);
    const removal = run(document, "layer.targets.remove", {
      layerId: "base",
      targets: ["strobe/panel-3"],
    });
    expect(removal.warnings).toEqual(["Removed 1 Link"]);
    expect((removal.document.layers.base as { rows: object }).rows).toEqual({});
    expect(applyPatches(removal.document, removal.inverse)).toEqual(document);
  });

  it("sets and releases rows with validation, and refuses linked ones", () => {
    let document = stage();
    expect(
      failure(document, "layer.row.set", {
        layerId: "base",
        targets: ["par/root"],
        attribute: "pan",
        value: 1,
      }),
    ).toContain("has no Pan");
    expect(
      failure(document, "layer.row.set", {
        layerId: "base",
        targets: ["par/root"],
        attribute: "dimmer",
        value: 2,
      }),
    ).toContain("between 0 and 1");
    expect(
      failure(document, "layer.row.set", {
        layerId: "base",
        targets: ["strobe/panel-1"],
        attribute: "dimmer",
      }),
    ).toContain("not a Target");
    document = run(document, "layer.row.set", {
      layerId: "base",
      targets: ["par/root", "strobe/root"],
      attribute: "dimmer",
    }).document;
    expect(document.layers.base).toMatchObject({
      rows: {
        "par/root": { dimmer: { value: 0, alpha: 1 } },
        "strobe/root": { dimmer: { value: 0, alpha: 1 } },
      },
    });
    document = run(document, "layer.row.set", {
      layerId: "base",
      targets: ["par/root"],
      attribute: "dimmer",
      alpha: 0.5,
    }).document;
    expect(document.layers.base).toMatchObject({
      rows: { "par/root": { dimmer: { value: 0, alpha: 0.5 } } },
    });
    document = run(document, "address.edit", {
      address: "layer/base/row/par/root/dimmer",
      value: 0.7,
    }).document;
    expect(document.layers.base).toMatchObject({
      rows: { "par/root": { dimmer: { value: 0.7, alpha: 0.5 } } },
    });
    document = run(document, "controller.create", {
      id: "fader",
      kind: "number",
      name: "Fader",
      addresses: ["layer/base/row/par/root/dimmer"],
    }).document;
    expect(
      failure(document, "layer.row.set", {
        layerId: "base",
        targets: ["par/root"],
        attribute: "dimmer",
        value: 0.1,
      }),
    ).toContain("controlled by Fader");
    const released = run(document, "layer.row.release", {
      layerId: "base",
      targets: ["par/root"],
      attribute: "dimmer",
    });
    expect(released.warnings).toEqual(["Removed 1 Link"]);
    expect(
      (released.document.layers.base as { rows: Record<string, unknown> }).rows[
        "par/root"
      ],
    ).toEqual({});
    expect(Object.keys(released.document.links)).toEqual([]);
  });
});

describe("Fixture Sets", () => {
  it("creates from members, edits the ordered list, and leaves Layers when removed", () => {
    let document = stage();
    expect(
      failure(document, "set.create", { members: ["par/nope"] }),
    ).toContain("no Element");
    document = run(document, "set.create", {
      id: "wash",
      name: "Wash",
      members: ["par/root", "strobe/panel-1"],
    }).document;
    expect(document.fixtureSets.wash).toMatchObject({
      kind: "set",
      members: ["par/root", "strobe/panel-1"],
    });
    document = run(document, "set.members.add", {
      setId: "wash",
      refs: ["strobe/panel-2", "par/root"],
      after: null,
    }).document;
    expect(
      (document.fixtureSets.wash as { members: string[] }).members,
    ).toEqual(["strobe/panel-2", "par/root", "strobe/panel-1"]);
    document = run(document, "set.members.move", {
      setId: "wash",
      ref: "strobe/panel-2",
      after: "strobe/panel-1",
    }).document;
    expect(
      (document.fixtureSets.wash as { members: string[] }).members,
    ).toEqual(["par/root", "strobe/panel-1", "strobe/panel-2"]);
    document = run(document, "set.members.remove", {
      setId: "wash",
      refs: ["strobe/panel-1"],
    }).document;
    expect(
      (document.fixtureSets.wash as { members: string[] }).members,
    ).toEqual(["par/root", "strobe/panel-2"]);
    document = apply(document, [
      ["set.create", { id: "sg", kind: "group", name: "Folder" }],
      ["set.move", { setId: "wash", parentId: "sg", after: null }],
      ["layer.targets.add", { layerId: "base", targets: ["set:wash"] }],
      [
        "layer.row.set",
        {
          layerId: "base",
          targets: ["set:wash"],
          attribute: "color",
          value: [0, 1, 0, 1],
        },
      ],
    ]);
    expect(
      resolveAddress(document, "layer/base/row/set:wash/color"),
    ).toMatchObject({ type: "color", owner: "Base · Wash" });
    expect(resolveAddress(document, "layer/base/row/all/color")).toMatchObject({
      type: "color",
      owner: "Base · All Targets",
    });
    const removal = run(document, "set.remove", { setId: "sg" });
    expect(removal.warnings).toEqual(["Removed it from 1 Layer"]);
    expect(removal.document.fixtureSets).toEqual({});
    expect(
      (
        removal.document.layers.base as { targets: { ref: string }[] }
      ).targets.map((t) => t.ref),
    ).toEqual(["par/root", "strobe/root"]);
    expect((removal.document.layers.base as { rows: object }).rows).toEqual({});
  });
});

describe("Resolve", () => {
  it("composes the active Scene bottom to top with fan-down, the Target rule, opacity, Master, Blackout and Highlight", () => {
    let document = stage();
    document = apply(document, [
      [
        "layer.row.set",
        {
          layerId: "base",
          targets: ["par/root", "strobe/root"],
          attribute: "color",
          value: [0, 1, 0, 1],
        },
      ],
      [
        "layer.row.set",
        {
          layerId: "base",
          targets: ["par/root", "strobe/root"],
          attribute: "dimmer",
          value: 0.4,
        },
      ],
      [
        "layer.create",
        {
          id: "spot",
          sceneId: "verse",
          name: "Spot",
          targets: ["strobe/panel-3"],
        },
      ],
      [
        "layer.row.set",
        {
          layerId: "spot",
          targets: ["strobe/panel-3"],
          attribute: "color",
          value: [1, 1, 1, 1],
        },
      ],
    ]);
    expect(resolved(document, "par/root")).toEqual({
      dimmer: 0.4,
      color: [0, 1, 0, 1],
    });
    expect(resolved(document, "strobe/panel-1")).toEqual({
      dimmer: 0.4,
      color: [0, 1, 0, 1],
    });
    expect(resolved(document, "strobe/panel-3")).toEqual({
      dimmer: 0.4,
      color: [1, 1, 1, 1],
    });
    expect(resolved(document, "strobe/section-1")).toEqual({ dimmer: 0.4 });
    const universe = orderedEntries(document.universes)[0]?.id ?? "";
    expect(
      formatFrame(universeFrame(document, universe, resolveDocument(document))),
    ).toBe(
      "0 102 <2x 0> 102 <2x 0> 102 0 <3x 102> 0 102 <2x 0> 102 <2x 0> 102 <2x 0> 102 <2x 0> 102 0 <8x 102> <477x 0>",
    );

    // A Target of the Element itself beats the root's fan-down whatever the order.
    const reordered = run(document, "layer.targets.add", {
      layerId: "base",
      targets: ["strobe/panel-2"],
      after: null,
    }).document;
    const own = run(reordered, "layer.row.set", {
      layerId: "base",
      targets: ["strobe/panel-2"],
      attribute: "dimmer",
      value: 1,
    }).document;
    expect(resolved(own, "strobe/panel-2")?.dimmer).toBe(1);

    // A colour's own alpha tints: white at 10 % over Base's green is a faint wash.
    const faint = run(document, "layer.row.set", {
      layerId: "spot",
      targets: ["strobe/panel-3"],
      attribute: "color",
      value: [1, 1, 1, 0.1],
    }).document;
    expect(resolved(faint, "strobe/panel-3")?.color).toEqual([0.1, 1, 0.1, 1]);

    // Opacity is the fader; a disabled Group hides what it holds.
    const half = run(document, "address.edit", {
      address: "layer/spot/opacity",
      value: 0.5,
    }).document;
    expect(resolved(half, "strobe/panel-3")?.color).toEqual([0.5, 1, 0.5, 1]);
    const grouped = apply(document, [
      ["layer.create", { id: "g", kind: "group", sceneId: "verse", name: "G" }],
      [
        "layer.move",
        { layerId: "spot", sceneId: "verse", parentId: "g", after: null },
      ],
      ["layer.update", { layerId: "g", enabled: false }],
    ]);
    expect(resolved(grouped, "strobe/panel-3")?.color).toEqual([0, 1, 0, 1]);

    // Blend max is HTP: a lower value above does not darken.
    const htp = apply(document, [
      [
        "layer.row.set",
        {
          layerId: "spot",
          targets: ["strobe/panel-3"],
          attribute: "dimmer",
          value: 0.1,
        },
      ],
      ["layer.update", { layerId: "spot", blendMode: "max" }],
    ]);
    expect(resolved(htp, "strobe/panel-3")?.dimmer).toBe(0.4);

    // Master scales dimmer only; Blackout zeroes it and keeps colour; Highlight overrides both.
    const master = run(document, "address.edit", {
      address: "installation/master",
      value: 0.5,
    }).document;
    expect(resolved(master, "par/root")).toEqual({
      dimmer: 0.2,
      color: [0, 1, 0, 1],
    });
    const dark = run(document, "address.set", {
      address: "installation/blackout",
      value: true,
    }).document;
    expect(resolved(dark, "par/root")).toEqual({
      dimmer: 0,
      color: [0, 1, 0, 1],
    });
    const lit = run(dark, "address.set", {
      address: "element/par/root/highlight",
      value: true,
    }).document;
    expect(resolved(lit, "par/root")).toEqual({
      dimmer: 1,
      color: [1, 1, 1, 1],
    });

    // No active Scene: Defaults.
    const none = apply(document, [
      ["scene.create", { id: "empty", name: "Empty" }],
      ["address.trigger", { address: "scene/empty/play" }],
    ]);
    expect(resolved(none, "par/root")).toEqual({
      dimmer: 0,
      color: [0, 0, 0, 1],
    });
  });

  it("reads a Controller linked to a row, an opacity or Master at the output rate", () => {
    let document = stage();
    document = apply(document, [
      [
        "layer.row.set",
        {
          layerId: "base",
          targets: ["par/root"],
          attribute: "dimmer",
          value: 1,
        },
      ],
      [
        "controller.create",
        {
          id: "fader",
          kind: "number",
          name: "Fader",
          addresses: ["layer/base/row/par/root/dimmer"],
        },
      ],
    ]);
    expect(document.controllers.fader).toMatchObject({ value: 1 });
    document = run(document, "address.set", {
      address: "controller/fader/value",
      value: 0.25,
    }).document;
    expect(resolved(document, "par/root")?.dimmer).toBe(0.25);
    document = run(document, "controller.create", {
      id: "grand",
      kind: "number",
      name: "Grand",
      addresses: ["installation/master"],
    }).document;
    document = run(document, "address.set", {
      address: "controller/grand/value",
      value: 0.5,
    }).document;
    expect(resolved(document, "par/root")?.dimmer).toBe(0.125);
    expect(
      failure(document, "address.edit", {
        address: "installation/master",
        value: 1,
      }),
    ).toContain("controlled by Grand");
  });
});

describe("Addresses", () => {
  it("resolves Layer and row Addresses, All Targets rows included, and links Layers", () => {
    let document = stage();
    expect(resolveAddress(document, "layer/base/opacity")).toMatchObject({
      type: "number",
      owner: "Base",
      default: 1,
    });
    expect(resolveAddress(document, "layer/base/enabled")).toMatchObject({
      type: "boolean",
      path: ["layers", "base", "enabled"],
    });
    expect(
      resolveAddress(document, "layer/base/row/par/root/dimmer"),
    ).toMatchObject({
      type: "number",
      label: "Dimmer",
      owner: "Base · Par",
      path: ["layers", "base", "rows", "par/root", "dimmer", "value"],
      range: { min: 0, max: 1, percent: true },
    });
    expect(
      resolveAddress(document, "layer/base/row/par/root/pan"),
    ).toBeUndefined();
    expect(
      resolveAddress(document, "layer/base/row/par/root/dimmer/alpha"),
    ).toBeUndefined();
    expect(resolveAddress(document, "layer/base/row/all/dimmer")).toMatchObject(
      {
        type: "number",
        owner: "Base · All Targets",
        path: ["layers", "base", "all", "dimmer", "value"],
      },
    );
    expect(resolveAddress(document, "layer/base/row/all/pan")).toBeUndefined();
    const listed = listAddresses(document).map((entry) => entry.address);
    expect(listed).toContain("scene/verse/play");
    expect(listed).toContain("layer/base/row/strobe/root/color");
    expect(listed).toContain("layer/base/row/all/color");
    expect(listed).not.toContain("layer/base/row/all/pan");
    expect(listed.some((address) => address.endsWith("/alpha"))).toBe(false);
    expect(
      failure(document, "link.create", {
        controllerId: "x",
        addresses: ["layer/base/opacity"],
      }),
    ).toContain("does not exist");
    document = run(document, "controller.create", {
      id: "c",
      kind: "number",
      name: "C",
    }).document;
    expect(
      run(document, "link.create", {
        controllerId: "c",
        addresses: ["layer/base/enabled", "layer/base/row/all/dimmer"],
      }).document.links,
    ).toSatisfy(
      (links: Record<string, unknown>) => Object.keys(links).length === 2,
    );
    expect(
      failure(document, "link.create", {
        controllerId: "c",
        addresses: ["installation/blackout"],
      }),
    ).toContain("cannot be driven");
  });
});

describe("All Targets", () => {
  it("applies to every Target, is overridden by a Target's own row, and takes a Controller", () => {
    let document = stage();
    expect(
      failure(document, "layer.row.set", {
        layerId: "base",
        targets: ["all"],
        attribute: "pan",
        value: 0,
      }),
    ).toContain("All Targets has no Pan");
    document = run(document, "layer.row.set", {
      layerId: "base",
      targets: ["all"],
      attribute: "dimmer",
      value: 0.5,
    }).document;
    expect((document.layers.base as { all: object }).all).toEqual({
      dimmer: { value: 0.5, alpha: 1 },
    });
    expect((document.layers.base as { rows: object }).rows).toEqual({});
    expect(resolved(document, "par/root")?.dimmer).toBe(0.5);
    expect(resolved(document, "strobe/section-1")?.dimmer).toBe(0.5);
    expect(resolved(document, "strobe/panel-1")?.dimmer).toBe(0.5);

    // The Target's own row overrides; releasing it shows All Targets again.
    const own = run(document, "layer.row.set", {
      layerId: "base",
      targets: ["par/root"],
      attribute: "dimmer",
      value: 0.8,
    }).document;
    expect(resolved(own, "par/root")?.dimmer).toBe(0.8);
    expect(resolved(own, "strobe/panel-1")?.dimmer).toBe(0.5);
    const back = run(own, "layer.row.release", {
      layerId: "base",
      targets: ["par/root"],
      attribute: "dimmer",
    }).document;
    expect(resolved(back, "par/root")?.dimmer).toBe(0.5);

    // A Controller on the All Targets row drives every Target without a row of its own.
    const driven = apply(own, [
      ["controller.create", { id: "fader", kind: "number", name: "Fader" }],
      [
        "link.create",
        { controllerId: "fader", addresses: ["layer/base/row/all/dimmer"] },
      ],
      ["address.set", { address: "controller/fader/value", value: 0.25 }],
    ]);
    expect(resolved(driven, "strobe/panel-1")?.dimmer).toBe(0.25);
    expect(resolved(driven, "par/root")?.dimmer).toBe(0.8);
    expect(
      failure(driven, "layer.row.set", {
        layerId: "base",
        targets: ["all"],
        attribute: "dimmer",
        value: 0.1,
      }),
    ).toContain("controlled by Fader");

    // Releasing All Targets drops its Link; duplicating keeps the rows.
    const released = run(driven, "layer.row.release", {
      layerId: "base",
      targets: ["all"],
      attribute: "dimmer",
    });
    expect(released.document.links).toEqual({});
    expect((released.document.layers.base as { all: object }).all).toEqual({});
    const copy = run(driven, "layer.duplicate", { layerId: "base", id: "b2" });
    expect((copy.document.layers.b2 as { all: object }).all).toEqual({
      dimmer: { value: 0.5, alpha: 1 },
    });
  });
});

describe("Rig changes reach the composition", () => {
  it("drops members and Targets when a Fixture goes or a Mode change loses their keys", () => {
    let document = stage();
    document = apply(document, [
      [
        "set.create",
        { id: "wash", name: "Wash", members: ["par/root", "strobe/panel-1"] },
      ],
      [
        "layer.targets.add",
        { layerId: "base", targets: ["strobe/panel-1", "set:wash"] },
      ],
      [
        "layer.row.set",
        {
          layerId: "base",
          targets: ["strobe/panel-1"],
          attribute: "dimmer",
          value: 1,
        },
      ],
      [
        "controller.create",
        {
          id: "fader",
          kind: "number",
          name: "Fader",
          addresses: ["layer/base/row/strobe/panel-1/dimmer"],
        },
      ],
    ]);
    const changed = run(document, "fixture.update", {
      fixtureId: "strobe",
      modeKey: "3ch",
    });
    expect(changed.warnings).toEqual([
      "Removed 1 Fixture Set member",
      "Removed 1 Layer Target",
      "Removed 1 Link",
    ]);
    expect(
      (changed.document.fixtureSets.wash as { members: string[] }).members,
    ).toEqual(["par/root"]);
    expect(
      (
        changed.document.layers.base as { targets: { ref: string }[] }
      ).targets.map((t) => t.ref),
    ).toEqual(["par/root", "strobe/root", "set:wash"]);
    expect(Object.keys(changed.document.links)).toEqual([]);
    const removed = run(document, "fixture.remove", { fixtureId: "strobe" });
    expect(removed.warnings).toEqual([
      "Removed 1 Fixture Set member",
      "Removed 2 Layer Targets",
      "Removed 1 Link",
    ]);
    expect(
      (
        removed.document.layers.base as { targets: { ref: string }[] }
      ).targets.map((t) => t.ref),
    ).toEqual(["par/root", "set:wash"]);
    expect(applyPatches(removed.document, removed.inverse)).toEqual(document);
  });
});
