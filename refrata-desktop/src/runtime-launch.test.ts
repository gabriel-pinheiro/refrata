import { settings } from "@refrata/core";
import { describe, expect, it } from "vitest";

import {
  runtimeArguments,
  runtimeEnvironment,
  runtimeLocations,
  runtimePort,
  unpackedPath,
} from "./runtime-launch.ts";

const locations = runtimeLocations("/app/dist");

describe("runtime launch", () => {
  it("reads Studio and the library from beside a packaged app's asar, and the script from inside it", () => {
    expect(runtimeLocations("/opt/Refrata/resources/app.asar/dist")).toEqual({
      script: "/opt/Refrata/resources/app.asar/dist/runtime.mjs",
      studioDist: "/opt/Refrata/resources/app.asar.unpacked/dist/studio",
      libraryDir: "/opt/Refrata/resources/app.asar.unpacked/dist/library",
    });
    expect(locations.studioDist).toBe("/app/dist/studio");
    expect(unpackedPath("/shows/my.asarchive/dist")).toBe(
      "/shows/my.asarchive/dist",
    );
    expect(unpackedPath("C:\\Refrata\\resources\\app.asar\\dist")).toBe(
      "C:\\Refrata\\resources\\app.asar.unpacked\\dist",
    );
  });

  it("starts free on every interface, with the file last when there is one", () => {
    expect(runtimeArguments({ port: 4900, file: undefined })).toEqual([
      "--documents",
      "free",
      "--host",
      "0.0.0.0",
      "--port",
      "4900",
    ]);
    expect(
      runtimeArguments({ port: 4911, file: "/shows/a.refrata" }).slice(-3),
    ).toEqual(["--port", "4911", "/shows/a.refrata"]);
  });

  it("takes its port from REFRATA_PORT when that is a port", () => {
    expect(runtimePort({})).toBe(settings.runtime.port);
    expect(runtimePort({ REFRATA_PORT: "4911" })).toBe(4911);
    expect(runtimePort({ REFRATA_PORT: "" })).toBe(settings.runtime.port);
    expect(runtimePort({ REFRATA_PORT: "show" })).toBe(settings.runtime.port);
    expect(runtimePort({ REFRATA_PORT: "70000" })).toBe(settings.runtime.port);
  });

  it("points the runtime at the built pieces next to main.js", () => {
    expect(locations.script).toBe("/app/dist/runtime.mjs");
    expect(runtimeEnvironment({}, locations)).toEqual({
      REFRATA_STUDIO_DIST: "/app/dist/studio",
      REFRATA_LIBRARY_DIR: "/app/dist/library",
    });
  });

  it("inherits the environment but not the file, host and port, nor a location", () => {
    const env = runtimeEnvironment(
      {
        PATH: "/usr/bin",
        REFRATA_NO_OSC: "1",
        REFRATA_FILE: "/shows/other.refrata",
        REFRATA_HOST: "127.0.0.1",
        REFRATA_PORT: "4911",
        REFRATA_STUDIO_DIST: "/elsewhere",
        UNSET: undefined,
      },
      locations,
    );
    expect(env).toMatchObject({ PATH: "/usr/bin", REFRATA_NO_OSC: "1" });
    expect(env.REFRATA_STUDIO_DIST).toBe("/app/dist/studio");
    for (const gone of ["REFRATA_FILE", "REFRATA_HOST", "REFRATA_PORT"])
      expect(env).not.toHaveProperty(gone);
    expect(env).not.toHaveProperty("UNSET");
  });

  it("keeps a Fixture Library folder of the person's own", () => {
    expect(
      runtimeEnvironment(
        { REFRATA_LIBRARY_DIR: "/home/me/fixtures" },
        locations,
      ).REFRATA_LIBRARY_DIR,
    ).toBe("/home/me/fixtures");
    expect(
      runtimeEnvironment({ REFRATA_LIBRARY_DIR: "" }, locations)
        .REFRATA_LIBRARY_DIR,
    ).toBe("/app/dist/library");
  });
});
