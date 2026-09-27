import {
  createBuiltInRegistry,
  emptyDocument,
  executeCommand,
  type Document,
  type LookLayer,
} from "@refrata/core";
import { describe, expect, it } from "vitest";

import beamJson from "../../refrata-library/generic/beam-moving-head.json" with { type: "json" };
import moverJson from "../../refrata-library/generic/moving-head.json" with { type: "json" };
import { aimReport, formatAim } from "./aim-lines.ts";

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

/** A wide mover and a beam that tilts only to 90°, Look Layer Base on both, the All Targets Aim at 30° and 100°, pan linked. */
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
    document = run(document, "layer.row.set", {
      layerId: "base",
      targets: ["all"],
      attribute,
    });
  return run(document, "aim.edit", {
    pan: "layer/base/row/all/pan",
    tilt: "layer/base/row/all/tilt",
    value: { pan: 30, tilt: 100 },
  });
}

describe("aim lines", () => {
  it("prints each axis with its limits and the Elements a value is beyond", () => {
    const document = stage();
    const layer = look(document);
    expect(
      formatAim(
        document,
        { layer, ref: "all" },
        aimReport(document, { layer, ref: "all" }),
      ),
    ).toEqual([
      "Aim of All Targets on “Base”",
      "  pan   30.0°  (within -270.0° to 270.0°)",
      "  tilt  100.0°  (within -135.0° to 135.0°)",
      "    warning: beyond Beam, which reaches -90.0° to 90.0°",
    ]);
  });

  it("names the Controller of a linked axis, and a Target without rows of its own as released", () => {
    const document = run(stage(), "controller.create", {
      id: "sweep",
      kind: "number",
      name: "Sweep",
      addresses: ["layer/base/row/all/pan"],
    });
    const layer = look(document);
    const [pan] = aimReport(document, { layer, ref: "all" });
    expect(pan).toMatchObject({ controlledBy: "Sweep", value: 30 });
    expect(formatAim(document, { layer, ref: "all" }, [pan!])[1]).toMatch(
      /^ {2}pan {3}.*°, controlled by Sweep {2}\(within/,
    );
    const own = aimReport(document, {
      layer: look(document),
      ref: "beam/root",
    });
    expect(own.map((axis) => axis.value)).toEqual([undefined, undefined]);
    expect(own[1]?.limits).toEqual({ min: -90, max: 90 });
  });

  it("keeps All Targets limits from every Target, even those that override it", () => {
    const document = run(
      run(stage(), "layer.aim.set", {
        layerId: "base",
        targets: ["wide/root", "beam/root"],
      }),
      "layer.targets.remove",
      { layerId: "base", targets: ["wide/root"] },
    );
    const [, tilt] = aimReport(document, { layer: look(document), ref: "all" });
    expect(tilt?.limits).toEqual({ min: -90, max: 90 });
    expect(tilt?.beyond.map((range) => range.label)).toEqual(["Beam"]);
  });

  it("refuses a row ref without both axes", () => {
    const document = stage();
    expect(() =>
      aimReport(document, { layer: look(document), ref: "wide/nope" }),
    ).toThrow("has no Pan, so it has no Aim.");
  });
});
