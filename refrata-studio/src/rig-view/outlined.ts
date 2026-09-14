import type { DocumentView } from "@refrata/client";
import {
  elementRef,
  subtreeOf,
  targetElements,
  type FixtureSet,
  type Layer,
} from "@refrata/core";
import { useMemo } from "react";

import { useDocumentPath, useSignal } from "@/lib/client";
import type { Selection } from "@/selection/selection";

/**
 * The Element refs the Rig View outlines for what is selected: the Targets
 * of a Look Layer (Sets expanded to members, each Element with its subtree)
 * or the members of a Fixture Set. Empty for anything else.
 */
export function useOutlined(
  view: DocumentView,
  selection: Selection | undefined,
): readonly string[] {
  const layer = useDocumentPath<Layer>(view, [
    "layers",
    selection?.kind === "layer" ? selection.id : "",
  ]);
  const set = useDocumentPath<FixtureSet>(view, [
    "fixtureSets",
    selection?.kind === "set" ? selection.id : "",
  ]);
  const document = useSignal(view.document);
  return useMemo(() => {
    if (document === undefined) return [];
    const refs =
      layer?.kind === "look"
        ? layer.targets.map((target) => target.ref)
        : set?.kind === "set"
          ? set.members
          : [];
    const result: string[] = [];
    for (const ref of refs)
      for (const located of targetElements(document, ref))
        for (const element of subtreeOf(located.elements, located.element.key))
          result.push(elementRef(located.fixture.id, element.key));
    return result;
  }, [document, layer, set]);
}
