import { describe, expect, it } from "vitest";

import rgbJson from "../../../refrata-library/generic/rgb-3ch.json" with { type: "json" };
import strobeJson from "../../../refrata-library/generic/atomic-like-panel.json" with { type: "json" };
import { executeCommand } from "../command/execute.ts";
import { createBuiltInRegistry } from "../commands/index.ts";
import { settings } from "../settings.ts";
import { emptyDocument, type Document } from "./document.ts";
import {
  elementCentre,
  frameFittingTargets,
  fromFrameSpace,
  geometryInput,
  targetCentre,
  toFrameSpace,
} from "./geometry.ts";
import { expandTargets, locateElement } from "./targets.ts";
import type { VisualLayer } from "./composition.ts";

const registry = createBuiltInRegistry();
const cell = settings.rigView.cellMetres;

function apply(document: Document, steps: readonly [string, unknown][]) {
  let current = document;
  for (const [name, payload] of steps) {
    const result = executeCommand(registry, current, name, payload);
    if (!result.ok) throw new Error(result.error);
    current = result.document;
  }
  return current;
}

/** A Par at the origin, a Strobe at x 3 turned 90°, and a Wipe over both. */
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
        typeKey: "generic/atomic-like-panel",
        modeKey: "32ch",
        fixtureType: strobeJson,
        name: "Strobe",
      },
    ],
    ["fixture.place", { fixtureId: "par", position: { x: 0, y: 0 } }],
    [
      "fixture.place",
      { fixtureId: "strobe", position: { x: 3, y: 1, rz: 90 } },
    ],
    [
      "set.create",
      { id: "all", name: "All", members: ["par/root", "strobe/root"] },
    ],
    ["scene.create", { id: "verse", name: "Verse" }],
    [
      "layer.create",
      {
        id: "wipe",
        kind: "visual",
        visual: "wipe",
        sceneId: "verse",
        targets: ["set:all"],
      },
    ],
  ]);
}

const located = (document: Document, ref: string) => {
  const found = locateElement(document, ref);
  if (found === undefined) throw new Error(`No ${ref}.`);
  return found;
};

describe("Target centres", () => {
  it("puts a single-shape root at the middle of its shape", () => {
    // `single` draws a two-cell square whose centre sits one cell above the Position.
    expect(elementCentre(stage(), located(stage(), "par/root"))).toEqual({
      x: 0,
      y: cell,
    });
  });

  it("rotates an Element's shape with its Fixture", () => {
    const document = stage();
    const root = elementCentre(document, located(document, "strobe/root"));
    const panel = elementCentre(document, located(document, "strobe/panel-1"));
    // Turned 90°, the shape's own x becomes stage y and its y runs to stage
    // left, so the root sits left of the Position and the first panel below it.
    expect(root.x).toBeCloseTo(3 - 0.3125);
    expect(root.y).toBeCloseTo(1);
    expect(panel.x).toBeCloseTo(3 - cell / 2);
    expect(panel.y).toBeCloseTo(1 - 0.375);
  });

  it("gives an unspread Set the centroid of its members and a spread one a point each", () => {
    const document = stage();
    const [set] = expandTargets(document, [{ ref: "set:all", spread: false }]);
    const par = elementCentre(document, located(document, "par/root"));
    const strobe = elementCentre(document, located(document, "strobe/root"));
    expect(set === undefined ? undefined : targetCentre(document, set)).toEqual(
      { x: (par.x + strobe.x) / 2, y: (par.y + strobe.y) / 2 },
    );
    const spread = expandTargets(document, [{ ref: "set:all", spread: true }]);
    expect(spread.map((target) => targetCentre(document, target))).toEqual([
      par,
      strobe,
    ]);
  });
});

describe("Frames", () => {
  it("maps stage points into a rotated Frame and back", () => {
    const frame = { x: 1, y: 1, width: 2, height: 1, rotation: 90 };
    const point = toFrameSpace(frame, { x: 1, y: 2 });
    expect(point.x).toBeCloseTo(1);
    expect(point.y).toBeCloseTo(0);
    const back = fromFrameSpace(frame, point);
    expect(back.x).toBeCloseTo(1);
    expect(back.y).toBeCloseTo(2);
  });

  it("fits a new Geometry Layer's Frame around everything its Targets draw", () => {
    const document = stage();
    const layer = document.layers.wipe as VisualLayer;
    expect(layer.frame).toBeDefined();
    expect(layer.frame).toEqual(frameFittingTargets(document, layer));
    // The Par's square spans x -0.25 to 0.25 and y 0 to 0.5; the turned
    // Strobe spans x 2.375 to 3 and y 0.5 to 1.5. Centimetres, so 1.375 rounds.
    expect(layer.frame).toEqual({
      x: 1.38,
      y: 0.75,
      width: 3.25,
      height: 1.5,
      rotation: 0,
    });
  });

  it("gives a Layer whose Targets draw nothing a two-cell square at the origin", () => {
    const document = stage();
    const layer = { ...(document.layers.wipe as VisualLayer), targets: [] };
    expect(frameFittingTargets(document, layer)).toEqual({
      x: 0,
      y: 0,
      width: cell * 2,
      height: cell * 2,
      rotation: 0,
    });
  });

  it("hands a Geometry Visual its Targets in Frame space with the Frame's size", () => {
    const document = stage();
    const layer: VisualLayer = {
      ...(document.layers.wipe as VisualLayer),
      targets: [{ ref: "set:all", spread: true }],
      frame: { x: 0, y: cell, width: 4, height: 2, rotation: 0 },
    };
    const input = geometryInput(document, layer);
    expect(input?.width).toBe(4);
    expect(input?.targets.map((target) => target.key)).toEqual([
      "par/root",
      "strobe/root",
    ]);
    expect(input?.targets[0]).toMatchObject({ index: 0, count: 2, x: 0, y: 0 });
    expect(input?.targets[1]?.x).toBeCloseTo(3 - 0.3125);
    expect(input?.targets[1]?.y).toBeCloseTo(1 - cell);
    expect(
      geometryInput(document, { ...layer, frame: undefined }),
    ).toBeUndefined();
  });
});
