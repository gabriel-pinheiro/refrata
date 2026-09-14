import type { FixtureType } from "../rig/fixture-type.ts";
import type { Document } from "./document.ts";
import { fixturesOfType } from "./fixtures.ts";
import type { Patch } from "./patch.ts";

/**
 * Fixture Types live in the Installation only while a Fixture uses them:
 * a Fixture's create or type change copies the type in, and the last
 * Fixture leaving a type takes the copy with it.
 */

/** The patch copying `type` in when the Installation lacks it, or an error when `typeKey` is not held and no type was supplied. */
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
      value: { id: typeKey, type: supplied },
    },
  ];
}

/** The patch dropping `typeKey` when no Fixture but those in `leaving` uses it. */
export function releaseFixtureType(
  document: Pick<Document, "fixtures" | "fixtureTypes">,
  typeKey: string,
  leaving: ReadonlySet<string>,
): readonly Patch[] {
  if (!(typeKey in document.fixtureTypes)) return [];
  const remaining = fixturesOfType(document.fixtures, typeKey).filter(
    (fixture) => !leaving.has(fixture.id),
  );
  return remaining.length > 0
    ? []
    : [{ op: "remove", path: ["fixtureTypes", typeKey] }];
}
