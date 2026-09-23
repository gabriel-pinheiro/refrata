import { describe, expect, it } from "vitest";

import {
  columnsFor,
  freeSummary,
  labelSpan,
  rowStart,
} from "./universe-layout";

describe("universe layout", () => {
  it("picks the most columns that keep a cell wide enough", () => {
    expect(columnsFor(1400, 40)).toBe(32);
    expect(columnsFor(1279, 40)).toBe(16);
    expect(columnsFor(639, 40)).toBe(8);
    expect(columnsFor(100, 40)).toBe(8);
  });

  it("knows where a row starts", () => {
    expect(rowStart(1, 16)).toBe(1);
    expect(rowStart(16, 16)).toBe(1);
    expect(rowStart(17, 16)).toBe(17);
    expect(rowStart(512, 32)).toBe(481);
  });

  it("draws a name on a run's first cell and where it wraps", () => {
    // A 10-address run from 12 to 21 in rows of 16: row 1 holds 12 to 16, row 2 holds 17 to 21.
    expect(labelSpan(12, 12, 21, 16)).toBe(5);
    expect(labelSpan(13, 12, 21, 16)).toBe(0);
    expect(labelSpan(17, 12, 21, 16)).toBe(5);
    expect(labelSpan(3, 3, 5, 16)).toBe(3);
  });

  it("counts free addresses and the longest free run", () => {
    expect(
      freeSummary([
        { start: 1, end: 3, fixture: undefined },
        { start: 4, end: 6, fixture: {} },
        { start: 7, end: 512, fixture: undefined },
      ]),
    ).toEqual({ free: 509, longest: 506, longestAt: 7 });
    expect(freeSummary([{ start: 1, end: 512, fixture: {} }])).toEqual({
      free: 0,
      longest: 0,
      longestAt: undefined,
    });
  });
});
