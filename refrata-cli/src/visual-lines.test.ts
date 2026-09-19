import {
  CATALOG,
  createBuiltInRegistry,
  executeCommand,
  visualDefinition,
  type Document,
} from "@refrata/core";
import { describe, expect, it } from "vitest";

import { formatStack } from "./composition-lines.ts";
import { stageLook } from "./composition-lines.test.ts";
import {
  describeBinding,
  formatCatalog,
  formatVisual,
} from "./visual-lines.ts";

const registry = createBuiltInRegistry();

function apply(
  document: Document,
  steps: readonly [string, unknown][],
): Document {
  let current = document;
  for (const [name, payload] of steps) {
    const result = executeCommand(registry, current, name, payload);
    if (!result.ok) throw new Error(result.error);
    current = result.document;
  }
  return current;
}

describe("the Catalog", () => {
  it("lists every Visual with its Slots, Parameters and Cues", () => {
    const text = formatCatalog(CATALOG).join("\n");
    for (const definition of CATALOG) expect(text).toContain(definition.id);
    expect(text).toContain(
      "Slots: color (color) on color, level (number) not bound",
    );
    expect(text).toContain("rate (number) 0 Hz to 20 Hz, default 2 Hz");
    expect(text).toContain("Cues: step (Advance one step now.), restart");
  });

  it("prints one Visual as its block of the Catalog", () => {
    const chase = visualDefinition("chase");
    if (chase === undefined) throw new Error("No Chase.");
    expect(formatCatalog(CATALOG).join("\n")).toContain(
      formatVisual(chase).join("\n"),
    );
  });
});

describe("a Visual Layer in the stack", () => {
  const document = apply(stageLook(), [
    [
      "layer.create",
      {
        id: "run",
        kind: "visual",
        visual: "chase",
        sceneId: "verse",
        name: "Run",
        targets: ["set:wash"],
      },
    ],
    [
      "layer.binding.set",
      {
        layerId: "run",
        slot: "level",
        attribute: "dimmer",
        from: 0.2,
        to: 0.6,
      },
    ],
    ["controller.create", { id: "tempo", kind: "number", name: "Tempo" }],
    [
      "link.create",
      { controllerId: "tempo", addresses: ["layer/run/param/rate"] },
    ],
  ]);

  it("prints the Visual, Parameters, bindings, Cues and the one-Target warning", () => {
    const text = formatStack(document, "verse").join("\n");
    expect(text).toContain("Visual (Chase) “Run”  run  opacity 100%  normal");
    expect(text).toContain("rate 2 Hz (controlled by Tempo)");
    expect(text).toContain(
      "bindings: color not bound, level on dimmer (20% to 60%)",
    );
    expect(text).toContain("cues: step (layer/run/cue/step)");
    expect(text).toContain("warning: Chase has one Target");
  });

  it("drops the warning once the Set is spread, and prints the expansion", () => {
    const spread = apply(document, [
      [
        "layer.targets.spread",
        { layerId: "run", ref: "set:wash", spread: true },
      ],
    ]);
    const text = formatStack(spread, "verse").join("\n");
    expect(text).not.toContain("warning:");
    expect(text).toContain("Wash spreads to: Par, Strobe › Panel 1");
  });

  it("says when the Catalog lacks the Layer's Visual", () => {
    const layer = document.layers.run;
    if (layer?.kind !== "visual") throw new Error("No Visual Layer.");
    const lost = {
      ...document,
      layers: { ...document.layers, run: { ...layer, visual: "gone" } },
    } as Document;
    expect(formatStack(lost, "verse").join("\n")).toContain(
      "unknown Visual “gone”, contributes nothing",
    );
  });
});

describe("describeBinding", () => {
  it("names the range in the Attribute's units, or that nothing is bound", () => {
    const lfo = visualDefinition("lfo")?.slots[0];
    if (lfo === undefined) throw new Error("No LFO Slot.");
    expect(describeBinding(lfo, { attribute: "strobe", from: 1, to: 12 })).toBe(
      "value on strobe (1 Hz to 12 Hz)",
    );
    expect(describeBinding(lfo, { attribute: null })).toBe("value not bound");
  });
});
