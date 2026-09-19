import type { DocumentView } from "@refrata/client";
import { generateId } from "@refrata/core";
import { useCallback } from "react";
import { toast } from "sonner";

import { useCommand } from "@/lib/client";
import { useSelection } from "@/selection/selection";

/**
 * Makes a Macro holding one trigger action, which is what a hub's button
 * needs to play a Scene or fire a Cue. The person stays where they are; a
 * toast names the Macro and offers to show it.
 */
export function useMakeMacro(
  view: DocumentView,
): (name: string, address: string) => void {
  const command = useCommand(view);
  const { select } = useSelection();
  return useCallback(
    (name, address) => {
      const id = generateId("macro");
      void command("macro.create", {
        id,
        name,
        actions: [{ kind: "trigger", address }],
      }).then(() => {
        const made = view.document.get()?.macros[id];
        if (made === undefined) return;
        toast.success(`Made the Macro “${made.name}”`, {
          action: {
            label: "Show",
            onClick: () => select({ kind: "macro", id }),
          },
        });
      });
    },
    [command, select, view],
  );
}
