import path from "node:path";
import { describe, expect, it } from "vitest";

import { configFromEnvironment } from "./config.ts";

describe("runtime config", () => {
  it("is pinned by default and takes its file from the argument or REFRATA_FILE", () => {
    expect(configFromEnvironment(["show.refrata"], {})).toMatchObject({
      documents: "pinned",
      openPath: path.resolve("show.refrata"),
    });
    expect(
      configFromEnvironment([], { REFRATA_FILE: "/shows/env.refrata" }),
    ).toMatchObject({ documents: "pinned", openPath: "/shows/env.refrata" });
    // The argument wins.
    expect(
      configFromEnvironment(["/shows/arg.refrata"], {
        REFRATA_FILE: "/shows/env.refrata",
      }).openPath,
    ).toBe("/shows/arg.refrata");
  });

  it("refuses to start pinned without a file", () => {
    expect(() => configFromEnvironment([], {})).toThrow(/REFRATA_FILE/);
    expect(() => configFromEnvironment([], { REFRATA_FILE: "" })).toThrow(
      /REFRATA_FILE/,
    );
  });

  it("starts free with or without a file", () => {
    expect(configFromEnvironment(["--documents", "free"], {})).toMatchObject({
      documents: "free",
      openPath: undefined,
    });
    expect(
      configFromEnvironment(["--documents", "free", "/shows/a.refrata"], {})
        .openPath,
    ).toBe("/shows/a.refrata");
  });

  it("rejects an unknown mode and a second file", () => {
    expect(() => configFromEnvironment(["--documents", "open"], {})).toThrow(
      /pinned.*free/,
    );
    expect(() => configFromEnvironment(["a.refrata", "b.refrata"], {})).toThrow(
      /at most one/,
    );
  });
});
