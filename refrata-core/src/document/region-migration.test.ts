import { describe, expect, it } from "vitest";

import { run, stage } from "../commands/preset-stage.ts";
import { visualContributions } from "../composition/visual-contributions.ts";
import type { VisualLayer } from "./composition.ts";
import type { Document } from "./document.ts";
import { migrateRegions } from "./region-migration.ts";

/** The stage with a Visual Layer as a file from before Regions held it. */
function before(
  visual: "figure" | "flyout",
  old: Partial<VisualLayer> & Pick<VisualLayer, "parameters">,
): Document {
  const document = run(stage(), "layer.create", {
    id: "move",
    kind: "visual",
    visual,
    sceneId: "verse",
    name: "Move",
    targets: ["set:movers"],
  }).document;
  const { region: _region, ...layer } = document.layers.move as VisualLayer;
  const slots = visual === "figure" ? ["x", "y"] : ["pan", "tilt"];
  return {
    ...document,
    layers: {
      ...document.layers,
      move: {
        ...layer,
        bindings: {
          ...layer.bindings,
          [slots[0] ?? ""]: { attribute: "pan", from: -270, to: 270 },
          [slots[1] ?? ""]: { attribute: "tilt", from: -135, to: 135 },
        },
        ...old,
      },
    },
  };
}

const moved = (document: Document): VisualLayer =>
  document.layers.move as VisualLayer;

/** What the Layer lands on Left when its Visual writes these fractions. */
function lands(document: Document, x: number, y: number) {
  const [width, height] =
    moved(document).visual === "figure" ? ["x", "y"] : ["pan", "tilt"];
  const at = (value: number) => new Map([["set:movers", { value, alpha: 1 }]]);
  const values = visualContributions(
    document,
    moved(document),
    new Map([
      [width ?? "", at(x)],
      [height ?? "", at(y)],
    ]),
  ).get("left/root");
  return [values?.get("pan")?.value, values?.get("tilt")?.value];
}

describe("migrateRegions", () => {
  it("gives a Flyout the corners its Parameters held, backwards included", () => {
    const migrated = migrateRegions(
      before("flyout", {
        parameters: { from: 135, to: 0, panMin: 64, panMax: 108, duration: 2 },
      }),
    );
    expect(moved(migrated).region).toEqual({
      form: "corners",
      from: { pan: 64, tilt: 135 },
      to: { pan: 108, tilt: 0 },
    });
    expect(moved(migrated).parameters).toEqual({ duration: 2 });
    expect(Object.keys(moved(migrated).bindings)).toEqual(["level"]);
    expect(lands(migrated, 0.5, 0.5)).toEqual([86, 67.5]);
  });

  it("takes what a Controller showed and drops the Links on the Parameters that went", () => {
    let document = before("flyout", {
      parameters: { from: -30, to: 60, panMin: -30, panMax: 30 },
    });
    document = run(document, "controller.create", {
      id: "wall",
      kind: "number",
      name: "Wall",
    }).document;
    document = {
      ...document,
      controllers: {
        ...document.controllers,
        wall: { ...document.controllers.wall, value: 0.5 } as never,
      },
      links: {
        a: {
          id: "a",
          address: "layer/move/param/panMin",
          controllerId: "wall",
          anchors: { from: -270, to: 230 },
        } as never,
        b: {
          id: "b",
          address: "layer/move/param/duration",
          controllerId: "wall",
          anchors: { from: 1, to: 3 },
        } as never,
      },
    };
    const migrated = migrateRegions(document);
    expect(moved(migrated).region).toMatchObject({
      from: { pan: -20, tilt: -30 },
      to: { pan: 30, tilt: 60 },
    });
    expect(Object.keys(migrated.links)).toEqual(["b"]);
  });

  it("gives a Figure on Add its center and size, scaled by the anchors it had", () => {
    const migrated = migrateRegions(
      before("figure", {
        parameters: { centerX: 0, centerY: -10, width: 100, height: 10 },
        bindings: {
          x: { attribute: "pan", from: -135, to: 135 },
          y: { attribute: "tilt", from: -135, to: 135 },
        },
      }),
    );
    expect(moved(migrated).region).toEqual({
      form: "center",
      center: { pan: 0, tilt: -10 },
      width: 50,
      height: 10,
    });
    expect(lands(migrated, 1, 0.5)).toEqual([25, -10]);
  });

  it("keeps the bindings of Slots that reached something else, anchored to the box", () => {
    const migrated = migrateRegions(
      before("figure", {
        parameters: { centerX: 0, centerY: 0, width: 54, height: 30 },
        bindings: {
          x: { attribute: "dimmer", from: 0, to: 1 },
          y: { attribute: null },
        },
      }),
    );
    expect(moved(migrated).region).toBeUndefined();
    expect(moved(migrated).bindings.x?.from).toBeCloseTo(0.45);
    expect(moved(migrated).bindings.x?.to).toBeCloseTo(0.55);
    expect(moved(migrated).bindings.y).toEqual({ attribute: null });
  });

  it("leaves a document written with Regions as it is", () => {
    const document = run(stage(), "layer.create", {
      id: "move",
      kind: "visual",
      visual: "flyout",
      sceneId: "verse",
    }).document;
    expect(migrateRegions(document)).toBe(document);
  });
});
