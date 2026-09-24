import { describe, expect, it } from "vitest";

import strobeJson from "../../../refrata-library/generic/atomic-like-panel.json" with { type: "json" };
import { listAddresses, resolveAddress } from "../address/address.ts";
import { executeCommand } from "../command/execute.ts";
import { resolveDocument } from "../composition/resolve.ts";
import { emptyDocument, type Document } from "../document/document.ts";
import { spreadWarning, visualTargets } from "../document/visual-layers.ts";
import type { Color } from "../parameters.ts";
import { VisualPlayer } from "../visuals/player.ts";
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

const strobe = (id: string): [string, unknown] => [
  "fixture.create",
  {
    id,
    typeKey: "generic/atomic-like-panel",
    modeKey: "32ch",
    fixtureType: strobeJson,
    name: id,
  },
];

const visualLayer = (document: Document, id: string) => {
  const layer = document.layers[id];
  if (layer?.kind !== "visual") throw new Error(`${id} is not a Visual Layer.`);
  return layer;
};

/** Two Strobes, a rule Set of every Panel, and Scene `verse` playing a green Look at dimmer 0.4 over it. */
function rig(): Document {
  return apply(emptyDocument("Club"), [
    strobe("s1"),
    strobe("s2"),
    ["set.create", { id: "panels", name: "Panels", rules: [["panel"]] }],
    ["scene.create", { id: "verse", name: "Verse" }],
    [
      "layer.create",
      { id: "base", sceneId: "verse", name: "Base", targets: ["set:panels"] },
    ],
    [
      "layer.row.set",
      {
        layerId: "base",
        targets: ["all"],
        attribute: "color",
        value: [0, 1, 0, 1],
      },
    ],
    [
      "layer.row.set",
      { layerId: "base", targets: ["all"], attribute: "dimmer", value: 0.4 },
    ],
    ["address.trigger", { address: "scene/verse/play" }],
  ]);
}

const withVisual = (
  visual: string,
  extra: readonly [string, unknown][] = [],
): Document =>
  apply(rig(), [
    [
      "layer.create",
      {
        id: "fx",
        kind: "visual",
        visual,
        sceneId: "verse",
        targets: ["set:panels"],
      },
    ],
    ...extra,
  ]);

describe("a Visual Layer", () => {
  it("starts from its Visual's defaults and resets when the Visual changes", () => {
    const document = withVisual("shimmer");
    const layer = visualLayer(document, "fx");
    expect(layer.name).toBe("Shimmer");
    expect(layer.bindings).toEqual({
      color: { attribute: "color" },
      level: { attribute: null },
    });
    expect(layer.parameters.count).toBe(1);
    expect(layer.targets).toEqual([{ ref: "set:panels", spread: false }]);

    const chase = visualLayer(
      run(document, "layer.visual.set", { layerId: "fx", visual: "chase" })
        .document,
      "fx",
    );
    expect(chase.bindings.level).toEqual({
      attribute: "dimmer",
      from: 0,
      to: 1,
    });
    expect("count" in chase.parameters).toBe(false);
    expect(
      failure(rig(), "layer.create", {
        kind: "visual",
        visual: "nope",
        sceneId: "verse",
      }),
    ).toContain("not a Visual of the Catalog");
  });

  it("starts on the Blend Mode its Visual asks for, and follows a new Visual unless someone chose another", () => {
    const shutter = withVisual("shutter");
    expect(visualLayer(shutter, "fx").blendMode).toBe("multiply");
    const lfo = run(shutter, "layer.visual.set", {
      layerId: "fx",
      visual: "lfo",
    }).document;
    expect(visualLayer(lfo, "fx").blendMode).toBe("normal");
    const pump = run(lfo, "layer.visual.set", {
      layerId: "fx",
      visual: "pump",
    }).document;
    expect(visualLayer(pump, "fx").blendMode).toBe("multiply");

    const chosen = apply(withVisual("lfo"), [
      ["layer.update", { layerId: "fx", blendMode: "add" }],
      ["layer.visual.set", { layerId: "fx", visual: "shutter" }],
    ]);
    expect(visualLayer(chosen, "fx").blendMode).toBe("add");
  });

  it("binds a Slot to an Attribute of its kind, or to none", () => {
    const document = withVisual("lfo");
    const bound = visualLayer(
      run(document, "layer.binding.set", {
        layerId: "fx",
        slot: "value",
        attribute: "dimmer",
        from: 0.2,
        to: 0.6,
      }).document,
      "fx",
    );
    expect(bound.bindings.value).toEqual({
      attribute: "dimmer",
      from: 0.2,
      to: 0.6,
    });
    expect(
      failure(document, "layer.binding.set", {
        layerId: "fx",
        slot: "value",
        attribute: "color",
      }),
    ).toContain("number Slot");
    expect(
      failure(document, "layer.binding.set", {
        layerId: "fx",
        slot: "value",
        attribute: "dimmer",
        to: 2,
      }),
    ).toContain("range");
  });

  it("has an Address per Visual Parameter and a trigger per Cue", () => {
    const document = withVisual("chase");
    const rate = resolveAddress(document, "layer/fx/param/rate");
    expect(rate?.type).toBe("number");
    expect(rate?.range).toMatchObject({ min: 0, max: 20, unit: "Hz" });
    expect(resolveAddress(document, "layer/fx/cue/step")?.type).toBe("trigger");
    expect(resolveAddress(document, "layer/fx/cue/fire")).toBeUndefined();
    const addresses = listAddresses(document).map((entry) => entry.address);
    expect(addresses).toContain("layer/fx/param/tail");
    expect(addresses).toContain("layer/fx/cue/restart");
    expect(addresses).toContain("layer/fx/opacity");

    const edited = run(document, "address.edit", {
      address: "layer/fx/param/tail",
      value: 2,
    }).document;
    expect(visualLayer(edited, "fx").parameters.tail).toBe(2);
    const fired = run(document, "address.trigger", {
      address: "layer/fx/cue/step",
    });
    expect(fired.events).toEqual(["layer/fx/cue/step"]);
  });

  it("warns when a Visual that distributes has one Target", () => {
    const document = withVisual("chase");
    const layer = visualLayer(document, "fx");
    expect(spreadWarning(document, layer)).toContain("Spread it");
    const spread = run(document, "layer.targets.spread", {
      layerId: "fx",
      ref: "set:panels",
      spread: true,
    }).document;
    expect(spreadWarning(spread, visualLayer(spread, "fx"))).toBeUndefined();
    expect(
      visualTargets(spread, visualLayer(spread, "fx")).targets,
    ).toHaveLength(16);
    expect(spreadWarning(withVisual("lfo"), layer)).toContain("Spread it");
    const lfo = withVisual("lfo");
    expect(spreadWarning(lfo, visualLayer(lfo, "fx"))).toBeUndefined();
  });
});

/** Steps the player once and reads the resolved dimmer of an Element. */
const dimmer = (document: Document, player: VisualPlayer, dt: number) => {
  const resolved = resolveDocument(document, player.step(document, dt));
  return (ref: string) => resolved.get(ref)?.dimmer as number;
};

describe("Resolve with Visuals", () => {
  it("gates the look below with a Shutter and leaves its color alone", () => {
    const document = withVisual("shutter", [
      ["address.edit", { address: "layer/fx/param/rate", value: 4 }],
    ]);
    const player = new VisualPlayer();
    expect(dimmer(document, player, 0)("s1/panel-1")).toBeCloseTo(0.4);
    dimmer(document, player, 0.025);
    const resolved = resolveDocument(document, player.step(document, 0.025));
    expect(resolved.get("s1/panel-1")?.dimmer).toBe(0);
    expect(resolved.get("s1/panel-1")?.color).toEqual([0, 1, 0, 1]);
  });

  it("maps an LFO through its binding's range over the look below", () => {
    const document = withVisual("lfo", [
      [
        "layer.binding.set",
        {
          layerId: "fx",
          slot: "value",
          attribute: "dimmer",
          from: 0.2,
          to: 0.6,
        },
      ],
      ["address.edit", { address: "layer/fx/param/rate", value: 10 }],
    ]);
    const player = new VisualPlayer();
    expect(dimmer(document, player, 0)("s1/panel-1")).toBeCloseTo(0.2);
    expect(dimmer(document, player, 0.05)("s1/panel-1")).toBeCloseTo(0.6);
    expect(resolveDocument(document).get("s1/panel-1")?.dimmer).toBeCloseTo(
      0.4,
    );
  });

  it("steps a Chase through a spread Set and releases the rest", () => {
    const document = withVisual("chase", [
      [
        "layer.targets.spread",
        { layerId: "fx", ref: "set:panels", spread: true },
      ],
      ["address.edit", { address: "layer/fx/param/rate", value: 0 }],
    ]);
    const player = new VisualPlayer();
    let read = dimmer(document, player, 0.025);
    expect(read("s1/panel-1")).toBe(1);
    expect(read("s1/panel-2")).toBeCloseTo(0.4);
    player.cue("fx", "step");
    read = dimmer(document, player, 0.025);
    expect(read("s1/panel-1")).toBeCloseTo(0.4);
    expect(read("s1/panel-2")).toBe(1);
  });

  it("keeps stepping a disabled Layer and remakes instances on restart", () => {
    const document = withVisual("chase", [
      [
        "layer.targets.spread",
        { layerId: "fx", ref: "set:panels", spread: true },
      ],
      ["address.edit", { address: "layer/fx/param/rate", value: 0 }],
    ]);
    const disabled = run(document, "layer.update", {
      layerId: "fx",
      enabled: false,
    }).document;
    const player = new VisualPlayer();
    player.step(disabled, 0.025);
    player.cue("fx", "step");
    expect(dimmer(disabled, player, 0.025)("s1/panel-2")).toBeCloseTo(0.4);
    expect(dimmer(document, player, 0.025)("s1/panel-2")).toBe(1);
    player.restart();
    expect(dimmer(document, player, 0.025)("s1/panel-1")).toBe(1);
  });

  it("sparkles full white only when Level is bound as well", () => {
    const shimmer: readonly [string, unknown][] = [
      [
        "layer.targets.spread",
        { layerId: "fx", ref: "set:panels", spread: true },
      ],
      ["address.edit", { address: "layer/fx/param/rate", value: 0 }],
      ["address.edit", { address: "layer/fx/param/fadeIn", value: 0 }],
      ["address.edit", { address: "layer/fx/param/count", value: 16 }],
    ];
    const colorOnly = withVisual("shimmer", shimmer);
    const player = new VisualPlayer();
    player.step(colorOnly, 0.025);
    player.cue("fx", "fire");
    let resolved = resolveDocument(colorOnly, player.step(colorOnly, 0.025));
    expect(resolved.get("s2/panel-3")?.color as Color).toEqual([1, 1, 1, 1]);
    expect(resolved.get("s2/panel-3")?.dimmer).toBeCloseTo(0.4);

    const both = run(colorOnly, "layer.binding.set", {
      layerId: "fx",
      slot: "level",
      attribute: "dimmer",
    }).document;
    resolved = resolveDocument(both, player.step(both, 0.025));
    expect(resolved.get("s2/panel-3")?.dimmer).toBe(1);
  });

  it("drives a Visual Parameter from a Controller", () => {
    const document = withVisual("static-number", [
      ["controller.create", { id: "depth", kind: "number", name: "Depth" }],
      [
        "link.create",
        { controllerId: "depth", addresses: ["layer/fx/param/value"] },
      ],
      ["address.set", { address: "controller/depth/value", value: 0.25 }],
    ]);
    const player = new VisualPlayer();
    expect(dimmer(document, player, 0.025)("s1/panel-1")).toBeCloseTo(0.25);
  });
});

describe("a Layer of a Geometry Visual", () => {
  it("gets a Frame fitted to its Targets, keeps it across Visuals with geometry and drops it otherwise", () => {
    const document = withVisual("wipe");
    const frame = visualLayer(document, "fx").frame;
    expect(frame).toBeDefined();
    expect(frame?.rotation).toBe(0);
    expect(visualLayer(withVisual("chase"), "fx").frame).toBeUndefined();
    const moved = run(document, "layer.frame.set", {
      layerId: "fx",
      frame: { x: 5, rotation: 30 },
    }).document;
    expect(visualLayer(moved, "fx").frame).toEqual({
      ...frame,
      x: 5,
      rotation: 30,
    });
    const radar = run(moved, "layer.visual.set", {
      layerId: "fx",
      visual: "radar",
    }).document;
    expect(visualLayer(radar, "fx").frame).toEqual({
      ...frame,
      x: 5,
      rotation: 30,
    });
    const refitted = run(radar, "layer.frame.set", {
      layerId: "fx",
      fit: true,
    }).document;
    expect(visualLayer(refitted, "fx").frame).toEqual(frame);
    const chase = run(refitted, "layer.visual.set", {
      layerId: "fx",
      visual: "chase",
    }).document;
    expect(visualLayer(chase, "fx").frame).toBeUndefined();
    expect(
      failure(chase, "layer.frame.set", { layerId: "fx", frame: { x: 1 } }),
    ).toContain("not a Geometry Visual");
    expect(
      failure(document, "layer.frame.set", {
        layerId: "fx",
        frame: { width: 0 },
      }),
    ).toContain("width");
  });

  it("wipes across the spread Set by where the Strobes stand and reports its pose", () => {
    const document = withVisual("wipe", [
      [
        "layer.targets.spread",
        { layerId: "fx", ref: "set:panels", spread: true },
      ],
      ["address.edit", { address: "layer/fx/param/rate", value: 0 }],
      ["address.edit", { address: "layer/fx/param/width", value: 0.3 }],
      ["address.edit", { address: "layer/fx/param/softness", value: 0 }],
      [
        "layer.frame.set",
        { layerId: "fx", frame: { x: 2, width: 4, height: 2, rotation: 0 } },
      ],
    ]);
    const player = new VisualPlayer();
    // At phase 0 the band is entering at the Frame's left edge, which is at
    // x 0: s1's panels just left of the origin are under it, s2's to the
    // right are not.
    const read = dimmer(document, player, 0);
    expect(read("s1/panel-1")).toBe(1);
    expect(read("s2/panel-4")).toBeCloseTo(0.4);
    expect(player.poses().get("fx")).toEqual({ centre: -0.15 });
    player.restart();
    expect(player.poses().size).toBe(0);
  });
});
