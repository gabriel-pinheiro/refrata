import { describe, expect, it } from "vitest";

import beamJson from "../../../refrata-library/generic/beam-moving-head.json" with { type: "json" };
import moverJson from "../../../refrata-library/generic/moving-head.json" with { type: "json" };
import { executeCommand } from "../command/execute.ts";
import { createBuiltInRegistry } from "../commands/index.ts";
import type { LookLayer } from "../document/composition.ts";
import { emptyDocument, type Document } from "../document/document.ts";
import { nudgeWithin, outOfReach, reachLimits, rowReach } from "./row-reach.ts";

const registry = createBuiltInRegistry();

function run(document: Document, name: string, payload: unknown): Document {
  const result = executeCommand(registry, document, name, payload);
  if (!result.ok) throw new Error(result.error);
  return result.document;
}

function look(document: Document): LookLayer {
  const layer = document.layers.base;
  if (layer?.kind !== "look") throw new Error("base is not a Look Layer.");
  return layer;
}

/** A wide mover and a beam that tilts only to 90°, both in Set Movers, and Look Layer Base on the Set and on the beam. */
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
  document = run(document, "set.create", {
    id: "movers",
    name: "Movers",
    members: ["wide/root", "beam/root"],
  });
  document = run(document, "scene.create", { id: "verse", name: "Verse" });
  return run(document, "layer.create", {
    id: "base",
    sceneId: "verse",
    name: "Base",
    targets: ["set:movers", "beam/root"],
  });
}

describe("rowReach", () => {
  it("reaches a Set's members and an Element with their own ranges", () => {
    const document = stage();
    const layer = look(document);
    expect(rowReach(document, layer, "set:movers", "tilt")).toEqual([
      { ref: "wide/root", label: "Wide", min: -135, max: 135 },
      { ref: "beam/root", label: "Beam", min: -90, max: 90 },
    ]);
    expect(rowReach(document, layer, "beam/root", "tilt")).toEqual([
      { ref: "beam/root", label: "Beam", min: -90, max: 90 },
    ]);
  });

  it("reaches through All Targets only the Targets without a row of their own", () => {
    let document = stage();
    expect(
      rowReach(document, look(document), "all", "tilt").map(
        (range) => range.ref,
      ),
    ).toEqual(["wide/root", "beam/root"]);
    document = run(document, "layer.row.set", {
      layerId: "base",
      targets: ["set:movers"],
      attribute: "tilt",
    });
    expect(rowReach(document, look(document), "all", "tilt")).toEqual([
      { ref: "beam/root", label: "Beam", min: -90, max: 90 },
    ]);
    document = run(document, "controller.create", {
      id: "sweep",
      kind: "number",
      name: "Sweep",
      addresses: ["layer/base/row/beam/root/tilt"],
    });
    expect(rowReach(document, look(document), "all", "tilt")).toEqual([]);
  });

  it("gives the widest limits and names who cannot go to a value", () => {
    const document = stage();
    const reach = rowReach(document, look(document), "set:movers", "tilt");
    expect(reachLimits(reach, { min: -270, max: 270 })).toEqual({
      min: -135,
      max: 135,
    });
    expect(reachLimits(reach, { min: -100, max: 100 })).toEqual({
      min: -100,
      max: 100,
    });
    expect(reachLimits([], { min: -135, max: 135 })).toEqual({
      min: -135,
      max: 135,
    });
    expect(outOfReach(reach, 100).map((range) => range.label)).toEqual([
      "Beam",
    ]);
    expect(outOfReach(reach, 45)).toEqual([]);
  });

  it("stops a nudge at a limit but never pulls a value back from beyond it", () => {
    const limits = { min: -90, max: 90 };
    expect(nudgeWithin(89.5, 1, limits)).toBe(90);
    expect(nudgeWithin(-89.5, -1, limits)).toBe(-90);
    expect(nudgeWithin(120, 1, limits)).toBe(120);
    expect(nudgeWithin(120, -1, limits)).toBe(119);
    expect(nudgeWithin(10, 0, limits)).toBe(10);
  });
});
