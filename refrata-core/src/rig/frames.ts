import type { Document } from "../document/document.ts";
import { allFixtures, fixtureModeOf, patchedIn } from "../document/fixtures.ts";
import type { ParameterValues } from "../parameters.ts";
import { elementRef, elementsOf } from "./elements.ts";
import { encodeMode } from "./encoding.ts";
import { footprintOf } from "./fixture-type.ts";
import { resolveMode } from "./resolve.ts";

/** The 512 slots of a Universe. */
export const UNIVERSE_SIZE = 512;

/** Every Element's resolved values, keyed by `<fixtureId>/<key>`. */
export type ResolvedDocument = ReadonlyMap<string, ParameterValues>;

/** Resolve the whole Installation: Defaults with held highlights applied. */
export function resolveDocument(document: Document): ResolvedDocument {
  const highlighted = (ref: string): boolean =>
    document.operational.highlight[ref] === true;
  const result = new Map<string, ParameterValues>();
  for (const fixture of allFixtures(document.fixtures)) {
    const mode = fixtureModeOf(document, fixture);
    if (mode === undefined) continue;
    for (const [key, values] of resolveMode(mode, fixture.id, highlighted))
      result.set(elementRef(fixture.id, key), values);
  }
  return result;
}

/** The DMX Frame of one Universe from resolved values: 512 bytes, unpatched slots at 0. */
export function universeFrame(
  document: Document,
  universeId: string,
  resolved: ResolvedDocument = resolveDocument(document),
): Uint8Array {
  const frame = new Uint8Array(UNIVERSE_SIZE);
  for (const fixture of patchedIn(document, universeId)) {
    const mode = fixtureModeOf(document, fixture);
    if (mode === undefined || fixture.patch === null) continue;
    const start = fixture.patch.address - 1;
    if (start + footprintOf(mode) > UNIVERSE_SIZE) continue;
    const bytes = encodeMode(mode, elementsOf(mode), (key) =>
      resolved.get(elementRef(fixture.id, key)),
    );
    frame.set(bytes, start);
  }
  return frame;
}

/** Every Universe's DMX Frame, keyed by Universe id. */
export function universeFrames(
  document: Document,
  resolved: ResolvedDocument = resolveDocument(document),
): ReadonlyMap<string, Uint8Array> {
  return new Map(
    Object.keys(document.universes).map((universeId) => [
      universeId,
      universeFrame(document, universeId, resolved),
    ]),
  );
}

/**
 * A frame for reading: runs of one byte grouped, `<2x 0> 127 127 12 <507x 0>`.
 * A run of one prints the byte alone.
 */
export function formatFrame(frame: Uint8Array | readonly number[]): string {
  const parts: string[] = [];
  let index = 0;
  while (index < frame.length) {
    const byte = frame[index] ?? 0;
    let run = 1;
    while (frame[index + run] === byte) run += 1;
    parts.push(run === 1 ? String(byte) : `<${run}x ${byte}>`);
    index += run;
  }
  return parts.join(" ");
}
