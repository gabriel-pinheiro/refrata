import { numberProblem } from "../parameters.ts";
import {
  isPresetLink,
  type Controller,
  type ControllerLink,
  type Document,
  type Link,
  type Table,
} from "../document/document.ts";
import type { ValuePreset } from "../document/preset.ts";
import { getAtPath } from "../document/patch.ts";
import {
  linkable,
  resolveAddress,
  type AddressValue,
  type ResolvedAddress,
} from "./address.ts";

/**
 * Parameter Links resolved at read time. Nothing is materialized: the
 * document keeps its authored values, and whoever needs what an Address is
 * showing right now asks here, so every reader sees the same rule.
 */

const indexes = new WeakMap<Table<Link>, ReadonlyMap<string, Link>>();

/** Links by Address, built once per `links` table identity. */
export function linksByAddress(links: Table<Link>): ReadonlyMap<string, Link> {
  let index = indexes.get(links);
  if (index === undefined) {
    index = new Map(Object.values(links).map((link) => [link.address, link]));
    indexes.set(links, index);
  }
  return index;
}

/** The Link driving `address`, if any. */
export function linkAt(
  document: Pick<Document, "links">,
  address: string,
): Link | undefined {
  return linksByAddress(document.links).get(address);
}

/** The Links whose target Address starts with `prefix` ("macro/<id>/"), in no particular order. */
export function linksUnder(
  links: Table<Link>,
  prefix: string,
): readonly Link[] {
  return Object.values(links).filter((link) => link.address.startsWith(prefix));
}

/** The Controller a Link takes its value from; none for a Preset Link or a Controller that is gone. */
export function controllerOfLink(
  document: Pick<Document, "controllers">,
  link: Link,
): Controller | undefined {
  return isPresetLink(link)
    ? undefined
    : document.controllers[link.controllerId];
}

/** The Preset a Link takes its values from; none for a Controller Link or a Preset that is gone. */
export function presetOfLink(
  document: Pick<Document, "presets">,
  link: Link,
): ValuePreset | undefined {
  if (!isPresetLink(link)) return undefined;
  const preset = document.presets[link.presetId];
  return preset?.kind === "preset" ? preset : undefined;
}

/** Who drives a linked Address, for "is controlled by": the Controller's name, or "Preset “Table Blue”". */
export function linkSourceName(
  document: Pick<Document, "controllers" | "presets">,
  link: Link,
): string {
  if (isPresetLink(link)) {
    const name = document.presets[link.presetId]?.name;
    return name === undefined ? "a Preset" : `Preset “${name}”`;
  }
  return document.controllers[link.controllerId]?.name ?? "a Controller";
}

/**
 * What a Controller's value becomes at a target: a number link maps 0..1
 * onto its anchors, clamped to the target's range and snapped to its step
 * from the minimum; a boolean target is on from 0.5; a color copies.
 */
export function mappedValue(
  controller: Controller,
  link: ControllerLink,
  resolved: ResolvedAddress,
): AddressValue | undefined {
  if (controller.kind === "color")
    return resolved.type === "color" ? controller.value : undefined;
  if (controller.kind === "group") return undefined;
  const position = controller.value;
  if (resolved.type === "boolean") return position >= 0.5;
  if (resolved.type !== "number") return undefined;
  const { from, to } = link.anchors ?? { from: 0, to: 1 };
  let value = from + (to - from) * position;
  const range = resolved.range;
  if (range !== undefined) {
    if (range.step !== undefined && range.step > 0)
      value =
        range.min + Math.round((value - range.min) / range.step) * range.step;
    value = Math.min(range.max, Math.max(range.min, value));
  }
  return value;
}

/**
 * The value an Address shows right now: its Controller's, mapped, or the
 * authored one. A row linked to a Preset has one value per Element and
 * none of its own, so it reads as authored; `presetRowValues` lists what
 * each Element takes.
 */
export function effectiveValue(
  document: Document,
  resolved: ResolvedAddress,
): AddressValue {
  const authored = getAtPath(document, resolved.path) as AddressValue;
  const link = linkAt(document, resolved.address);
  if (link === undefined || isPresetLink(link)) return authored;
  const controller = document.controllers[link.controllerId];
  if (controller === undefined) return authored;
  return mappedValue(controller, link, resolved) ?? authored;
}

/**
 * What an Address shows right now given what is authored there: the
 * Controller's mapped value when a Link drives it, `authored` otherwise.
 * Cheap when nothing is linked, so Resolve asks it at the output rate.
 */
export function effectiveAt(
  document: Document,
  address: string,
  authored: AddressValue | undefined,
): AddressValue | undefined {
  const link = linkAt(document, address);
  if (link === undefined || isPresetLink(link)) return authored;
  const resolved = resolveAddress(document, address);
  const controller = document.controllers[link.controllerId];
  if (resolved === undefined || controller === undefined) return authored;
  return mappedValue(controller, link, resolved) ?? authored;
}

/** Why `controller` cannot drive `resolved`, or undefined when it can. */
export function linkProblem(
  controller: Controller,
  resolved: ResolvedAddress,
): string | undefined {
  if (controller.kind === "group") return "A Group has no value to link.";
  if (!linkable(resolved, controller.kind))
    return `“${resolved.label}” cannot be driven by a ${controller.kind === "number" ? "Number" : "Color"} Controller.`;
  return undefined;
}

/**
 * Why `preset` cannot drive `resolved`, or undefined when it can. A Preset
 * carries one value per Element, so it drives only what is resolved per
 * Element: a Look Layer row, a Target's or All Targets'.
 */
export function presetLinkProblem(
  resolved: ResolvedAddress,
): string | undefined {
  const [table, , field] = resolved.path;
  if (table === "layers" && (field === "rows" || field === "all"))
    return undefined;
  return `“${resolved.label}” holds one value; a Preset holds one per Element and links only to a Look Layer row.`;
}

/** The anchors a new number link starts with: the target's whole range. */
export function defaultAnchors(
  resolved: ResolvedAddress,
): ControllerLink["anchors"] {
  if (resolved.type !== "number") return null;
  const range = resolved.range ?? { min: 0, max: 1 };
  return { from: range.min, to: range.max };
}

/**
 * Why `anchors` cannot be stored for `resolved`, or undefined when they can:
 * only a number target has anchors, and each must be a value the target
 * accepts directly, within its range and on its step. Reversed anchors are
 * fine; they invert the Controller.
 */
export function anchorsProblem(
  resolved: ResolvedAddress,
  anchors: NonNullable<ControllerLink["anchors"]>,
): string | undefined {
  if (resolved.type !== "number")
    return `${resolved.label} is a ${resolved.type}; only a number target has anchors.`;
  const range = resolved.range ?? { min: 0, max: 1 };
  const grid =
    range.step === undefined ? "" : ` in steps of ${String(range.step)}`;
  for (const [end, value] of [
    ["0", anchors.from],
    ["1", anchors.to],
  ] as const) {
    const problem = numberProblem(range, value);
    if (problem !== undefined)
      return `${resolved.label} anchors must lie within ${String(range.min)} to ${String(range.max)}${grid}; the anchor at ${end} ${problem}.`;
  }
  return undefined;
}
