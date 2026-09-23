import type { Document } from "../document/document.ts";
import { fixtureModeOf, patchedIn } from "../document/fixtures.ts";
import type { ParameterValues } from "../parameters.ts";
import { elementRef, elementsOf } from "./elements.ts";
import { encodeMode } from "./encoding.ts";
import { channelSlot, footprintOf } from "./fixture-type.ts";
import { testerBytes } from "./tester.ts";

/** The 512 slots of a Universe. */
export const UNIVERSE_SIZE = 512;

/** Every Element's resolved values, keyed by `<fixtureId>/<key>`; Resolve (composition/resolve.ts) produces it. */
export type ResolvedValuesByRef = ReadonlyMap<string, ParameterValues>;

/**
 * The DMX Frame of one Universe from resolved values: 512 bytes, unpatched
 * slots at 0. A running Action's byte is written over its Fixture's bytes,
 * then the DMX Tester's held channels over everything. Under Blackout the
 * frame is all zeros, whatever the patch, the Tester or an Action says: it
 * is the kill switch, and it must not depend on a Fixture Type being right.
 */
export function universeFrame(
  document: Document,
  universeId: string,
  resolved: ResolvedValuesByRef,
): Uint8Array {
  const frame = new Uint8Array(UNIVERSE_SIZE);
  if (document.operational.blackout) return frame;
  for (const fixture of patchedIn(document, universeId)) {
    const mode = fixtureModeOf(document, fixture);
    if (mode === undefined || fixture.patch === null) continue;
    const start = fixture.patch.address - 1;
    if (start + footprintOf(mode) > UNIVERSE_SIZE) continue;
    const bytes = encodeMode(mode, elementsOf(mode), (key) =>
      resolved.get(elementRef(fixture.id, key)),
    );
    for (const [key, action] of Object.entries(mode.actions)) {
      if (document.operational.actions[`${fixture.id}/${key}`] !== true)
        continue;
      const slot = channelSlot(mode, action.channel);
      if (slot !== undefined) bytes[slot.offset] = action.byte;
    }
    frame.set(bytes, start);
  }
  const tester = document.operational.tester;
  if (tester?.universeId === universeId)
    for (const [slot, byte] of testerBytes(tester)) frame[slot] = byte;
  return frame;
}

/** Every Universe's DMX Frame, keyed by Universe id. */
export function universeFrames(
  document: Document,
  resolved: ResolvedValuesByRef,
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
