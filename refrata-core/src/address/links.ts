import { numberProblem } from "../parameters.ts";
import type {
  Controller,
  Document,
  Link,
  Table,
} from "../document/document.ts";
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

/**
 * What a Controller's value becomes at a target: a number link maps 0..1
 * onto its anchors, clamped to the target's range and snapped to its step
 * from the minimum; a boolean target is on from 0.5; a color copies.
 */
export function mappedValue(
  controller: Controller,
  link: Link,
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

/** The value an Address shows right now: its Controller's, mapped, or the authored one. */
export function effectiveValue(
  document: Document,
  resolved: ResolvedAddress,
): AddressValue {
  const authored = getAtPath(document, resolved.path) as AddressValue;
  const link = linkAt(document, resolved.address);
  if (link === undefined) return authored;
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
  if (link === undefined) return authored;
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

/** The anchors a new number link starts with: the target's whole range. */
export function defaultAnchors(resolved: ResolvedAddress): Link["anchors"] {
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
  anchors: NonNullable<Link["anchors"]>,
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
