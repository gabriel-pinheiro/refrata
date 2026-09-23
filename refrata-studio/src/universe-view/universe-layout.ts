import { UNIVERSE_SIZE } from "@refrata/core";

/** Cells per row the grid may use: rows always start on a round address. */
export const COLUMN_CHOICES = [32, 16, 8] as const;
export type Columns = (typeof COLUMN_CHOICES)[number];

/** The most cells per row that still leaves each at least `minCellPx` wide; 8 when even that does not fit. */
export function columnsFor(widthPx: number, minCellPx: number): Columns {
  return COLUMN_CHOICES.find((columns) => columns * minCellPx <= widthPx) ?? 8;
}

/** The first address of the row holding `address`. */
export function rowStart(address: number, columns: Columns): number {
  return Math.floor((address - 1) / columns) * columns + 1;
}

/**
 * How many cells a Fixture's name may run over from `address`: to the end
 * of the Fixture's run or of the row, whichever comes first. Zero when the
 * name does not belong on this cell: it is drawn on a run's first address
 * and again on the first cell of each row the run continues into.
 */
export function labelSpan(
  address: number,
  start: number,
  end: number,
  columns: Columns,
): number {
  if (address !== start && address !== rowStart(address, columns)) return 0;
  const rowEnd = Math.min(rowStart(address, columns) + columns - 1, end);
  return rowEnd - address + 1;
}

/** Free addresses in a Universe, and its longest free run, from the runs of `universeRuns`. */
export function freeSummary(
  runs: readonly { start: number; end: number; fixture: unknown }[],
): { free: number; longest: number; longestAt: number | undefined } {
  let free = 0;
  let longest = 0;
  let longestAt: number | undefined;
  for (const run of runs) {
    if (run.fixture !== undefined) continue;
    const length = run.end - run.start + 1;
    free += length;
    if (length > longest) {
      longest = length;
      longestAt = run.start;
    }
  }
  return { free: Math.min(free, UNIVERSE_SIZE), longest, longestAt };
}
