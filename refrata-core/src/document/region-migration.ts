import { linkAt } from "../address/links.ts";
import { ATTRIBUTES } from "../rig/attributes.ts";
import { visualDefinition } from "../visuals/catalog.ts";
import type { SlotBinding, VisualLayer } from "./composition.ts";
import { isControllerLink, type Document } from "./document.ts";
import { dropActions } from "./macros.ts";
import { applyPatches, type Patch } from "./patch.ts";
import type { Region, RegionAxis } from "./region.ts";
import { paramAddress } from "./visual-layers.ts";

/**
 * Files written before Regions held the box of a Figure, a Flyout or a
 * Ballyhoo in Visual Parameters, in degrees, sent through the anchors of two Slot
 * Bindings. Opening one, each such Layer takes a typed Region that gives
 * the same output: the box those Parameters showed at that moment, through
 * those anchors. A Layer whose two Slots were not on `pan` and `tilt` keeps
 * its bindings instead, their anchors moved to the box. The Parameters go,
 * with the Links and Macro actions on them, since a Region is set once and
 * takes no Controller.
 */
interface Legacy {
  /** The Parameters that held each axis's two ends, or its center and size; a center given as a number is where the Visual always drew. */
  readonly ends: Readonly<
    Record<RegionAxis, readonly [string | number, string, "ends" | "center"]>
  >;
  readonly defaults: Readonly<Record<string, number>>;
}

const LEGACY: Readonly<Record<string, Legacy>> = {
  figure: {
    ends: {
      pan: ["centerX", "width", "center"],
      tilt: ["centerY", "height", "center"],
    },
    defaults: { centerX: 0, centerY: 0, width: 30, height: 30 },
  },
  flyout: {
    ends: { pan: ["panMin", "panMax", "ends"], tilt: ["from", "to", "ends"] },
    defaults: { from: -30, to: 60, panMin: -30, panMax: 30 },
  },
  ballyhoo: {
    ends: { pan: [0, "pan", "center"], tilt: [0, "tilt", "center"] },
    defaults: { pan: 60, tilt: 30 },
  },
};

/** The range a removed Parameter had, by what it measured: a size from 0 to 180, else its axis's whole range. */
function legacyRange(axis: RegionAxis, size: boolean) {
  return size ? { min: 0, max: 180 } : ATTRIBUTES[axis];
}

/** What a removed Parameter showed: its Controller's value through the Link's anchors, on the whole-degree grid it had, or the stored one. */
function shown(
  document: Document,
  layer: VisualLayer,
  name: string,
  fallback: number,
  range: { readonly min: number; readonly max: number },
): number {
  const stored = layer.parameters[name];
  const authored = typeof stored === "number" ? stored : fallback;
  const link = linkAt(document, paramAddress(layer.id, name));
  if (link === undefined || !isControllerLink(link)) return authored;
  const controller = document.controllers[link.controllerId];
  if (controller?.kind !== "number") return authored;
  const { from, to } = link.anchors ?? { from: 0, to: 1 };
  const value = Math.round(from + (to - from) * controller.value);
  return Math.min(range.max, Math.max(range.min, value));
}

/** Where degrees written on an axis's Slot landed through a binding's anchors. */
function through(
  binding: SlotBinding | undefined,
  axis: RegionAxis,
  target: { readonly min: number; readonly max: number },
): (degrees: number) => number {
  const { min, max } = ATTRIBUTES[axis];
  const from = binding?.from ?? target.min;
  const to = binding?.to ?? target.max;
  return (degrees) =>
    from +
    (to - from) * Math.min(1, Math.max(0, (degrees - min) / (max - min)));
}

/** The Layer as it is after Regions, with the Addresses of the Parameters it lost; undefined for a Layer with nothing to migrate. */
function migrateLayer(
  document: Document,
  layer: VisualLayer,
):
  | { readonly layer: VisualLayer; readonly lost: readonly string[] }
  | undefined {
  const legacy = LEGACY[layer.visual];
  const declared = visualDefinition(layer.visual)?.region;
  if (legacy === undefined || declared === undefined) return undefined;
  if (layer.region !== undefined) return undefined;
  const names = Object.keys(legacy.defaults);
  if (!names.some((name) => name in layer.parameters)) return undefined;

  // Each axis's two ends in the degrees the Visual wrote, before any anchors.
  const box = {} as Record<RegionAxis, { from: number; to: number }>;
  for (const axis of ["pan", "tilt"] as const) {
    const [first, second, kind] = legacy.ends[axis];
    const a =
      typeof first === "number"
        ? first
        : shown(
            document,
            layer,
            first,
            legacy.defaults[first] ?? 0,
            legacyRange(axis, false),
          );
    const b = shown(
      document,
      layer,
      second,
      legacy.defaults[second] ?? 0,
      legacyRange(axis, kind === "center"),
    );
    box[axis] =
      kind === "center"
        ? { from: a - b / 2, to: a + b / 2 }
        : { from: a, to: b };
  }

  const slots = { pan: declared.width, tilt: declared.height };
  const parameters: Record<string, VisualLayer["parameters"][string]> = {};
  for (const [name, value] of Object.entries(layer.parameters))
    if (!names.includes(name)) parameters[name] = value;
  const lost = names.map((name) => paramAddress(layer.id, name));

  const onAim =
    layer.bindings[slots.pan]?.attribute === "pan" &&
    layer.bindings[slots.tilt]?.attribute === "tilt";
  if (!onAim) {
    // The Slots reach something else: they stay on their bindings, the anchors now the box.
    const bindings = { ...layer.bindings };
    for (const axis of ["pan", "tilt"] as const) {
      const binding = bindings[slots[axis]];
      const attribute = binding?.attribute ?? null;
      if (binding === undefined || attribute === null) continue;
      const target = ATTRIBUTES[attribute as keyof typeof ATTRIBUTES];
      if (target?.kind !== "number") continue;
      const map = through(binding, axis, target);
      bindings[slots[axis]] = {
        attribute,
        from: map(box[axis].from),
        to: map(box[axis].to),
      };
    }
    return { layer: { ...layer, parameters, bindings }, lost };
  }

  const ends = {} as Record<RegionAxis, { from: number; to: number }>;
  for (const axis of ["pan", "tilt"] as const) {
    const map = through(layer.bindings[slots[axis]], axis, ATTRIBUTES[axis]);
    ends[axis] = { from: map(box[axis].from), to: map(box[axis].to) };
  }
  const bindings = Object.fromEntries(
    Object.entries(layer.bindings).filter(
      ([slot]) => slot !== slots.pan && slot !== slots.tilt,
    ),
  );
  const relative = layer.blendMode === "add";
  const backwards =
    ends.pan.from > ends.pan.to || ends.tilt.from > ends.tilt.to;
  // A Figure or a Ballyhoo is by center and size; a Flyout, or a box that ran backwards, keeps its corners where the Blend Mode allows them.
  const corners = !relative && (layer.visual === "flyout" || backwards);
  const region: Region = corners
    ? {
        form: "corners",
        from: { pan: ends.pan.from, tilt: ends.tilt.from },
        to: { pan: ends.pan.to, tilt: ends.tilt.to },
      }
    : {
        form: "center",
        center: {
          pan: (ends.pan.from + ends.pan.to) / 2,
          tilt: (ends.tilt.from + ends.tilt.to) / 2,
        },
        width: Math.abs(ends.pan.to - ends.pan.from),
        height: Math.abs(ends.tilt.to - ends.tilt.from),
      };
  if (layer.visual === "flyout" && !corners && ends.tilt.from > ends.tilt.to)
    parameters.direction = "backward";
  return { layer: { ...layer, parameters, bindings, region }, lost };
}

/** The document with every Layer written before Regions given its Region; the same document when there is none. */
export function migrateRegions(document: Document): Document {
  const patches: Patch[] = [];
  const lost = new Set<string>();
  for (const layer of Object.values(document.layers)) {
    if (layer.kind !== "visual") continue;
    const migrated = migrateLayer(document, layer);
    if (migrated === undefined) continue;
    patches.push({
      op: "set",
      path: ["layers", layer.id],
      value: migrated.layer,
    });
    for (const address of migrated.lost) lost.add(address);
  }
  if (patches.length === 0) return document;
  for (const link of Object.values(document.links))
    if (lost.has(link.address))
      patches.push({ op: "remove", path: ["links", link.id] });
  patches.push(...dropActions(document, (action) => !lost.has(action.address)));
  return applyPatches(document, patches);
}
