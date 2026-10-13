import type { FixtureType } from "../rig/fixture-type.ts";
import { freeKey } from "../rig/keys.ts";
import type { Document, Table } from "./document.ts";
import { fixturesOfType } from "./fixtures.ts";
import type { Patch } from "./patch.ts";
import type { Fixture, FixtureTypeOrigin, StoredFixtureType } from "./rig.ts";

/**
 * A Fixture Type belongs to the Installation: made here, imported from
 * Refrata's library or from a file, and kept until a person removes it. A
 * Fixture's create or type change brings the library's type in when the
 * Installation lacks it.
 */

/** JSON with object keys sorted, so two parses of one file compare equal whatever their key order. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, entry: unknown) =>
    typeof entry === "object" && entry !== null && !Array.isArray(entry)
      ? Object.fromEntries(
          Object.entries(entry as Record<string, unknown>).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0,
          ),
        )
      : entry,
  );
}

/** Whether two Fixture Types say exactly the same thing. */
export function sameFixtureType(a: FixtureType, b: FixtureType): boolean {
  return canonical(a) === canonical(b);
}

/**
 * A short digest of a Fixture Type's canonical form: what a type from the
 * library remembers of the day it came in, to tell later which of the two
 * changed. Two 32-bit hashes, sixteen hex digits; not a secret.
 */
export function fixtureTypeDigest(type: FixtureType): string {
  const text = canonical(type);
  let high = 0xdeadbeef;
  let low = 0x41c6ce57;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    high = Math.imul(high ^ code, 2654435761);
    low = Math.imul(low ^ code, 1597334677);
  }
  high =
    Math.imul(high ^ (high >>> 16), 2246822507) ^
    Math.imul(low ^ (low >>> 13), 3266489909);
  low =
    Math.imul(low ^ (low >>> 16), 2246822507) ^
    Math.imul(high ^ (high >>> 13), 3266489909);
  const hex = (value: number): string =>
    (value >>> 0).toString(16).padStart(8, "0");
  return `${hex(high)}${hex(low)}`;
}

/** The origin of a type that comes from the library as `type` stands now. */
export function libraryOrigin(
  type: FixtureType,
): Extract<FixtureTypeOrigin, { from: "library" }> & { digest: string } {
  return { from: "library", digest: fixtureTypeDigest(type) };
}

/** Where a stored type came from; one saved before origins reads as from the library with nothing remembered. */
export function originOf(
  stored: Pick<StoredFixtureType, "origin">,
): FixtureTypeOrigin {
  return stored.origin ?? { from: "library" };
}

/** The entity a Fixture Type is stored as. */
export function storedFixtureType(
  type: FixtureType,
  origin: FixtureTypeOrigin,
): {
  readonly id: string;
  readonly type: FixtureType;
  readonly origin: FixtureTypeOrigin;
} {
  return { id: type.key, type, origin };
}

/** `key` when the Installation does not hold it, else the first free of `key-2`, `key-3` and so on. */
export function freeTypeKey(
  document: Pick<Document, "fixtureTypes">,
  key: string,
): string {
  return freeKey(key, Object.keys(document.fixtureTypes));
}

/** The patch bringing `type` in from the library when the Installation lacks it, or an error when `typeKey` is not held and no type was supplied. */
export function ensureFixtureType(
  document: Pick<Document, "fixtureTypes">,
  typeKey: string,
  supplied: FixtureType | undefined,
): readonly Patch[] | { readonly error: string } {
  if (typeKey in document.fixtureTypes) return [];
  if (supplied === undefined)
    return {
      error: `Fixture Type “${typeKey}” is not in the Installation; pass fixtureType with it.`,
    };
  if (supplied.key !== typeKey)
    return {
      error: `The supplied Fixture Type is “${supplied.key}”, not “${typeKey}”.`,
    };
  return [
    {
      op: "set",
      path: ["fixtureTypes", typeKey],
      value: storedFixtureType(supplied, libraryOrigin(supplied)),
    },
  ];
}

/**
 * How a type from the library stands against the library's file: it
 * `matches`; it was `edited` here and the library's did not change; the
 * library's is `newer` and the type did not change; `both` changed; it is
 * `gone` from the library; or, for a type that remembers nothing, it
 * `differs` with no direction known.
 */
export const FIXTURE_TYPE_STANDINGS = [
  "matches",
  "edited",
  "newer",
  "both",
  "gone",
  "differs",
] as const;
export type FixtureTypeStanding = (typeof FIXTURE_TYPE_STANDINGS)[number];

/** The standing of a stored type against the library's version of it; undefined for a type from a file or made here, which has none. */
export function fixtureTypeStanding(
  stored: Pick<StoredFixtureType, "type" | "origin">,
  library: FixtureType | undefined,
): FixtureTypeStanding | undefined {
  const origin = originOf(stored);
  if (origin.from !== "library") return undefined;
  if (library === undefined) return "gone";
  if (sameFixtureType(stored.type, library)) return "matches";
  if (origin.digest === undefined) return "differs";
  const edited = fixtureTypeDigest(stored.type) !== origin.digest;
  const newer = fixtureTypeDigest(library) !== origin.digest;
  if (edited && newer) return "both";
  if (edited) return "edited";
  return newer ? "newer" : "differs";
}

/** Whether taking the library's definition would change the type: any standing but `matches` and `gone`. */
export function canTakeLibrary(
  standing: FixtureTypeStanding | undefined,
): boolean {
  return (
    standing !== undefined && standing !== "matches" && standing !== "gone"
  );
}

/** Each standing in a few words, as the Fixture Editor and the CLI say it. */
export const STANDING_TEXT: Record<FixtureTypeStanding, string> = {
  matches: "Matches the library",
  edited: "Edited here",
  newer: "Library is newer",
  both: "Edited here, and the library is newer",
  gone: "No longer in the library",
  differs: "Differs from the library",
};

/** Where a type came from and, for one from the library, how it stands, in a few words. */
export function originText(
  origin: FixtureTypeOrigin,
  standing: FixtureTypeStanding | undefined,
): string {
  if (origin.from === "installation") return "Made here";
  if (origin.from === "file") return `From ${origin.file}`;
  return standing === undefined ? "From the library" : STANDING_TEXT[standing];
}

/** Why a Fixture Type cannot be removed now, or undefined when it can: a Fixture uses it. */
export function typeRemovalProblem(
  fixtures: Table<Fixture>,
  model: string,
  typeKey: string,
): string | undefined {
  const users = fixturesOfType(fixtures, typeKey);
  const [first] = users;
  if (first === undefined) return undefined;
  return users.length === 1
    ? `${first.name} uses ${model}. Remove it or change its type first.`
    : `${String(users.length)} Fixtures use ${model}. Remove them or change their type first.`;
}
