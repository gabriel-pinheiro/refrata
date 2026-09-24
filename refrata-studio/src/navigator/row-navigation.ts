/** A mounted navigator row, in display order. `expanded` is undefined for a row that cannot open. */
export interface VisibleRow {
  readonly id: string;
  readonly depth: number;
  readonly expanded?: boolean | undefined;
}

/** What an arrow key does: select a row, or open or close one. */
export type RowStep =
  | { readonly select: string }
  | { readonly toggle: string; readonly open: boolean }
  | undefined;

export type RowArrow = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

/**
 * Arrow keys over the navigator, as in a code editor's file tree. Up and Down
 * go to the previous and next row; Left closes an open row, else goes to its
 * parent; Right opens a closed row, else goes to its first child. With no
 * current row, Down starts at the first row and Up at the last.
 */
export function arrowStep(
  rows: readonly VisibleRow[],
  currentId: string | undefined,
  key: RowArrow,
): RowStep {
  const index = rows.findIndex((row) => row.id === currentId);
  const current = rows[index];
  const select = (row: VisibleRow | undefined): RowStep =>
    row === undefined ? undefined : { select: row.id };
  if (current === undefined) {
    if (key === "ArrowDown") return select(rows[0]);
    if (key === "ArrowUp") return select(rows.at(-1));
    return undefined;
  }
  switch (key) {
    case "ArrowUp":
      return select(rows[index - 1]);
    case "ArrowDown":
      return select(rows[index + 1]);
    case "ArrowLeft":
      if (current.expanded === true) return { toggle: current.id, open: false };
      return select(
        rows.slice(0, index).findLast((row) => row.depth < current.depth),
      );
    case "ArrowRight": {
      if (current.expanded === false) return { toggle: current.id, open: true };
      if (current.expanded === undefined) return undefined;
      const next = rows[index + 1];
      return next !== undefined && next.depth > current.depth
        ? select(next)
        : undefined;
    }
  }
}

/**
 * The row to select once the rows in `removed` are gone, read before
 * removing them: after the first of them, the next row that is neither
 * removed nor inside a removed row and not deeper than it, else the row
 * above it.
 */
export function neighbourAfterRemoval(
  rows: readonly VisibleRow[],
  removed: ReadonlySet<string>,
): string | undefined {
  const gone = new Set<string>();
  let cutoff: number | undefined;
  for (const row of rows) {
    if (cutoff !== undefined && row.depth > cutoff) {
      gone.add(row.id);
      continue;
    }
    cutoff = undefined;
    if (removed.has(row.id)) {
      gone.add(row.id);
      cutoff = row.depth;
    }
  }
  const first = rows.findIndex((row) => removed.has(row.id));
  const own = rows[first];
  if (own === undefined) return undefined;
  const after = rows
    .slice(first + 1)
    .find((row) => !gone.has(row.id) && row.depth <= own.depth);
  return (after ?? rows[first - 1])?.id;
}
