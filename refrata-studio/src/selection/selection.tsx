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

/** One selected thing: the Installation itself, or one entity by kind and id. */
export type Selection =
  | { readonly kind: "installation" }
  | { readonly kind: EntityKind; readonly id: string };

export type PickMode = "replace" | "add" | "toggle";

interface SelectionState {
  /**
   * The glossary's Selection: the ordered list of what is selected, in the
   * order it was clicked. Empty when nothing is; the inspector then shows
   * its empty state. One item shows that item's inspector; several show
   * the selection inspector, which offers what can be done with them all.
   */
  readonly selected: readonly Selection[];
  /** Replaces the selection (the default), extends it, or flips each item in or out. */
  readonly select: (
    next: Selection | readonly Selection[] | undefined,
    mode?: PickMode,
  ) => void;
}

const Context = createContext<SelectionState | undefined>(undefined);

/** The empty selection, one array so it compares equal to itself. */
const none: readonly Selection[] = [];

/**
 * Studio-local, never sent to the runtime. Held above the menu, which removes
 * the selection, and empty again whenever `documentId` changes.
 */
export function SelectionProvider({
  documentId,
  children,
}: {
  readonly documentId: string | undefined;
  readonly children: ReactNode;
}) {
  const [held, setHeld] = useState<{
    readonly documentId: string | undefined;
    readonly selected: readonly Selection[];
  }>({ documentId, selected: [] });
  const selected = held.documentId === documentId ? held.selected : none;
  const select = useCallback(
    (
      next: Selection | readonly Selection[] | undefined,
      mode: PickMode = "replace",
    ) => {
      const items =
        next === undefined ? [] : Array.isArray(next) ? next : [next];
      setHeld((previous) => ({
        documentId,
        selected: pickItems(
          previous.documentId === documentId ? previous.selected : none,
          items as readonly Selection[],
          mode,
        ),
      }));
    },
    [documentId],
  );
  const state = useMemo(() => ({ selected, select }), [selected, select]);
  return <Context.Provider value={state}>{children}</Context.Provider>;
}

/** The key two selections compare by. */
export function selectionKey(item: Selection): string {
  return item.kind === "installation"
    ? "installation"
    : `${item.kind}:${item.id}`;
}

/** The next selection: replaced, extended, or with each item flipped in or out. Never holds an item twice. */
export function pickItems(
  previous: readonly Selection[],
  items: readonly Selection[],
  mode: PickMode,
): readonly Selection[] {
  const keys = new Set(items.map(selectionKey));
  const fresh = items.filter(
    (item, index) =>
      items.findIndex((other) => selectionKey(other) === selectionKey(item)) ===
      index,
  );
  if (mode === "replace") return fresh;
  const kept = new Set(previous.map(selectionKey));
  if (mode === "add")
    return [
      ...previous,
      ...fresh.filter((item) => !kept.has(selectionKey(item))),
    ];
  return [
    ...previous.filter((item) => !keys.has(selectionKey(item))),
    ...fresh.filter((item) => !kept.has(selectionKey(item))),
  ];
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
  selected: readonly Selection[],
  kind: EntityKind | "installation",
  id?: string,
): boolean {
  return selected.some(
    (item) =>
      item.kind === kind && (item.kind === "installation" || item.id === id),
  );
}

/** The one selected item when exactly one is, else undefined. */
export function soleSelection(
  selected: readonly Selection[],
): Selection | undefined {
  return selected.length === 1 ? selected[0] : undefined;
}

/** The id of the one selected item when it is of `kind`, for lists that outline their selected row. */
export function soleId(
  selected: readonly Selection[],
  kind: EntityKind,
): string | undefined {
  const only = soleSelection(selected);
  return only?.kind === kind ? only.id : undefined;
}

/** The ids of every selected item of `kind`, in selection order. */
export function selectedIds(
  selected: readonly Selection[],
  kind: EntityKind,
): readonly string[] {
  return selected.flatMap((item) => (item.kind === kind ? [item.id] : []));
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
