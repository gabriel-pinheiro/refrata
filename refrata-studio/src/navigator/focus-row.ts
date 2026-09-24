import { neighbourAfterRemoval, type VisibleRow } from "./row-navigation";

/**
 * Keyboard focus and selection for navigator rows, found by the
 * `data-navigator-row` attribute NavigatorRow puts on its selecting button,
 * with the row's depth and, for a row that opens, whether it is open beside
 * it.
 */

function rowButton(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[data-navigator-row="${CSS.escape(id)}"]`,
  );
}

/** The rows `buttons` stand for, in the order given. */
export function visibleRows(buttons: readonly HTMLElement[]): VisibleRow[] {
  return buttons.map((button) => ({
    id: button.dataset.navigatorRow ?? "",
    depth: Number(button.dataset.navigatorDepth),
    expanded:
      button.dataset.navigatorExpanded === undefined
        ? undefined
        : button.dataset.navigatorExpanded === "true",
  }));
}

/**
 * The row to select once the rows for `ids` are gone, read before removing
 * them: within the section of the first of them, the next row not inside
 * one that goes, else the one above.
 */
export function neighbourRow(ids: readonly string[]): string | undefined {
  const wanted = new Set(ids);
  const first = [
    ...document.querySelectorAll<HTMLElement>("[data-navigator-row]"),
  ].find((button) => wanted.has(button.dataset.navigatorRow ?? ""));
  const section = first?.closest("section");
  if (section === null || section === undefined) return undefined;
  const rows = [
    ...section.querySelectorAll<HTMLElement>("[data-navigator-row]"),
  ];
  return neighbourAfterRemoval(visibleRows(rows), wanted);
}

/**
 * Selects the row for `id` after the next paint, as a plain click on it
 * would, replacing the selection, and keeps keyboard focus on it.
 */
export function selectNavigatorRow(id: string): void {
  requestAnimationFrame(() => {
    const row = rowButton(id);
    row?.click();
    row?.focus();
  });
}
