import { describe, expect, it } from "vitest";

import rgbJson from "../../../refrata-library/generic/rgb-3ch.json" with { type: "json" };
import { executeCommand } from "../command/execute.ts";
import { createBuiltInRegistry } from "../commands/index.ts";
import { emptyDocument, type Document } from "../document/document.ts";
import { fireAddress } from "./fire.ts";
import { unknownAddress } from "./unknown.ts";
import { toggleAddress, writeAddress } from "./write.ts";

const registry = createBuiltInRegistry();

function run(document: Document, name: string, payload: unknown): Document {
  const result = executeCommand(registry, document, name, payload);
  if (!result.ok) throw new Error(result.error);
  return result.document;
}

function stage(): Document {
  let document = emptyDocument("Club");
  document = run(document, "fixture.create", {
    id: "par",
    typeKey: "generic/rgb-3ch",
    modeKey: "3ch",
    fixtureType: rgbJson,
    name: "Par",
  });
  document = run(document, "scene.create", { id: "s", name: "Verse" });
  document = run(document, "layer.create", {
    id: "look",
    sceneId: "s",
    name: "Base",
    targets: ["par/root"],
  });
  document = run(document, "layer.create", {
    id: "bare",
    sceneId: "s",
    name: "Bare",
    targets: null,
  });
  document = run(document, "layer.create", {
    id: "wave",
    sceneId: "s",
    name: "Breathe",
    kind: "visual",
    visual: "lfo",
  });
  document = run(document, "layer.create", {
    id: "fan",
    sceneId: "s",
    name: "Fan",
    kind: "visual",
    visual: "fan",
  });
  document = run(document, "layer.create", {
    id: "g",
    sceneId: "s",
    name: "Pack",
    kind: "group",
  });
  return document;
}

function error(outcome: { ok: boolean; error?: string }): string | undefined {
  return outcome.ok ? undefined : outcome.error;
}

describe("unknown addresses", () => {
  const document = stage();

  it("lists the Parameters a Layer's Visual declares, and where to read them", () => {
    const message = error(writeAddress(document, "layer/wave/param/speed", 1));
    expect(message).toBe(
      "Unknown address “layer/wave/param/speed”: LFO declares the Parameters waveform, rate, low, high, phaseSpread. See `refrata visuals lfo`.",
    );
    expect(error(toggleAddress(document, "layer/wave/param/speed"))).toBe(
      message,
    );
  });

  it("lists the Cues when a trigger names one the Visual does not declare", () => {
    expect(
      error(fireAddress(document, "layer/wave/cue/burst", Math.random)),
    ).toBe(
      "Unknown address “layer/wave/cue/burst”: LFO declares the Cues sync. See `refrata visuals lfo`.",
    );
    expect(
      error(fireAddress(document, "layer/fan/cue/burst", Math.random)),
    ).toMatch(/: Fan declares no Cues\. See `refrata visuals fan`\.$/);
  });

  it("names a Look Layer's Targets and a Target's Attributes for a row it lacks", () => {
    expect(
      error(writeAddress(document, "layer/look/row/par/root/zoom", 1)),
    ).toBe(
      "Unknown address “layer/look/row/par/root/zoom”: “Par” on Layer “Base” has no Attribute “zoom”; it has dimmer, color.",
    );
    expect(
      error(writeAddress(document, "layer/look/row/set:x/dimmer", 1)),
    ).toBe(
      "Unknown address “layer/look/row/set:x/dimmer”: Layer “Base” has no such Target; it targets “Par”, and “all” is the All Targets row.",
    );
    expect(unknownAddress(document, "layer/bare/row/all/dimmer")).toBe(
      "Unknown address “layer/bare/row/all/dimmer”: “All Targets” on Layer “Bare” has no Attributes to hold rows for.",
    );
  });

  it("says what kind of Layer it is when the field is not one it has", () => {
    expect(unknownAddress(document, "layer/look/param/rate")).toBe(
      "Unknown address “layer/look/param/rate”: Layer “Base” is a Look Layer; it has rows (layer/<id|name>/row/<target|all>/<attribute>), not Parameters or Cues.",
    );
    expect(unknownAddress(document, "layer/wave/row/all/dimmer")).toBe(
      "Unknown address “layer/wave/row/all/dimmer”: Layer “Breathe” is a Visual Layer; it has Parameters and Cues, not rows.",
    );
    expect(error(fireAddress(document, "layer/g/cue/x", Math.random))).toBe(
      "Unknown address “layer/g/cue/x”: Layer “Pack” is a Group; it has no Parameters, Cues or rows.",
    );
  });

  it("keeps the plain message for everything else", () => {
    expect(error(writeAddress(document, "layer/wave/nope", 1))).toBe(
      "Unknown address “layer/wave/nope”.",
    );
    expect(error(fireAddress(document, "scene/zz/play", Math.random))).toBe(
      "Unknown address “scene/zz/play”.",
    );
  });
});
