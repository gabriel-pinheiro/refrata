import { createBuiltInRegistry } from "@refrata/core";
import { describe, expect, it } from "vitest";

import { DocumentStore } from "../documents/document-store.ts";
import { createDrivers } from "../output/drivers.ts";
import { OutputManager } from "../output/output-manager.ts";
import beamJson from "../../../refrata-library/generic/beam-moving-head.json" with { type: "json" };
import { OutputLoop } from "./output-loop.ts";

describe("OutputLoop with Settle", () => {
  it("darkens a beam while its colour wheel travels, and again when Blackout is let go", async () => {
    const store = new DocumentStore({ registry: createBuiltInRegistry() });
    const created = await store.create("Club", { blank: true });
    const session = store.session(created.ok ? created.result.id : "")!;
    const run = (name: string, payload: unknown): void => {
      const result = session.execute(name, payload, "test");
      if (!result.ok) throw new Error(result.error);
    };
    run("fixture.create", {
      id: "beam",
      typeKey: "generic/beam-moving-head",
      modeKey: "12ch",
      fixtureType: beamJson,
      name: "Beam",
    });
    run("scene.create", { id: "verse", name: "Verse" });
    run("layer.create", {
      id: "look",
      sceneId: "verse",
      targets: ["beam/root"],
    });
    const row = (attribute: string, value: unknown): void =>
      run("layer.row.set", {
        layerId: "look",
        targets: ["beam/root"],
        attribute,
        value,
      });
    row("dimmer", 1);
    row("color", [1, 0, 0, 1]);

    let clock = 0;
    const loop = new OutputLoop({
      store,
      outputs: new OutputManager({
        drivers: createDrivers({
          serial: () => Promise.reject(new Error("none")),
        }),
        log: () => undefined,
        retryMs: 0,
      }),
      rateHz: 0.001,
      now: () => clock,
    });
    loop.start();
    const universeId = Object.keys(session.document.universes)[0] ?? "";
    /** The beam's dimmer as resolved and as sent, and its colour byte, `ms` later. */
    const after = (ms: number): readonly unknown[] => {
      clock += ms;
      loop.tick();
      const frame = loop.frame(universeId);
      return [loop.resolved().get("beam/root")?.dimmer, frame[5], frame[7]];
    };
    expect(after(25)).toEqual([1, 255, 10]);

    row("color", [0, 0, 1, 1]);
    // Red to Blue is ten slots: 0.08 + 10 x 0.052 s of dark.
    expect(after(25)).toEqual([0, 0, 110]);
    expect(after(550)).toEqual([0, 0, 110]);
    expect(after(50)).toEqual([1, 255, 110]);

    run("address.set", { address: "installation/blackout", value: true });
    expect(after(25)[1]).toBe(0);
    run("address.set", { address: "installation/blackout", value: false });
    expect(after(25)).toEqual([0, 0, 110]);
    expect(after(700)).toEqual([1, 255, 110]);
    await loop.close();
  });
});
