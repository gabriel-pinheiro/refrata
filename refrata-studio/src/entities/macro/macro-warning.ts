import type { Macro, Table } from "@refrata/core";

/** What keeps a Macro from doing anything, as a navigator warning. */
export interface MacroWarning {
  readonly label: string;
  readonly explanation: string;
}

/** The one warning a Macro's row shows: a Macro without actions. Groups get none. */
export function macroWarning(macro: Macro): MacroWarning | undefined {
  if (macro.kind !== "macro" || macro.actions.length > 0) return undefined;
  return {
    label: "No Actions",
    explanation:
      "Running this Macro does nothing until actions are added in its inspector.",
  };
}

/** How many Macro rows would warn: what a collapsed section says. */
export function countMacroWarnings(macros: Table<Macro>): number {
  return Object.values(macros).filter(
    (macro) => macroWarning(macro) !== undefined,
  ).length;
}
