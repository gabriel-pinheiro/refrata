import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  autostartCommand,
  autostartDirectory,
  autostartEntry,
  runningAppImage,
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
        appImage: undefined,
        noSandbox: false,
        noStudio: false,
      }),
    ).toEqual(["/opt/Refrata/refrata"]);
    expect(
      autostartCommand({
        execPath: "/repo/node_modules/electron/dist/electron",
        appPath: "/repo/refrata-desktop",
        appImage: undefined,
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

  it("starts an AppImage from its file, without the sandbox switch its launcher decides on", () => {
    // Inside the AppImage the executable sits in a mount of this run, and the
    // launcher added --no-sandbox because this kernel keeps the sandbox out.
    expect(
      autostartCommand({
        execPath: "/tmp/.mount_RefratXYZ/refrata",
        appPath: undefined,
        appImage: "/home/ana/Apps/Refrata-1.0.0-x86_64.AppImage",
        noSandbox: true,
        noStudio: true,
      }),
    ).toEqual(["/home/ana/Apps/Refrata-1.0.0-x86_64.AppImage", "--no-studio"]);
    expect(
      autostartEntry([
        "/home/ana/My Apps/Refrata-1.0.0-x86_64.AppImage",
        "--no-studio",
      ]),
    ).toContain(
      'Exec="/home/ana/My Apps/Refrata-1.0.0-x86_64.AppImage" --no-studio\n',
    );
  });

  it("takes the AppImage from APPIMAGE only in a packaged run", () => {
    const env = { APPIMAGE: "/home/ana/Refrata.AppImage" };
    expect(runningAppImage(env, true)).toBe("/home/ana/Refrata.AppImage");
    expect(runningAppImage(env, false)).toBeUndefined();
    expect(runningAppImage({ APPIMAGE: "" }, true)).toBeUndefined();
    expect(runningAppImage({}, true)).toBeUndefined();
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
