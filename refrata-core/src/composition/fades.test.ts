import { describe, expect, it } from "vitest";

import rgbJson from "../../../refrata-library/generic/rgb-3ch.json" with { type: "json" };
import { resolveAddress } from "../address/address.ts";
import { executeCommand } from "../command/execute.ts";
import { createBuiltInRegistry } from "../commands/index.ts";
import { emptyDocument, type Document } from "../document/document.ts";
import { fadeCurve, LayerFades } from "./fades.ts";
import { resolveDocument } from "./resolve.ts";

const registry = createBuiltInRegistry();

function apply(document: Document, steps: readonly [string, unknown][]) {
  let current = document;
  for (const [name, payload] of steps) {
    const result = executeCommand(registry, current, name, payload);
    if (!result.ok) throw new Error(result.error);
    current = result.document;
  }
  return current;
}

/** A Par at dimmer 0.2 from Base, and Spot above it at dimmer 1, fading in over 2 s and out over 1 s. */
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
    ["scene.create", { id: "verse", name: "Verse" }],
    [
      "layer.create",
      { id: "base", sceneId: "verse", name: "Base", targets: ["par/root"] },
    ],
    [
      "layer.row.set",
      {
        layerId: "base",
        targets: ["par/root"],
        attribute: "dimmer",
        value: 0.2,
      },
    ],
    ["layer.create", { id: "g", kind: "group", sceneId: "verse", name: "G" }],
    [
      "layer.create",
      {
        id: "spot",
        sceneId: "verse",
        parentId: "g",
        name: "Spot",
        targets: ["par/root"],
      },
    ],
    [
      "layer.row.set",
      { layerId: "spot", targets: ["par/root"], attribute: "dimmer", value: 1 },
    ],
    ["address.edit", { address: "layer/spot/fade/in/time", value: 2 }],
    ["address.edit", { address: "layer/spot/fade/out/time", value: 1 }],
  ]);
}

const dimmer = (document: Document, fades: LayerFades, dt: number) =>
  resolveDocument(document, undefined, fades.step(document, dt)).get("par/root")
    ?.dimmer;

describe("fade curves", () => {
  it("start at 0, end at 1 and stay inside", () => {
    for (const curve of [
      "linear",
      "ease-in",
      "ease-out",
      "ease-in-out",
      "bounce",
    ] as const) {
      expect(fadeCurve(curve, 0)).toBe(0);
      expect(fadeCurve(curve, 1)).toBeCloseTo(1);
      for (let t = 0; t <= 1; t += 0.05) {
        expect(fadeCurve(curve, t)).toBeGreaterThanOrEqual(0);
        expect(fadeCurve(curve, t)).toBeLessThanOrEqual(1);
      }
    }
    expect(fadeCurve("ease-in", 0.5)).toBe(0.25);
    expect(fadeCurve("ease-out", 0.5)).toBe(0.75);
    expect(fadeCurve("ease-in-out", 0.5)).toBe(0.5);
    // Bounce reaches 1 at two thirds, snaps to half and climbs back.
    expect(fadeCurve("bounce", 2 / 3 - 1e-6)).toBeCloseTo(1);
    expect(fadeCurve("bounce", 2 / 3)).toBe(0.5);
    expect(fadeCurve("bounce", 5 / 6)).toBeCloseTo(0.625);
  });
});

describe("LayerFades", () => {
  it("lands on the final value when first seen, then eases enable and disable over their times", () => {
    const fades = new LayerFades();
    let document = stage();
    expect(dimmer(document, fades, 0)).toBe(1);
    expect(fades.step(document, 0).get("g")).toBe(1);

    document = apply(document, [
      ["layer.update", { layerId: "spot", enabled: false }],
    ]);
    // Out over 1 s, linear: halfway after 0.5 s is a crossfade to Base's 0.2.
    expect(dimmer(document, fades, 0.5)).toBeCloseTo(0.6);
    expect(dimmer(document, fades, 0.5)).toBeCloseTo(0.2);
    expect(dimmer(document, fades, 1)).toBeCloseTo(0.2);

    document = apply(document, [
      ["layer.update", { layerId: "spot", enabled: true }],
    ]);
    expect(dimmer(document, fades, 1)).toBeCloseTo(0.6);
    expect(dimmer(document, fades, 1)).toBeCloseTo(1);
  });

  it("reverses from where it is over the other time scaled by the distance left, on the other curve", () => {
    const fades = new LayerFades();
    let document = apply(stage(), [
      ["layer.update", { layerId: "spot", enabled: false }],
      [
        "address.edit",
        { address: "layer/spot/fade/out/curve", value: "ease-in" },
      ],
    ]);
    fades.step(document, 0);
    document = apply(document, [
      ["layer.update", { layerId: "spot", enabled: true }],
    ]);
    // In over 2 s: at 0.5 s the envelope is 0.25.
    expect(fades.step(document, 0.5).get("spot")).toBeCloseTo(0.25);
    document = apply(document, [
      ["layer.update", { layerId: "spot", enabled: false }],
    ]);
    // Out from 0.25 takes 1 s × 0.25; ease-in halfway through is a quarter of the way down.
    expect(fades.step(document, 0.125).get("spot")).toBeCloseTo(
      0.25 - 0.25 * 0.25,
    );
    expect(fades.step(document, 0.125).get("spot")).toBe(0);
  });

  it("samples the time at the flip, reads a Controller on it, and treats a Group like any Layer", () => {
    const fades = new LayerFades();
    let document = apply(stage(), [
      ["controller.create", { id: "speed", kind: "number", name: "Speed" }],
      ["address.edit", { address: "controller/speed/value", value: 0.1 }],
      [
        "link.create",
        { controllerId: "speed", addresses: ["layer/g/fade/out/time"] },
      ],
    ]);
    fades.step(document, 0);
    // A 0 to 1 fader spans 0 to 30 s, so 0.1 is 3 s.
    expect(resolveAddress(document, "layer/g/fade/out/time")?.range?.max).toBe(
      30,
    );
    document = apply(document, [
      ["layer.update", { layerId: "g", enabled: false }],
    ]);
    fades.step(document, 0);
    // The fader moving mid-fade changes the next fade, not this one.
    document = apply(document, [
      ["address.edit", { address: "controller/speed/value", value: 1 }],
    ]);
    expect(fades.step(document, 1.5).get("g")).toBeCloseTo(0.5);
    // The Group's envelope weighs Spot; Spot's own envelope stays 1.
    expect(
      resolveDocument(document, undefined, fades.step(document, 0)).get(
        "par/root",
      )?.dimmer,
    ).toBeCloseTo(0.6);
    expect(fades.step(document, 1.5).get("g")).toBe(0);
    expect(fades.step(document, 0).get("spot")).toBe(1);
  });

  it("cuts on a Scene change, a restart, or a time of 0", () => {
    const fades = new LayerFades();
    let document = stage();
    fades.step(document, 0);
    document = apply(document, [
      ["layer.update", { layerId: "spot", enabled: false }],
    ]);
    expect(fades.step(document, 0.5).get("spot")).toBeCloseTo(0.5);
    fades.restart();
    expect(fades.step(document, 0).get("spot")).toBe(0);
    document = apply(document, [
      ["scene.create", { id: "chorus", name: "Chorus" }],
      ["address.trigger", { address: "scene/chorus/play" }],
    ]);
    expect(fades.step(document, 0).get("spot")).toBeUndefined();
    document = apply(document, [
      ["layer.update", { layerId: "spot", enabled: true }],
      ["address.trigger", { address: "scene/verse/play" }],
    ]);
    expect(fades.step(document, 0).get("spot")).toBe(1);
    document = apply(document, [
      ["address.edit", { address: "layer/spot/fade/out/time", value: 0 }],
      ["layer.update", { layerId: "spot", enabled: false }],
    ]);
    expect(fades.step(document, 0).get("spot")).toBe(0);
  });
});
