import { fixtureRootRef, setRef, type Document } from "@refrata/core";

import type { Selection } from "./selection";

/**
 * What a selection stands for as Targets or Set members. A Fixture is its
 * root Element, an Element itself, a Fixture Set its `set:` ref. Anything
 * else in the selection (a Fixture Group, a Layer, a Controller) means the
 * selection is not one of things that can be targeted, and the result is
 * undefined.
 */
export function selectedTargets(
  document: Pick<Document, "fixtures" | "fixtureSets">,
  selected: readonly Selection[],
): readonly string[] | undefined {
  const refs: string[] = [];
  for (const item of selected) {
    if (item.kind === "fixture") {
      if (document.fixtures[item.id]?.kind !== "fixture") return undefined;
      refs.push(fixtureRootRef(item.id));
    } else if (item.kind === "element") refs.push(item.id);
    else if (item.kind === "set") {
      if (document.fixtureSets[item.id]?.kind !== "set") return undefined;
      refs.push(setRef(item.id));
    } else return undefined;
  }
  return refs.length === 0 ? undefined : refs;
}

/** The selected Element refs a Set could hold: as `selectedTargets`, but a Set in the selection disqualifies it. */
export function selectedMembers(
  document: Pick<Document, "fixtures" | "fixtureSets">,
  selected: readonly Selection[],
): readonly string[] | undefined {
  if (selected.some((item) => item.kind === "set")) return undefined;
  return selectedTargets(document, selected);
}

/** The Element refs the Rig View draws as picked: Fixtures as their root, Elements as themselves. */
export function pickedRefs(selected: readonly Selection[]): readonly string[] {
  return selected.flatMap((item) =>
    item.kind === "fixture"
      ? [fixtureRootRef(item.id)]
      : item.kind === "element"
        ? [item.id]
        : [],
  );
}
