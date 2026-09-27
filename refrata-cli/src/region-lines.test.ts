import {
  createBuiltInRegistry,
  emptyDocument,
  executeCommand,
  type Document,
  type VisualLayer,
} from "@refrata/core";
import { describe, expect, it } from "vitest";

import beamJson from "../../refrata-library/generic/beam-moving-head.json" with { type: "json" };
import { describeRegion, formatRegion, regionReport } from "./region-lines.ts";
import { visualLayerLines } from "./visual-lines.ts";

const registry = createBuiltInRegistry();

function run(document: Document, name: string, payload: unknown): Document {
  const result = executeCommand(registry, document, name, payload);
  if (!result.ok) throw new Error(result.error);
  return result.document;
}

const fly = (document: Document): VisualLayer =>
  document.layers.fly as VisualLayer;

/** Two beams, a Flyout over both, its From linked to Preset Low, which has an entry for Left alone. */
function stage(): Document {
  let document = emptyDocument("Club");
  for (const [id, name] of [
    ["left", "Left"],
    ["right", "Right"],
  ])
    document = run(document, "fixture.create", {
      id,
      typeKey: "generic/beam-moving-head",
      modeKey: "12ch",
      fixtureType: beamJson,
      name,
    });
  document = run(document, "scene.create", { id: "verse", name: "Verse" });
  document = run(document, "layer.create", {
    id: "fly",
    kind: "visual",
    visual: "flyout",
    sceneId: "verse",
    name: "Fly",
    targets: ["left/root", "right/root"],
  });
  document = run(document, "preset.create", {
    id: "low",
    name: "Low",
    elements: ["left/root"],
  });
  document = run(document, "aim.edit", {
    pan: "preset/low/row/left/root/pan",
    tilt: "preset/low/row/left/root/tilt",
    value: { pan: -20, tilt: -45 },
  });
  return run(document, "link.preset", {
    presetId: "low",
    addresses: ["layer/fly/region/from/pan", "layer/fly/region/from/tilt"],
  });
}

describe("region lines", () => {
  it("prints each Aim with its degrees or its Preset and what each Element takes", () => {
    const document = stage();
    const report = regionReport(document, fly(document));
    if (report === undefined) throw new Error("Fly has no Region.");
    expect(formatRegion(document, fly(document), report)).toEqual([
      "Region of “Fly” (Flyout), by corners",
      "  from",
      "    pan   linked to Preset “Low”",
      "      Left   -20.0°",
      "      Right  no entry, released",
      "    tilt  linked to Preset “Low”",
      "      Left   -45.0°",
      "      Right  no entry, released",
      "  to",
      "    pan   30.0°  (within -270.0° to 270.0°)",
      "    tilt  60.0°  (within -90.0° to 90.0°)",
    ]);
    expect(report.aims[0]?.axes[0]?.place).toBe("layer/fly/region/from/pan");
  });

  it("says a Region in one line under its Layer, and flags an edge a mover cannot go to", () => {
    let document = stage();
    expect(describeRegion(document, fly(document))).toBe(
      "corners, from Preset “Low” to 30.0°/60.0°",
    );
    expect(visualLayerLines(document, fly(document))).toContain(
      "bindings: level on dimmer (0% to 100%)",
    );
    document = run(document, "layer.region.set", {
      layerId: "fly",
      form: "center",
      center: { pan: 0, tilt: 80 },
      width: 40,
      height: 40,
    });
    expect(describeRegion(document, fly(document))).toBe(
      "center 0.0°/80.0°, 40.0° wide, 40.0° high",
    );
    const report = regionReport(document, fly(document));
    expect(
      report === undefined
        ? []
        : formatRegion(document, fly(document), report).slice(-3),
    ).toEqual([
      "  size  40.0° wide, 40.0° high",
      "  warning: Left cannot go to tilt 100.0°; it reaches -90.0° to 90.0°",
      "  warning: Right cannot go to tilt 100.0°; it reaches -90.0° to 90.0°",
    ]);
    document = run(document, "layer.region.remove", { layerId: "fly" });
    expect(visualLayerLines(document, fly(document))).toContain(
      "region: none, so its Slots go through their bindings; set one with layers region",
    );
  });
});
