import { createBuiltInRegistry } from "@refrata/core";
import { describe, expect, it, vi } from "vitest";

import { DocumentStore } from "../documents/document-store.ts";
import { createDrivers } from "../output/drivers.ts";
import { OutputManager } from "../output/output-manager.ts";
import dimmerJson from "../../../refrata-library/generic/dimmer-1ch.refrata-fixture";
import { OutputLoop } from "./output-loop.ts";

describe("OutputLoop with an Output Delay", () => {
  it("sends the Outputs what was resolved the delay ago, and shows the rest at once", async () => {
    const store = new DocumentStore({ registry: createBuiltInRegistry() });
    const created = await store.create("Club", { blank: true });
    const session = store.session(created.ok ? created.result.id : "")!;
    const run = (name: string, payload: unknown): void => {
      const result = session.execute(name, payload, "test");
      if (!result.ok) throw new Error(result.error);
    };
    run("fixture.create", {
      id: "par",
      typeKey: "generic/dimmer-1ch",
      modeKey: "1ch",
      fixtureType: dimmerJson,
      name: "Par",
    });
    const highlight = (value: boolean): void =>
      run("address.set", { address: "element/par/root/highlight", value });
    const universeId = Object.keys(session.document.universes)[0] ?? "";

    const outputs = new OutputManager({
      drivers: createDrivers({
        serial: () => Promise.reject(new Error("none")),
      }),
      log: () => undefined,
    });
    const send = vi.spyOn(outputs, "send");
    let clock = 0;
    const loop = new OutputLoop({ store, outputs, now: () => clock });
    /** The par's byte as resolved and as handed to the Outputs, one tick later. */
    const tick = (): readonly (number | undefined)[] => {
      clock += 25;
      send.mockClear();
      loop.tick();
      const sent = send.mock.calls[0]?.[0].get(universeId)?.[0];
      return [loop.frame(universeId)[0], sent];
    };

    expect(tick()).toEqual([0, 0]);
    run("installation.delay", { ms: 50 });
    highlight(true);
    // The frame at hand is the newest one due until the delay has passed.
    expect(tick()).toEqual([255, undefined]);
    expect(tick()).toEqual([255, undefined]);
    expect(tick()).toEqual([255, 255]);
    highlight(false);
    expect(tick()).toEqual([0, 255]);
    expect(tick()).toEqual([0, 255]);
    expect(tick()).toEqual([0, 0]);

    highlight(true);
    expect(tick()).toEqual([255, 0]);
    run("installation.delay", { ms: 0 });
    expect(tick()).toEqual([255, 255]);
    await loop.close();
  });
});
