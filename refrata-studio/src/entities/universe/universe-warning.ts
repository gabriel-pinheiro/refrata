import type { Output, Table, Universe } from "@refrata/core";

/** What keeps a Universe from reaching a fixture, as a navigator warning. */
export interface UniverseWarning {
  readonly label: string;
  readonly explanation: string;
}

/** The one warning a Universe's row shows: no Output delivers it. */
export function universeWarning(
  universe: Universe,
  outputs: Table<Output>,
): UniverseWarning | undefined {
  if (
    Object.values(outputs).some((output) => output.universeId === universe.id)
  )
    return undefined;
  return {
    label: "No Output",
    explanation:
      "This Universe reaches no fixture until an Output is added to it with the + on its row.",
  };
}

/** How many Universe rows would warn: what a collapsed section says. */
export function countUniverseWarnings(
  universes: Table<Universe>,
  outputs: Table<Output>,
): number {
  return Object.values(universes).filter(
    (universe) => universeWarning(universe, outputs) !== undefined,
  ).length;
}
