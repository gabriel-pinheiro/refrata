import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  app,
  clickMenu,
  commandFromElsewhere,
  dir,
  env,
  eventually,
  installationFile,
  launch,
  launchWithoutStudio,
  packaged,
  packagedExecutable,
  quit,
  renameFromElsewhere,
  secondLaunch,
  studioTitle,
  userData,
  windowAfter,
  useDesktop,
} from "./harness.ts";
import {
  answerDialogs,
  askedDialogs,
  health,
  menuChecked,
  openInstallation,
  openInstallationName,
  outputStates,
  runtimeChildPid,
  windowCount,
} from "./running-app.ts";

useDesktop();

/**
 * An Output no test run can open: its widget is named by a serial number
 * that no device has, so the runtime looks for it, finds nothing and reports
 * `device-missing`. Nothing here ever reaches real DMX hardware.
 */
const ABSENT_WIDGET = {
  id: "absent",
  kind: "enttec-usb-pro",
  device: "refrata-e2e-no-such-widget",
};

/** An unsaved change that keeps the Installation's name: a Universe, and that Output on it. */
async function addAbsentWidget(): Promise<void> {
  await commandFromElsewhere(env.REFRATA_PORT, "universe.create", {
    id: "floor",
    name: "Floor",
  });
  await commandFromElsewhere(env.REFRATA_PORT, "output.create", {
    ...ABSENT_WIDGET,
    universeId: "floor",
  });
  await eventually(
    () => outputStates(env.REFRATA_PORT),
    (states) => states.absent === "device-missing",
  );
}

const runtimeLog = (): Promise<string> =>
  readFile(path.join(userData, "logs", "runtime.log"), "utf8");

describe("Refrata Desktop as an appliance", () => {
  it("runs without the Studio window, shows it to a second launch, and stops on SIGTERM", async () => {
    await launchWithoutStudio(await installationFile("First"));
    expect(await windowCount()).toBe(0);
    expect(await openInstallationName(env.REFRATA_PORT)).toBe("First");

    // A file from the OS has no Studio to go through: the runtime opens it.
    await secondLaunch(await installationFile("Second"));
    await eventually(
      () => openInstallationName(env.REFRATA_PORT),
      (name) => name === "Second",
    );
    expect(await windowCount()).toBe(0);

    // Started again by hand, Studio shows.
    const page = await windowAfter(() => secondLaunch());
    await page.waitForFunction(() => document.title.startsWith("Second"));

    // File ▸ Startup: the login entry is what is running, under the test's
    // own XDG_CONFIG_HOME, and follows the other checkbox.
    const entry = path.join(
      dir,
      "config",
      "autostart",
      "refrata-desktop.desktop",
    );
    await eventually(
      () => menuChecked("desktop:start-at-login"),
      (checked) => checked === false,
    );
    await clickMenu("desktop:start-at-login");
    const exec = (
      await eventually(
        () => readFile(entry, "utf8"),
        (text) => text.includes("Exec="),
      )
    )
      .split("\n")
      .find((line) => line.startsWith("Exec="));
    if (packagedExecutable?.endsWith(".AppImage") === true)
      // The AppImage file, never the mount it runs from, and no sandbox
      // switch: its launcher decides that at each start.
      expect(exec).toBe(`Exec=${packagedExecutable}`);
    else expect(exec).toContain(path.dirname(import.meta.dirname));
    expect(exec).not.toContain("--no-studio");
    await eventually(
      () => menuChecked("desktop:start-at-login"),
      (checked) => checked === true,
    );

    await answerDialogs(0);
    await clickMenu("desktop:start-without-studio");
    await eventually(
      () => readFile(entry, "utf8"),
      (text) => /^Exec=.* --no-studio$/m.test(text),
    );
    expect((await askedDialogs())[0]).toContain(
      "Refrata will start without its Studio window.",
    );
    expect(
      JSON.parse(
        await readFile(path.join(userData, "desktop-state.json"), "utf8"),
      ),
    ).toMatchObject({ startWithoutStudio: true });
    await clickMenu("desktop:start-at-login");
    await eventually(
      () => readdir(path.dirname(entry)),
      (files) => files.length === 0,
    );

    // The window was a visit: closing it leaves the runtime running.
    await page.close();
    await eventually(windowCount, (count) => count === 0);
    expect(await health()).toBe(true);

    // Nobody is there to answer a dialog, so SIGTERM just stops it, runtime first.
    const desktop = app?.process();
    const exited = new Promise((resolve) => desktop?.once("exit", resolve));
    desktop?.kill("SIGTERM");
    await exited;
    expect(await runtimeLog()).toContain("Stopping Refrata Runtime");
    expect(await health()).toBe(false);
  });

  it("starts the runtime again when it dies, with the Installation that was open and its unsaved changes", async () => {
    const file = await installationFile("Tonight");
    const page = await launch(file);
    await page.waitForFunction(() => document.title.startsWith("Tonight"));

    // Unsaved changes, old enough to have been autosaved: an Output, which
    // the runtime is looking for a widget for, and a new name.
    await addAbsentWidget();
    await renameFromElsewhere(env.REFRATA_PORT, "Changed");
    await eventually(
      async () => {
        const autosave = (await readdir(dir)).find((name) =>
          name.endsWith(".autosave.refrata"),
        );
        return autosave === undefined
          ? ""
          : await readFile(path.join(dir, autosave), "utf8");
      },
      (text) => text.includes("Changed") && text.includes(ABSENT_WIDGET.device),
    );

    const pid = await runtimeChildPid();
    if (pid === undefined) throw new Error("No runtime child.");
    process.kill(pid, "SIGKILL");

    await eventually(runtimeChildPid, (next) => next !== pid);
    await eventually(health, (ok) => ok);
    expect(await openInstallationName(env.REFRATA_PORT)).toBe("Changed");
    expect(await runtimeLog()).toContain("Restarting it in");
    // The new runtime took up the Installation's Outputs again by itself, so
    // this one stands as it did before: looked for, and not found.
    await eventually(
      () => outputStates(env.REFRATA_PORT),
      (states) => states.absent === "device-missing",
    );

    // Studio's page and main's own link both found the new runtime by
    // themselves: a change made now reaches the page and the title main writes.
    await renameFromElsewhere(env.REFRATA_PORT, "After");
    await page.waitForFunction(() => document.title.startsWith("After"));
    await eventually(studioTitle, (title) => title?.includes("After") === true);
    // Not only the summary: Studio follows the Installation itself again.
    await commandFromElsewhere(env.REFRATA_PORT, "universe.create", {
      name: "Made after the restart",
    });
    await page.getByText("Made after the restart").first().waitFor();

    await answerDialogs(1);
    await quit();
  });

  it("warns before quitting stops Outputs that are delivering, and Cancel keeps everything running", async ({
    skip,
  }) => {
    // Only a checkout reads REFRATA_TEST_DELIVERING_OUTPUTS, and no test may
    // make an Output deliver for real.
    skip(packaged, "a packaged Desktop counts only real delivering Outputs");
    // An Output delivers only through a DMX widget, which a test run must
    // never open, so Desktop is told how many to take as delivering.
    env.REFRATA_TEST_DELIVERING_OUTPUTS = "1";
    const page = await launch(await installationFile("Show"));
    await page.waitForFunction(() => document.title.startsWith("Show"));
    await addAbsentWidget();

    // Unsaved changes first (Don't Save), then the Outputs; Cancel there
    // keeps the runtime, the window and the unsaved Installation.
    await answerDialogs(1);
    await app?.evaluate(({ app: electronApp }) => electronApp.quit());
    await eventually(askedDialogs, (asked) => asked.length === 2);
    expect(await askedDialogs()).toEqual([
      "Save the changes to “Show”? Your changes are lost if you do not save them. Save/Don't Save/Cancel",
      "1 Output is delivering DMX from this computer. Quitting stops it. Quit/Cancel",
    ]);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(await health()).toBe(true);
    expect(await windowCount()).toBe(1);
    expect(await openInstallation(env.REFRATA_PORT)).toEqual({
      name: "Show",
      dirty: true,
    });

    // Closing the Studio window asks the same; Quit goes through with it.
    await app?.evaluate(({ dialog }) => {
      dialog.showMessageBox = (...args: unknown[]) => {
        const { buttons } = args[1] as { buttons: string[] };
        // Don't Save, then Quit.
        return Promise.resolve({
          response: buttons.includes("Quit") ? 0 : 1,
          checkboxChecked: false,
        });
      };
    });
    const desktop = app?.process();
    const exited = new Promise((resolve) => desktop?.once("exit", resolve));
    await app
      ?.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()
          .find((window) => window.webContents.getURL().includes("/studio/"))
          ?.close();
      })
      .catch(() => undefined);
    await exited;
    expect(await health()).toBe(false);
  });
});
