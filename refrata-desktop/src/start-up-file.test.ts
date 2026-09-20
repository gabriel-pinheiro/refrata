import path from "node:path";
import { describe, expect, it } from "vitest";

import { documentFileFromArgv, startUpFile } from "./start-up-file.ts";

describe("document file from argv", () => {
  it("finds the .refrata file among switches, wherever it sits", () => {
    expect(
      documentFileFromArgv(["/opt/Refrata/refrata", "/shows/a.refrata"], "/"),
    ).toBe("/shows/a.refrata");
    // Development: electron, the app folder, then the file.
    expect(
      documentFileFromArgv(["electron", ".", "/shows/a.refrata"], "/"),
    ).toBe("/shows/a.refrata");
    // A second launch arrives with Chromium's own switches mixed in.
    expect(
      documentFileFromArgv(
        ["refrata", "--allow-file-access", "/shows/A.REFRATA", "--enable"],
        "/",
      ),
    ).toBe("/shows/A.REFRATA");
  });

  it("resolves a relative path against the launch directory", () => {
    expect(documentFileFromArgv(["refrata", "b.refrata"], "/shows")).toBe(
      path.resolve("/shows", "b.refrata"),
    );
  });

  it("is undefined without one, and never the executable itself", () => {
    expect(documentFileFromArgv(["refrata"], "/")).toBeUndefined();
    expect(documentFileFromArgv(["refrata", ".", "--x"], "/")).toBeUndefined();
    expect(
      documentFileFromArgv(["/apps/my.refrata", "--flag=a.refrata"], "/"),
    ).toBeUndefined();
  });
});

describe("start-up file", () => {
  const exists = (present: boolean) => () => Promise.resolve(present);

  it("prefers the requested file, even a missing one", async () => {
    expect(
      await startUpFile({
        requested: "/a.refrata",
        last: "/b.refrata",
        exists: exists(false),
      }),
    ).toBe("/a.refrata");
  });

  it("falls back to the last file only while it exists", async () => {
    const options = { requested: undefined, last: "/b.refrata" };
    expect(await startUpFile({ ...options, exists: exists(true) })).toBe(
      "/b.refrata",
    );
    expect(
      await startUpFile({ ...options, exists: exists(false) }),
    ).toBeUndefined();
    expect(
      await startUpFile({
        requested: undefined,
        last: undefined,
        exists: exists(true),
      }),
    ).toBeUndefined();
  });
});
