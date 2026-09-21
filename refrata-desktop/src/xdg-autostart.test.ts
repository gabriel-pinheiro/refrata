import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  autostartCommand,
  autostartDirectory,
  autostartEntry,
  XdgAutostart,
} from "./xdg-autostart.ts";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "refrata-autostart-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("XDG autostart", () => {
  it("looks under XDG_CONFIG_HOME, else under ~/.config", () => {
    expect(autostartDirectory({}, "/home/ana")).toBe(
      "/home/ana/.config/autostart",
    );
    expect(autostartDirectory({ XDG_CONFIG_HOME: "" }, "/home/ana")).toBe(
      "/home/ana/.config/autostart",
    );
    expect(autostartDirectory({ XDG_CONFIG_HOME: "/cfg" }, "/home/ana")).toBe(
      "/cfg/autostart",
    );
  });

  it("starts what is running now, with the sandbox switch only when this launch has it", () => {
    expect(
      autostartCommand({
        execPath: "/opt/Refrata/refrata",
        appPath: undefined,
        noSandbox: false,
        noStudio: false,
      }),
    ).toEqual(["/opt/Refrata/refrata"]);
    expect(
      autostartCommand({
        execPath: "/repo/node_modules/electron/dist/electron",
        appPath: "/repo/refrata-desktop",
        noSandbox: true,
        noStudio: true,
      }),
    ).toEqual([
      "/repo/node_modules/electron/dist/electron",
      "/repo/refrata-desktop",
      "--no-sandbox",
      "--no-studio",
    ]);
  });

  it("writes an entry whose Exec is the command, quoted where the format asks", () => {
    expect(
      autostartEntry([
        "/opt/Refrata/refrata",
        "/home/ana/My Shows/app",
        "--no-sandbox",
        "--no-studio",
      ]),
    ).toBe(
      [
        "[Desktop Entry]",
        "Type=Application",
        "Name=Refrata",
        "Comment=Start Refrata Desktop at login",
        'Exec=/opt/Refrata/refrata "/home/ana/My Shows/app" --no-sandbox --no-studio',
        "Terminal=false",
        "",
      ].join("\n"),
    );
    expect(autostartEntry(['/odd/$HOME "50%"'])).toContain(
      'Exec="/odd/\\$HOME \\"50%%\\""',
    );
  });

  it("is enabled while its file is there, and rewrites it on a new command", async () => {
    const autostart = new XdgAutostart(path.join(dir, "autostart"));
    expect(await autostart.enabled()).toBe(false);

    await autostart.enable(["/opt/refrata"]);
    expect(await autostart.enabled()).toBe(true);
    expect(await readdir(path.join(dir, "autostart"))).toEqual([
      "refrata-desktop.desktop",
    ]);

    await autostart.enable(["/opt/refrata", "--no-studio"]);
    expect(
      await readFile(
        path.join(dir, "autostart", "refrata-desktop.desktop"),
        "utf8",
      ),
    ).toContain("Exec=/opt/refrata --no-studio\n");

    await autostart.disable();
    expect(await autostart.enabled()).toBe(false);
    // Removing what is not there is fine.
    await autostart.disable();
  });
});
