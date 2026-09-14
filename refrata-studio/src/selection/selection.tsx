import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { EntityKind } from "@/entities";

/** What the inspector shows: the Installation itself, or one entity by kind and id. */
export type Selection =
  | { readonly kind: "installation" }
  | { readonly kind: EntityKind; readonly id: string };

export type PickMode = "replace" | "add" | "toggle";

interface SelectionState {
  /** `undefined` when nothing is selected; the inspector then shows its empty state. */
  readonly selection: Selection | undefined;
  readonly select: (next: Selection | undefined) => void;
  /**
   * The glossary's Selection: the ordered Element refs picked in the Rig
   * View or the navigator, what "New Set from selection" and "Add
   * selection" read. Selecting a Layer or a Controller leaves it alone.
   */
  readonly picked: readonly string[];
  readonly pick: (refs: readonly string[], mode: PickMode) => void;
}

const Context = createContext<SelectionState | undefined>(undefined);

/** Studio-local, never sent to the runtime. Mount with a `key` per document so it resets. */
export function SelectionProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [selection, setSelection] = useState<Selection | undefined>(undefined);
  const [picked, setPicked] = useState<readonly string[]>([]);
  const select = useCallback((next: Selection | undefined) => {
    setSelection(next);
    if (next === undefined) setPicked([]);
  }, []);
  const pick = useCallback((refs: readonly string[], mode: PickMode) => {
    setPicked((previous) => pickRefs(previous, refs, mode));
  }, []);
  const state = useMemo(
    () => ({ selection, select, picked, pick }),
    [selection, select, picked, pick],
  );
  return <Context.Provider value={state}>{children}</Context.Provider>;
}

/** The next picked list: replaced, extended, or with each ref flipped in or out. */
export function pickRefs(
  previous: readonly string[],
  refs: readonly string[],
  mode: PickMode,
): readonly string[] {
  if (mode === "replace") return [...new Set(refs)];
  if (mode === "add")
    return [...previous, ...refs.filter((ref) => !previous.includes(ref))];
  const flipped = previous.filter((ref) => !refs.includes(ref));
  return [...flipped, ...refs.filter((ref) => !previous.includes(ref))];
}

/** The pick mode a click's modifiers ask for: shift extends, ctrl or cmd toggles. */
export function pickModeOf(
  event: Pick<React.MouseEvent, "shiftKey" | "ctrlKey" | "metaKey"> | undefined,
): PickMode {
  if (event === undefined) return "replace";
  if (event.shiftKey) return "add";
  if (event.ctrlKey || event.metaKey) return "toggle";
  return "replace";
}

export function useSelection(): SelectionState {
  const state = useContext(Context);
  if (state === undefined)
    throw new Error("useSelection needs a SelectionProvider.");
  return state;
}

/** The selection state when a provider is above, else undefined: for chrome that also shows without an Installation. */
export function useSelectionIfAny(): SelectionState | undefined {
  return useContext(Context);
}

export function isSelected(
  selection: Selection | undefined,
  kind: EntityKind,
  id: string,
): boolean {
  return selection?.kind === kind && selection.id === id;
}

/**
 * Click handler for a panel background: clears the selection unless the click
 * landed on something interactive (a row, a card, a button).
 */
export function deselectOnBackgroundClick(
  select: (next: undefined) => void,
): (event: React.MouseEvent<HTMLElement>) => void {
  return (event) => {
    const target = event.target as HTMLElement;
    // Dialogs are portaled but their React events still bubble here.
    if (
      target.closest("button, a, article, input, label, [role=dialog]") === null
    )
      select(undefined);
  };
}
