import { elementsOf, type Element } from "../rig/elements.ts";
import {
  footprintOf,
  type FixtureType,
  type Mode,
} from "../rig/fixture-type.ts";
import { placeShape, shapeWidth } from "../rig/shapes.ts";
import { settings } from "../settings.ts";
import type { Document, Table } from "./document.ts";
import { orderedEntries } from "./order.ts";
import {
  ORIGIN,
  type Fixture,
  type PatchedFixture,
  type Position,
} from "./rig.ts";
import { childrenOf, descendantsOf, flattenTree } from "./tree.ts";

/** The rows directly under the root (`parentId` null) or a Group, in order. */
export const childFixtures = (
  fixtures: Table<Fixture>,
  parentId: string | null,
): readonly Fixture[] => childrenOf(fixtures, parentId);

/** Every row in navigator order: depth first from the root. */
export const flattenFixtures = (fixtures: Table<Fixture>): readonly Fixture[] =>
  flattenTree(fixtures);

/** Every row below `fixtureId`, depth first; empty unless it is a Group. */
export const descendantFixtures = (
  fixtures: Table<Fixture>,
  fixtureId: string,
): readonly Fixture[] => descendantsOf(fixtures, fixtureId);

/** The Fixtures (not Groups) in navigator order. */
export function allFixtures(
  fixtures: Table<Fixture>,
): readonly PatchedFixture[] {
  return flattenTree(fixtures).filter(
    (row): row is PatchedFixture => row.kind === "fixture",
  );
}

export function fixtureTypeOf(
  document: Pick<Document, "fixtureTypes">,
  fixture: PatchedFixture,
): FixtureType | undefined {
  return document.fixtureTypes[fixture.typeKey]?.type;
}

export function fixtureModeOf(
  document: Pick<Document, "fixtureTypes">,
  fixture: PatchedFixture,
): Mode | undefined {
  return fixtureTypeOf(document, fixture)?.modes[fixture.modeKey];
}

/** The DMX Addresses a Fixture occupies; 0 when its type is missing. */
export function fixtureFootprint(
  document: Pick<Document, "fixtureTypes">,
  fixture: PatchedFixture,
): number {
  const mode = fixtureModeOf(document, fixture);
  return mode === undefined ? 0 : footprintOf(mode);
}

/** The Elements of a Fixture, derived from its Mode; empty when the type is missing. */
export function fixtureElements(
  document: Pick<Document, "fixtureTypes">,
  fixture: PatchedFixture,
): readonly Element[] {
  const mode = fixtureModeOf(document, fixture);
  return mode === undefined ? [] : elementsOf(mode);
}

/** The Fixtures patched into `universeId`, by address. */
export function patchedIn(
  document: Pick<Document, "fixtures">,
  universeId: string,
): readonly PatchedFixture[] {
  return allFixtures(document.fixtures)
    .filter((fixture) => fixture.patch?.universeId === universeId)
    .sort((a, b) => (a.patch?.address ?? 0) - (b.patch?.address ?? 0));
}

/**
 * The Fixture whose run of addresses in `universeId` overlaps `address`
 * through `address + footprint - 1`, ignoring `except`; undefined when the
 * run is free. Also undefined past the Universe's end: that is a range
 * problem, reported separately.
 */
export function overlapping(
  document: Pick<Document, "fixtures" | "fixtureTypes">,
  universeId: string,
  address: number,
  footprint: number,
  except?: string,
): PatchedFixture | undefined {
  const end = address + footprint - 1;
  return patchedIn(document, universeId).find((other) => {
    if (other.id === except || other.patch === null) return false;
    const otherEnd =
      other.patch.address + fixtureFootprint(document, other) - 1;
    return other.patch.address <= end && address <= otherEnd;
  });
}

/** Why `address` cannot host `footprint` addresses in `universeId`, or undefined when it can. */
export function patchProblem(
  document: Pick<Document, "fixtures" | "fixtureTypes" | "universes">,
  universeId: string,
  address: number,
  footprint: number,
  except?: string,
): string | undefined {
  const universe = document.universes[universeId];
  if (universe === undefined) return `Universe “${universeId}” does not exist.`;
  if (address + footprint - 1 > 512)
    return `${footprint} channels at ${address} run past the end of ${universe.name}.`;
  const collision = overlapping(
    document,
    universeId,
    address,
    footprint,
    except,
  );
  if (collision !== undefined)
    return `Addresses ${address} to ${address + footprint - 1} of ${universe.name} overlap ${collision.name} at ${collision.patch?.address ?? 0}.`;
  return undefined;
}

/** The lowest address in `universeId` where `footprint` addresses are free, or undefined when none is. */
export function nextFreeAddress(
  document: Pick<Document, "fixtures" | "fixtureTypes">,
  universeId: string,
  footprint: number,
): number | undefined {
  let candidate = 1;
  for (const other of patchedIn(document, universeId)) {
    if (other.patch === null) continue;
    if (candidate + footprint - 1 < other.patch.address) break;
    candidate = Math.max(
      candidate,
      other.patch.address + fixtureFootprint(document, other),
    );
  }
  return candidate + footprint - 1 <= 512 ? candidate : undefined;
}

/** The shape width of a Fixture, metres, or a cell when its type is missing. */
export function fixtureWidth(
  document: Pick<Document, "fixtureTypes">,
  fixture: PatchedFixture,
): number {
  const mode = fixtureModeOf(document, fixture);
  if (mode === undefined) return settings.rigView.cellMetres * 2;
  return shapeWidth(placeShape(mode.shape, elementsOf(mode)));
}

/**
 * Where a new Fixture of `width` lands: one gap to the right of the
 * rightmost existing Fixture's shape, on the floor line; the first at the
 * origin.
 */
export function placementFor(
  document: Pick<Document, "fixtures" | "fixtureTypes">,
  width: number,
): Position {
  const existing = allFixtures(document.fixtures);
  if (existing.length === 0) return ORIGIN;
  const rightEdge = Math.max(
    ...existing.map(
      (fixture) => fixture.position.x + fixtureWidth(document, fixture) / 2,
    ),
  );
  return {
    ...ORIGIN,
    x: rightEdge + settings.rigView.placementGapMetres + width / 2,
  };
}

/** Fixtures using a Fixture Type, in navigator order. */
export function fixturesOfType(
  fixtures: Table<Fixture>,
  typeKey: string,
): readonly PatchedFixture[] {
  return allFixtures(fixtures).filter((fixture) => fixture.typeKey === typeKey);
}

/** Universes in display order. */
export function orderedUniverses(document: Pick<Document, "universes">) {
  return orderedEntries(document.universes);
}
