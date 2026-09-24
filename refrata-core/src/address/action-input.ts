import { z } from "zod";

import {
  AddressValueSchema,
  ChanceSchema,
  type MacroAction,
} from "../document/document.ts";
import type { Document } from "../document/document.ts";
import { generateId } from "../ids.ts";
import { resolveAddress } from "./address.ts";
import { actionProblem } from "./fire.ts";
import { unknownAddress } from "./unknown.ts";

/** A Macro action as a command receives it: without its id; `chance` absent means always. */
export const ActionInputSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("set"),
      address: z.string().min(1),
      value: AddressValueSchema,
      chance: ChanceSchema.optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("toggle"),
      address: z.string().min(1),
      chance: ChanceSchema.optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("trigger"),
      address: z.string().min(1),
      chance: ChanceSchema.optional(),
    })
    .strict(),
]);
export type ActionInput = z.infer<typeof ActionInputSchema>;

/**
 * The actions a command is about to store, each given its id, or why one
 * cannot be: it must resolve and fit its Address now. A Link on the Address
 * is not refused, since the Macro may run after the Link goes, and the
 * inspector marks it meanwhile. An action's Chance is optional and 0 to 1.
 */

export function newActions(
  document: Document,
  inputs: readonly ActionInput[],
): readonly MacroAction[] | { readonly error: string } {
  const added: MacroAction[] = [];
  for (const input of inputs) {
    const action: MacroAction = { ...input, id: generateId("action") };
    const resolved = resolveAddress(document, action.address);
    if (resolved === undefined)
      return { error: unknownAddress(document, action.address) };
    const problem = actionProblem(document, action);
    if (problem !== undefined && !problem.includes("is controlled by"))
      return { error: `${resolved.label}: ${problem}` };
    added.push(action);
  }
  return added;
}
