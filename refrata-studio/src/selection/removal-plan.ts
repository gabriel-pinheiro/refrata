import type { Document } from "@refrata/core";

import type { EntityKind, Removal } from "@/entities";

import type { Selection } from "./selection";

/** One selected entity that Remove takes away. */
export interface RemovalTarget {
  readonly kind: EntityKind;
  readonly id: string;
  readonly name: string;
  readonly removal: Removal;
}

/**
 * What Remove does with the selection: the entities it takes away, in
 * selection order, and the reasons it leaves others, such as the active
 * Scene's. The Installation, an Element and anything already gone are
 * passed over without a word.
 */
export interface RemovalPlan {
  readonly targets: readonly RemovalTarget[];
  readonly refusals: readonly string[];
}

export function removalPlan(
  document: Document | undefined,
  selected: readonly Selection[],
  removalOf: (kind: EntityKind) => Removal | undefined,
): RemovalPlan {
  const targets: RemovalTarget[] = [];
  const refusals: string[] = [];
  if (document === undefined) return { targets, refusals };
  for (const item of selected) {
    if (item.kind === "installation") continue;
    const removal = removalOf(item.kind);
    const entity = removal?.find(document, item.id);
    if (removal === undefined || entity === undefined) continue;
    const reason = removal.refusal?.(document, item.id);
    if (reason !== undefined) {
      if (!refusals.includes(reason)) refusals.push(reason);
      continue;
    }
    targets.push({ kind: item.kind, id: item.id, name: entity.name, removal });
  }
  return { targets, refusals };
}

/**
 * What a toast says once `removed` are gone: the one by name, several
 * counted by kind, in the order the kinds were selected.
 */
export function removedMessage(
  removed: readonly RemovalTarget[],
  undoLabel: string,
): string {
  const [only] = removed;
  if (only !== undefined && removed.length === 1)
    return `Removed ${only.removal.noun} “${only.name}”. ${undoLabel} undoes.`;
  const counts = new Map<string, number>();
  for (const { removal } of removed)
    counts.set(removal.noun, (counts.get(removal.noun) ?? 0) + 1);
  const parts = [...counts].map(
    ([noun, count]) => `${String(count)} ${noun}${count === 1 ? "" : "s"}`,
  );
  const listed =
    parts.length === 1
      ? parts.join("")
      : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1) ?? ""}`;
  return `Removed ${listed}. ${undoLabel} undoes them one at a time.`;
}
