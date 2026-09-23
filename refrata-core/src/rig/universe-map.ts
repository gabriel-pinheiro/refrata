import { fixtureModeOf, patchedIn } from "../document/fixtures.ts";
import type { Document } from "../document/document.ts";
import type { PatchedFixture } from "../document/rig.ts";
import type { Mode } from "./fixture-type.ts";
import { UNIVERSE_SIZE } from "./frames.ts";

/** One DMX Address of a Universe as the Fixture patched over it uses it. */
export interface OccupiedAddress {
  readonly fixture: PatchedFixture;
  readonly mode: Mode;
  /** The Fixture's first and last address, so its whole run is known from any address in it. */
  readonly start: number;
  readonly end: number;
  readonly channelKey: string;
  /** Which byte of the Channel this address carries, from 1, and how many bytes the Channel has. */
  readonly byte: number;
  readonly bytes: number;
}

/** What each address of a Universe holds, by DMX Address from 1; a free address is absent. */
export type UniverseMap = ReadonlyMap<number, OccupiedAddress>;

/** A run of consecutive addresses: one Fixture's footprint, or the free gap before the next. */
export interface UniverseRun {
  readonly start: number;
  readonly end: number;
  readonly fixture: PatchedFixture | undefined;
}

/**
 * The occupancy of a Universe: which Fixture and which of its Channels sits
 * on each DMX Address. Patches never overlap, so each address has at most
 * one owner; a Fixture whose type is missing occupies nothing, and a
 * footprint is cut at the Universe's end.
 */
export function universeMap(
  document: Pick<Document, "fixtures" | "fixtureTypes">,
  universeId: string,
): UniverseMap {
  const map = new Map<number, OccupiedAddress>();
  for (const fixture of patchedIn(document, universeId)) {
    const mode = fixtureModeOf(document, fixture);
    if (mode === undefined || fixture.patch === null) continue;
    const start = fixture.patch.address;
    let address = start;
    for (const channel of mode.channels) address += channel.bytes;
    const end = Math.min(address - 1, UNIVERSE_SIZE);
    address = start;
    for (const channel of mode.channels) {
      for (let byte = 1; byte <= channel.bytes; byte += 1) {
        if (address <= UNIVERSE_SIZE)
          map.set(address, {
            fixture,
            mode,
            start,
            end,
            channelKey: channel.key,
            byte,
            bytes: channel.bytes,
          });
        address += 1;
      }
    }
  }
  return map;
}

/** The Universe as runs from 1 to 512: each patched Fixture's footprint and every free gap between. */
export function universeRuns(
  document: Pick<Document, "fixtures" | "fixtureTypes">,
  universeId: string,
): readonly UniverseRun[] {
  const runs: UniverseRun[] = [];
  let next = 1;
  for (const occupied of universeMap(document, universeId).values()) {
    if (occupied.start < next) continue;
    if (occupied.start > next)
      runs.push({ start: next, end: occupied.start - 1, fixture: undefined });
    runs.push({
      start: occupied.start,
      end: occupied.end,
      fixture: occupied.fixture,
    });
    next = occupied.end + 1;
  }
  if (next <= UNIVERSE_SIZE)
    runs.push({ start: next, end: UNIVERSE_SIZE, fixture: undefined });
  return runs;
}

/** The Channel's name on an address: `red`, or `pan 2` for the second byte of a two-byte Channel. */
export function channelLabel(occupied: OccupiedAddress): string {
  return occupied.bytes > 1
    ? `${occupied.channelKey} ${String(occupied.byte)}`
    : occupied.channelKey;
}
