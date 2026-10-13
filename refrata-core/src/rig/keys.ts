import type { ByteRange } from "./encode-rules.ts";

/**
 * Keys inside a Fixture Type are made from the name a person typed: lower
 * case, digits and dashes, accents folded. A key is made once, when its
 * thing is created, and made unique among its siblings.
 */

/** The key a name gives, or an empty string when the name has no letter or digit. */
export function keyFromName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** `base` when it is free, else the first free of `base-2`, `base-3` and so on. */
export function freeKey(base: string, taken: Iterable<string>): string {
  const held = new Set(taken);
  if (!held.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${String(n)}`;
    if (!held.has(candidate)) return candidate;
  }
}

/** A key as a person reads it: `gobo-rotation` is "Gobo Rotation". */
export function nameFromKey(key: string): string {
  return key
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * The byte range a new swatch or option starts with: right after the one
 * that ends highest, as wide as it; the whole Channel when there is none;
 * undefined when the highest already ends at 255.
 */
export function nextRange(ranges: readonly ByteRange[]): ByteRange | undefined {
  const last = ranges.reduce<ByteRange | undefined>(
    (latest, range) =>
      latest === undefined || range[1] > latest[1] ? range : latest,
    undefined,
  );
  if (last === undefined) return [0, 255];
  if (last[1] >= 255) return undefined;
  return [last[1] + 1, Math.min(255, last[1] + 1 + (last[1] - last[0]))];
}
