import { z } from "zod";

import { ActionInputSchema, newActions } from "../address/action-input.ts";
import { accepted, defineCommand, rejected } from "../command/command.ts";

/**
 * Appends actions to a Macro, or inserts them after one of its actions. Any
 * number at once, so a picker that captured fifteen opacities is one
 * command and one undo step. Each action must resolve and fit its Address
 * now. An action's Chance is optional and 0 to 1.
 */
export const macroActionsAdd = defineCommand({
  name: "macro.actions.add",
  kind: "authoring",
  description:
    "Add actions to a Macro: set an Address, toggle a switch or fire a trigger, each with an optional chance (0 to 1).",

  payload: z
    .object({
      macroId: z.string().min(1),
      actions: z.array(ActionInputSchema).min(1),
      /** Action to insert after; null for the top; absent to append. */
      after: z.string().min(1).nullable().optional(),
    })
    .strict(),
  label: ({ actions }) =>
    actions.length === 1
      ? "Add Action"
      : `Add ${String(actions.length)} Actions`,
  apply({ document, payload }) {
    const macro = document.macros[payload.macroId];
    if (macro?.kind !== "macro")
      return rejected(`“${payload.macroId}” is not a Macro.`);
    const added = newActions(document, payload.actions);
    if ("error" in added) return rejected(added.error);
    const at =
      payload.after === undefined
        ? macro.actions.length
        : payload.after === null
          ? 0
          : macro.actions.findIndex((action) => action.id === payload.after) +
            1;
    if (at === 0 && payload.after !== null && payload.after !== undefined)
      return rejected(`Action “${payload.after}” is not in the Macro.`);
    const actions = [
      ...macro.actions.slice(0, at),
      ...added,
      ...macro.actions.slice(at),
    ];
    return accepted([
      { op: "set", path: ["macros", macro.id, "actions"], value: actions },
    ]);
  },
});
