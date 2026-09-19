import type { DocumentView } from "@refrata/client";
import { elementRef, setMembers, targetElements } from "@refrata/core";
import { useMemo } from "react";

import { useSignal } from "@/lib/client";
import type { Selection } from "@/selection/selection";

/**
 * The Element refs the Rig View outlines for what is selected: the Targets
 * of every selected Look Layer (Sets expanded to members) and the members
 * of every selected Fixture Set. Each ref is one Element; the shape draws
 * its subtree as one box.
 */
export function useOutlined(
  view: DocumentView,
  selected: readonly Selection[],
): readonly string[] {
  const document = useSignal(view.document);
  return useMemo(() => {
    if (document === undefined) return [];
    const refs: string[] = [];
    for (const item of selected) {
      if (item.kind === "layer") {
        const layer = document.layers[item.id];
        if (layer?.kind === "look")
          refs.push(...layer.targets.map((target) => target.ref));
      } else if (item.kind === "set") {
        const set = document.fixtureSets[item.id];
        if (set?.kind === "set") refs.push(...setMembers(document, set));
      }
    }
    const result: string[] = [];
    for (const ref of refs)
      for (const located of targetElements(document, ref))
        result.push(elementRef(located.fixture.id, located.element.key));
    return result;
  }, [document, selected]);
}
