import { visualContributions } from "../composition/visual-contributions.ts";
import type { VisualLayer } from "../document/composition.ts";
import type { Document } from "../document/document.ts";
import { run, stage, withTable } from "./preset-stage.ts";

/** What the Region tests share, on top of the Preset tests' stage. */

/** The stage with a Visual Layer Move over the Set Movers. */
export function withLayer(visual: string, base: Document = stage()): Document {
  return run(base, "layer.create", {
    id: "move",
    kind: "visual",
    visual,
    sceneId: "verse",
    name: "Move",
    targets: ["set:movers"],
  }).document;
}

export const moved = (document: Document): VisualLayer =>
  document.layers.move as VisualLayer;

/** What Move lands on an Element when its Visual writes these fractions along the width and the height. */
export function lands(document: Document, ref: string, x: number, y: number) {
  const layer = moved(document);
  const [width, height] =
    layer.visual === "figure" ? ["x", "y"] : ["pan", "tilt"];
  const at = (value: number) => new Map([["set:movers", { value, alpha: 1 }]]);
  const values = visualContributions(
    document,
    layer,
    new Map([
      [width ?? "", at(x)],
      [height ?? "", at(y)],
    ]),
  ).get(ref);
  return [values?.get("pan")?.value, values?.get("tilt")?.value];
}

/** Table holds where a fly starts, Wall where it ends: Left flies up, Right the other way. */
export function withCorners(): Document {
  let document = run(withLayer("flyout", withTable()), "preset.create", {
    id: "wall",
    name: "Wall",
    elements: ["set:movers"],
  }).document;
  for (const [element, pan, tilt] of [
    ["left/root", 50, 80],
    ["right/root", -70, -60],
  ] as const)
    document = run(document, "aim.edit", {
      pan: `preset/wall/row/${element}/pan`,
      tilt: `preset/wall/row/${element}/tilt`,
      value: { pan, tilt },
    }).document;
  document = run(document, "link.preset", {
    presetId: "table",
    addresses: ["layer/move/region/from/pan", "layer/move/region/from/tilt"],
  }).document;
  return run(document, "link.preset", {
    presetId: "wall",
    addresses: ["layer/move/region/to/pan", "layer/move/region/to/tilt"],
  }).document;
}
