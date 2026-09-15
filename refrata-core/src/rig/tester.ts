import type { Document, Tester } from "../document/document.ts";
import type { Patch } from "../document/patch.ts";
import { settings } from "../settings.ts";
import { UNIVERSE_SIZE } from "./frames.ts";

/** The document path of the DMX Tester's state. */
export const TESTER_PATH = ["operational", "tester"] as const;

/** Why a range cannot be held, or undefined when it can. */
export function testerRangeProblem(
  document: Pick<Document, "universes">,
  universeId: string,
  address: number,
  count: number,
): string | undefined {
  if (!(universeId in document.universes))
    return `Universe “${universeId}” does not exist.`;
  if (count < 1 || count > settings.tester.maxChannels)
    return `A range holds 1 to ${String(settings.tester.maxChannels)} channels.`;
  if (address < 1 || address + count - 1 > UNIVERSE_SIZE)
    return `Channels ${String(address)} to ${String(address + count - 1)} do not fit in a Universe of ${String(UNIVERSE_SIZE)}.`;
  return undefined;
}

/** Whether `channel` (absolute, 1-based) lies in the held range. */
export function testerHolds(tester: Tester, channel: number): boolean {
  return (
    channel >= tester.address && channel < tester.address + tester.values.length
  );
}

/** The bytes the tester writes onto a frame, by 0-based slot; every held channel reads 0 under Blackout. */
export function testerBytes(
  tester: Tester,
  blackout: boolean,
): readonly (readonly [slot: number, byte: number])[] {
  const result: [number, number][] = [];
  tester.values.forEach((value, index) => {
    if (value === null) return;
    result.push([tester.address - 1 + index, blackout ? 0 : value]);
  });
  return result;
}

/** A patch replacing the tester's state. */
export function testerPatch(tester: Tester | null): Patch {
  return { op: "set", path: [...TESTER_PATH], value: tester };
}
