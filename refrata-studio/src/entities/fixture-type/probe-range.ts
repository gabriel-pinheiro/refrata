import {
  allFixtures,
  type ChannelRow,
  type Fixture,
  type PatchedFixture,
  type Table,
  type Tester,
} from "@refrata/core";

/**
 * The facts of the probe that need no Studio: which Fixtures it can aim
 * at, whether the DMX Tester's range is one Fixture's, and what a held
 * range says each Channel is at.
 */

/** The Fixtures a probe can aim at: the patched ones of the type that are on the Mode. */
export function probeFixtures(
  fixtures: Table<Fixture>,
  typeKey: string,
  modeKey: string,
): readonly PatchedFixture[] {
  return allFixtures(fixtures).filter(
    (fixture) =>
      fixture.typeKey === typeKey &&
      fixture.modeKey === modeKey &&
      fixture.patch !== null,
  );
}

/** Whether the tester holds exactly the range a Fixture of `footprint` addresses takes. */
export function holdsFixture(
  tester: Tester | null | undefined,
  fixture: PatchedFixture | undefined,
  footprint: number,
): boolean {
  const patch = fixture?.patch;
  if (tester == null || patch == null) return false;
  return (
    tester.universeId === patch.universeId &&
    tester.address === patch.address &&
    tester.values.length === footprint
  );
}

/** The held value of each Channel by key, over its whole width, most significant byte first; a released address counts as 0. */
export function heldValues(
  rows: readonly ChannelRow[],
  tester: Tester,
): Record<string, number> {
  const values: Record<string, number> = {};
  for (const row of rows) {
    let value = 0;
    for (let index = 0; index < row.bytes; index += 1)
      value = value * 256 + (tester.values[row.address - 1 + index] ?? 0);
    values[row.key] = value;
  }
  return values;
}
