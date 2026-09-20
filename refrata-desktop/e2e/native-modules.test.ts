import { RefrataClient } from "@refrata/client";
import type { CommandResult } from "@refrata/protocol";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  env,
  eventually,
  installationFile,
  launch,
  userData,
  useDesktop,
} from "./harness.ts";

useDesktop();

describe("Refrata Desktop's runtime", () => {
  it("loads the runtime's native modules in the runtime it forks", async () => {
    const page = await launch(await installationFile("Widgets"));
    await page.waitForFunction(() => document.title.startsWith("Widgets"));

    // An Output naming a widget that does not exist makes its driver load the
    // native module and list the devices, and nothing is ever opened. A module
    // that loaded says the device is missing; one that did not is an error.
    const client = new RefrataClient({
      url: `ws://127.0.0.1:${env.REFRATA_PORT}/live`,
      kind: "cli",
      reconnect: false,
    });
    const summary = await eventually(
      () => Promise.resolve(client.document.get()),
      (document) => document !== null,
    );
    const documentId = summary?.id ?? "";
    const universe = await client.command<CommandResult>(
      documentId,
      "universe.create",
    );
    for (const kind of ["enttec-usb-pro", "anyma-udmx"])
      await client.command(documentId, "output.create", {
        universeId: universe.created?.[0]?.id,
        kind,
        device: "no-such-widget",
      });
    const log = await eventually(
      () => readFile(path.join(userData, "logs", "runtime.log"), "utf8"),
      (text) => (text.match(/Output output_\w+: /g) ?? []).length >= 2,
    );
    expect(log).toContain("No widget with serial number no-such-widget");
    expect(log).toContain("No uDMX with serial number or port location");
    expect(log).not.toMatch(/Output output_\w+: error/);

    // Closed as discarded, so quitting has nothing to ask about.
    await client.request("documents.close", { documentId, discard: true });
    client.close();
  });
});
