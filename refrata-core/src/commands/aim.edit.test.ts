import { describe, expect, it } from "vitest";

import beamJson from "../../../refrata-library/generic/beam-moving-head.json" with { type: "json" };
import moverJson from "../../../refrata-library/generic/moving-head.json" with { type: "json" };
import { executeCommand } from "../command/execute.ts";
import { emptyDocument, type Document } from "../document/document.ts";
import { History } from "../history/history.ts";
import { createBuiltInRegistry } from "./index.ts";

const registry = createBuiltInRegistry();

function run(document: Document, name: string, payload: unknown): Document {
  const result = executeCommand(registry, document, name, payload);
  if (!result.ok) throw new Error(result.error);
  return result.document;
}

function fails(document: Document, name: string, payload: unknown): string {
  const result = executeCommand(registry, document, name, payload);
  if (result.ok) throw new Error(`${name} was accepted.`);
  return result.error;
}

const all = { pan: "layer/base/row/all/pan", tilt: "layer/base/row/all/tilt" };
const beam = {
  pan: "layer/base/row/beam/root/pan",
  tilt: "layer/base/row/beam/root/tilt",
};

/** A wide mover and a beam that tilts only to 90°, both Targets of Look Layer Base with both Aims ticked on. */
function stage(): Document {
  let document = emptyDocument("Club");
  document = run(document, "fixture.create", {
    id: "wide",
    typeKey: "generic/moving-head",
    modeKey: "8ch",
    fixtureType: moverJson,
    name: "Wide",
  });
  document = run(document, "fixture.create", {
    id: "beam",
    typeKey: "generic/beam-moving-head",
    modeKey: "12ch",
    fixtureType: beamJson,
    name: "Beam",
  });
  document = run(document, "scene.create", { id: "verse", name: "Verse" });
  document = run(document, "layer.create", {
    id: "base",
    sceneId: "verse",
    name: "Base",
    targets: ["wide/root", "beam/root"],
  });
  for (const attribute of ["pan", "tilt"])
    for (const targets of [["all"], ["beam/root"]])
      document = run(document, "layer.row.set", {
        layerId: "base",
        targets,
        attribute,
      });
  return document;
}

describe("aim.edit", () => {
  it("writes both axes in one step, or one axis alone", () => {
    const document = stage();
    const both = executeCommand(registry, document, "aim.edit", {
      ...all,
      value: { pan: 30, tilt: -12.5 },
    });
    if (!both.ok) throw new Error(both.error);
    expect(both.document.layers.base).toMatchObject({
      all: { pan: { value: 30 }, tilt: { value: -12.5 } },
    });
    expect(both.label).toBe("Change Aim");
    expect(both.definition.kind).toBe("authoring");

    const tiltOnly = run(both.document, "aim.edit", {
      ...all,
      value: { tilt: 5 },
    });
    expect(tiltOnly.layers.base).toMatchObject({
      all: { pan: { value: 30 }, tilt: { value: 5 } },
    });
  });

  it("coalesces per pair of Addresses, whichever axes a write moves", () => {
    const document = stage();
    const history = new History();
    let current = document;
    for (const value of [{ pan: 1 }, { tilt: 1 }, { pan: 2, tilt: 2 }]) {
      const result = executeCommand(registry, current, "aim.edit", {
        ...all,
        value,
      });
      if (!result.ok) throw new Error(result.error);
      expect(result.coalesceKey).toBe(
        "aim.edit:layer/base/row/all/pan:layer/base/row/all/tilt",
      );
      history.push({
        sessionId: "studio",
        label: result.label,
        forward: result.patches,
        inverse: result.inverse,
        coalesceKey: result.coalesceKey,
        at: 0,
      });
      current = result.document;
    }
    expect(history.undo("studio").ok).toBe(true);
    expect(history.undo("studio").ok).toBe(false);
  });

  it("clamps to the widest range the row's Elements cover, with a warning", () => {
    const document = stage();
    const beamOnly = executeCommand(registry, document, "aim.edit", {
      ...beam,
      value: { pan: 0, tilt: 120 },
    });
    if (!beamOnly.ok) throw new Error(beamOnly.error);
    expect(beamOnly.document.layers.base).toMatchObject({
      rows: { "beam/root": { pan: { value: 0 }, tilt: { value: 90 } } },
    });
    expect(beamOnly.warnings).toEqual([
      "Tilt clamped to 90.0° from 120.0°: the Elements it reaches go no further.",
    ]);
    // All Targets reaches the wide mover too, so 120 is within reach of one.
    const shared = executeCommand(registry, document, "aim.edit", {
      ...all,
      value: { tilt: 120 },
    });
    if (!shared.ok) throw new Error(shared.error);
    expect(shared.document.layers.base).toMatchObject({
      all: { tilt: { value: 120 } },
    });
    expect(shared.warnings ?? []).toEqual([]);
    expect(
      run(document, "aim.edit", { ...all, value: { tilt: -200 } }).layers.base,
    ).toMatchObject({ all: { tilt: { value: -135 } } });
    expect(
      fails(document, "aim.edit", {
        pan: "layer/base/enabled",
        tilt: all.tilt,
        value: { pan: 1 },
      }),
    ).toBe("Address “layer/base/enabled” is not a number.");
  });

  it("lets a value stored beyond the limits stay or move in, never further out", () => {
    let document = run(stage(), "layer.targets.remove", {
      layerId: "base",
      targets: ["wide/root"],
    });
    document = run(document, "address.edit", {
      address: all.tilt,
      value: 120,
    });
    const tilt = (value: number): unknown => {
      const layer = run(document, "aim.edit", {
        ...all,
        value: { tilt: value },
      }).layers.base;
      return layer?.kind === "look" ? layer.all.tilt?.value : undefined;
    };
    expect(tilt(125)).toBe(120);
    expect(tilt(119)).toBe(119);
    expect(tilt(60)).toBe(60);
    expect(tilt(-120)).toBe(-90);
  });

  it("refuses the whole write when an axis is linked", () => {
    let document = stage();
    document = run(document, "controller.create", {
      id: "sweep",
      kind: "number",
      name: "Sweep",
      addresses: [all.pan],
    });
    expect(
      fails(document, "aim.edit", { ...all, value: { pan: 10, tilt: 10 } }),
    ).toBe("Pan is controlled by Sweep.");
    expect(
      run(document, "aim.edit", { ...all, value: { tilt: 10 } }).layers.base,
    ).toMatchObject({ all: { tilt: { value: 10 } } });
  });

  it("needs a value for at least one axis", () => {
    expect(fails(stage(), "aim.edit", { ...all, value: {} })).toContain(
      "Give a value for pan, tilt or both.",
    );
  });
});
