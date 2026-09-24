import { describe, expect, it } from "vitest";

import { documentLine } from "./status.ts";

const summary = {
  id: "doc",
  name: "Club",
  path: "/shows/club.refrata",
  dirty: false,
  recovered: false,
  revision: 12,
};

describe("documentLine", () => {
  it("names the file, says once when there are unsaved changes, and says when there is no file", () => {
    expect(documentLine(summary)).toBe(
      "Club  doc  /shows/club.refrata  revision 12",
    );
    expect(documentLine({ ...summary, dirty: true })).toBe(
      "Club  doc  /shows/club.refrata  unsaved changes  revision 12",
    );
    expect(documentLine({ ...summary, path: null, dirty: true })).toBe(
      "Club  doc  (no file)  unsaved changes  revision 12",
    );
  });
});
