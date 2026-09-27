import {
  createBuiltInRegistry,
  emptyDocument,
  executeCommand,
  type Document,
} from "@refrata/core";
import { describe, expect, it } from "vitest";

import beamJson from "../../../refrata-library/generic/beam-moving-head.json" with { type: "json" };
import { parseDocumentFile, serializeDocument } from "./document-file.ts";

const registry = createBuiltInRegistry();

function run(document: Document, name: string, payload: unknown): Document {
  const result = executeCommand(registry, document, name, payload);
  if (!result.ok) throw new Error(result.error);
  return result.document;
}

/** A beam under Look Layer Spot, its pan driven by Controller Sweep. */
function stage(): Document {
  let document = emptyDocument("Club");
  for (const [name, payload] of [
    [
      "fixture.create",
      {
        id: "beam",
        typeKey: "generic/beam-moving-head",
        modeKey: "12ch",
        fixtureType: beamJson,
        name: "Beam",
      },
    ],
    ["scene.create", { id: "verse", name: "Verse" }],
    [
      "layer.create",
      { id: "spot", sceneId: "verse", name: "Spot", targets: ["beam/root"] },
    ],
    [
      "controller.create",
      {
        id: "sweep",
        kind: "number",
        name: "Sweep",
        addresses: ["layer/spot/row/all/pan"],
      },
    ],
  ] as const)
    document = run(document, name, payload);
  return document;
}

describe("the Installation file", () => {
  it("opens a file written before Presets, its Controller Links as they were", () => {
    const document = stage();
    const written = JSON.parse(serializeDocument(document)) as Record<
      string,
      unknown
    >;
    delete written.presets;
    const parsed = parseDocumentFile(JSON.stringify(written));
    expect(parsed).toMatchObject({ ok: true, document: { presets: {} } });
    expect(parsed.ok && parsed.document.links).toEqual(document.links);
  });

  it("opens a file written before Regions, its Flyout in the box its Parameters held", () => {
    const document = run(stage(), "layer.create", {
      id: "fly",
      kind: "visual",
      visual: "flyout",
      sceneId: "verse",
      name: "Fly",
      targets: ["beam/root"],
    });
    const written = JSON.parse(serializeDocument(document)) as {
      layers: Record<string, Record<string, unknown>>;
    };
    const fly = written.layers.fly ?? {};
    delete fly.region;
    fly.parameters = { from: 80, to: -10, panMin: -40, panMax: 40, gap: 2 };
    fly.bindings = {
      pan: { attribute: "pan", from: -270, to: 270 },
      tilt: { attribute: "tilt", from: -135, to: 135 },
      level: { attribute: "dimmer", from: 0, to: 1 },
    };
    const parsed = parseDocumentFile(JSON.stringify(written));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.document.layers.fly).toMatchObject({
      parameters: { gap: 2 },
      bindings: { level: { attribute: "dimmer", from: 0, to: 1 } },
      region: {
        form: "corners",
        from: { pan: -40, tilt: 80 },
        to: { pan: 40, tilt: -10 },
      },
    });
    const again = parseDocumentFile(serializeDocument(parsed.document));
    if (!again.ok) throw new Error(again.error);
    expect(again.document.layers.fly).toEqual(parsed.document.layers.fly);
  });

  it("keeps Presets and the Links to them", () => {
    let document = run(stage(), "preset.create", {
      id: "table",
      name: "Table",
      elements: ["beam/root"],
    });
    document = run(document, "link.preset", {
      presetId: "table",
      addresses: ["layer/spot/row/all/tilt"],
    });
    const parsed = parseDocumentFile(serializeDocument(document));
    expect(parsed.ok && parsed.document.presets).toEqual(document.presets);
    expect(parsed.ok && parsed.document.links).toEqual(document.links);
  });
});
