import type { Document } from "../document/document.ts";
import { getAtPath, type Patch, type PatchPath } from "../document/patch.ts";
import {
  addressValueProblem,
  resolveAddress,
  sameAddressValue,
  type ResolvedAddress,
} from "./address.ts";
import { linkAt, linkSourceName } from "./links.ts";
import { unknownAddress } from "./unknown.ts";

export type Written =
  | {
      readonly ok: true;
      readonly patches: readonly Patch[];
      readonly resolved: ResolvedAddress;
    }
  | { readonly ok: false; readonly error: string };

/**
 * The patch that puts `value` at `path`. Where the value is a field of
 * something that is not there yet, as a released row's `value` is, the
 * patch writes that thing whole, so undoing it takes the row away again
 * instead of leaving it without a value. It goes no higher than that, so
 * two rows written in one step never write over each other.
 */
export function valuePatch(
  document: Document,
  path: PatchPath,
  value: unknown,
): Patch {
  const owner = path.slice(0, -1);
  const field = path.at(-1);
  if (
    field === undefined ||
    owner.length < 2 ||
    getAtPath(document, owner) !== undefined
  )
    return { op: "set", path, value };
  return { op: "set", path: owner, value: { [field]: value } };
}

/**
 * Writing a value to an Address, the one rule behind `address.set`,
 * `address.edit` and a Macro's set action: the Address must exist, be
 * settable, not be driven by a Controller, and accept the value. Writing
 * what is already there changes nothing.
 */
export function writeAddress(
  document: Document,
  address: string,
  value: unknown,
): Written {
  const resolved = resolveAddress(document, address);
  if (resolved === undefined)
    return { ok: false, error: unknownAddress(document, address) };
  if (resolved.type === "trigger")
    return {
      ok: false,
      error: `Address “${address}” is a trigger; use address.trigger.`,
    };
  const link = linkAt(document, address);
  if (link !== undefined)
    return {
      ok: false,
      error: `${resolved.label} is controlled by ${linkSourceName(document, link)}.`,
    };
  const problem = addressValueProblem(resolved, value);
  if (problem !== undefined)
    return { ok: false, error: `${resolved.label} ${problem}.` };
  if (sameAddressValue(getAtPath(document, resolved.path), value))
    return { ok: true, patches: [], resolved };
  return {
    ok: true,
    patches: [valuePatch(document, resolved.path, value)],
    resolved,
  };
}

/** Flipping a boolean Address: the same rule as a write of its opposite. */
export function toggleAddress(document: Document, address: string): Written {
  const resolved = resolveAddress(document, address);
  if (resolved === undefined)
    return { ok: false, error: unknownAddress(document, address) };
  if (resolved.type !== "boolean")
    return { ok: false, error: `Address “${address}” is not a boolean.` };
  const current = getAtPath(document, resolved.path) === true;
  return writeAddress(document, address, !current);
}
