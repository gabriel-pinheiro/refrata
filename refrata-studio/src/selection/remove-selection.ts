import type { CommandResult } from "@refrata/protocol";
import { useCallback, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { useDocumentCommands } from "@/documents/document-commands";
import { entities, type EntityKind } from "@/entities";
import { showWarnings, useClient } from "@/lib/client";
import { neighbourRow, selectNavigatorRow } from "@/navigator/focus-row";
import { shortcuts } from "@/shortcuts";

import {
  removalPlan,
  removedMessage,
  type RemovalTarget,
} from "./removal-plan";
import { useSelection } from "./selection";

const removalOf = (kind: EntityKind) => entities[kind].removal;

/**
 * Remove for the selection: Edit ▸ Remove and the Delete key. Every selected
 * entity whose kind has a Remove goes by its own command, the one its row's
 * context menu runs, one after another and without asking, since Ctrl+Z
 * brings each back; one that went with an earlier one (an Output with its
 * Universe, a Layer with its Scene) is passed over. A quiet toast says what
 * went, and the row that was next to the first of them is selected. What
 * may not go, such as the active Scene, stays, and its reason is said.
 */
export function useRemoveSelection(): {
  readonly removable: boolean;
  readonly remove: () => void;
} {
  const client = useClient();
  const { view } = useDocumentCommands();
  const { selected, select } = useSelection();
  const subscribe = useCallback(
    (listener: () => void) =>
      view?.revision.subscribe(() => listener()) ?? (() => undefined),
    [view],
  );
  const removable = useSyncExternalStore(
    subscribe,
    () => removalPlan(view?.get(), selected, removalOf).targets.length > 0,
  );
  const remove = useCallback(() => {
    if (view === undefined) return;
    const { targets, refusals } = removalPlan(view.get(), selected, removalOf);
    for (const reason of refusals) toast.message(reason);
    if (targets.length === 0) return;
    const neighbour = neighbourRow(targets.map((target) => target.id));
    void (async () => {
      const removed: RemovalTarget[] = [];
      const warnings: string[] = [];
      try {
        for (const target of targets) {
          const current = view.get();
          if (
            current === undefined ||
            target.removal.find(current, target.id) === undefined
          )
            continue;
          const result = await client.command<CommandResult>(
            view.documentId,
            target.removal.command,
            target.removal.payload(target.id),
          );
          removed.push(target);
          warnings.push(...(result.warnings ?? []));
        }
      } catch (failure) {
        toast.error(
          failure instanceof Error ? failure.message : String(failure),
        );
      }
      if (removed.length === 0) return;
      toast.message(removedMessage(removed, shortcuts.undo.label));
      showWarnings(warnings);
      if (neighbour === undefined) select(undefined);
      else selectNavigatorRow(neighbour);
    })();
  }, [client, view, selected, select]);
  return { removable, remove };
}
