import type { Patch, PatchPath } from "./patch.ts";

type Node = Readonly<Record<string, unknown>>;

function isNode(value: unknown): value is Node {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b))
    return (
      a.length === b.length && a.every((item, index) => same(item, b[index]))
    );
  if (isNode(a) && isNode(b)) {
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length &&
      keys.every((key) => key in b && same(a[key], b[key]))
    );
  }
  return false;
}

/**
 * The patches that turn `before` into `after` at `path`, one per property
 * that changed: objects are walked, and a list, like any other value, is
 * set whole. What a command that computes a whole next entity returns, so
 * its delta is still per property.
 */
export function diffPatches(
  before: unknown,
  after: unknown,
  path: PatchPath,
): Patch[] {
  if (same(before, after)) return [];
  if (!isNode(before) || !isNode(after))
    return after === undefined
      ? [{ op: "remove", path }]
      : [{ op: "set", path, value: after }];
  const patches: Patch[] = [];
  for (const key of Object.keys(before))
    if (!(key in after) || after[key] === undefined)
      patches.push({ op: "remove", path: [...path, key] });
  for (const [key, value] of Object.entries(after))
    if (value !== undefined)
      patches.push(...diffPatches(before[key], value, [...path, key]));
  return patches;
}
