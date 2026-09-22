import { describe, expect, it } from "vitest";

import beamJson from "../../../refrata-library/generic/beam-moving-head.json" with { type: "json" };
import rgbJson from "../../../refrata-library/generic/rgb-3ch.json" with { type: "json" };
import strobeJson from "../../test-fixtures/atomic-like-panel.json" with { type: "json" };
import { listAddresses, resolveAddress } from "../address/address.ts";
import { executeCommand } from "../command/execute.ts";
import { emptyDocument, type Document } from "../document/document.ts";
import { orderedEntries } from "../document/order.ts";
import { applyPatches } from "../document/patch.ts";
import type { PatchedFixture } from "../document/rig.ts";
import { resolveDocument } from "../composition/resolve.ts";
import { rowDefinition } from "../document/targets.ts";
import { formatFrame, universeFrame } from "../rig/frames.ts";
import { createBuiltInRegistry } from "./index.ts";

const registry = createBuiltInRegistry();

function run(document: Document, name: string, payload: unknown) {
  const result = executeCommand(registry, document, name, payload);
  if (!result.ok) throw new Error(result.error);
  return result;
}

function failure(document: Document, name: string, payload: unknown): string {
  const result = executeCommand(registry, document, name, payload);
  if (result.ok) throw new Error(`${name} was accepted.`);
  return result.error;
}

function universeId(document: Document): string {
  return orderedEntries(document.universes)[0]?.id ?? "";
}

function fixture(document: Document, id: string): PatchedFixture {
  const row = document.fixtures[id];
  if (row?.kind !== "fixture") throw new Error(`no fixture ${id}`);
  return row;
}

function stage(): Document {
  let document = emptyDocument("Club");
  document = run(document, "fixture.create", {
    id: "par",
    typeKey: "generic/rgb-3ch",
    modeKey: "3ch",
    fixtureType: rgbJson,
    name: "Par",
  }).document;
  document = run(document, "fixture.create", {
    id: "strobe",
    typeKey: "generic/atomic-like-panel",
    modeKey: "32ch",
    fixtureType: strobeJson,
    name: "Strobe",
  }).document;
  return document;
}

describe("Universes and Outputs", () => {
  it("start with Universe 1 and number the next", () => {
    let document = emptyDocument("Club");
    expect(Object.values(document.universes).map((u) => u.name)).toEqual([
      "Universe 1",
    ]);
    document = run(document, "universe.create", { id: "u2" }).document;
    expect(document.universes.u2?.name).toBe("Universe 2");
    expect(orderedEntries(document.universes).at(-1)?.id).toBe("u2");
    document = run(document, "universe.rename", {
      universeId: "u2",
      name: "Floor",
    }).document;
    expect(document.universes.u2?.name).toBe("Floor");
    expect(
      run(document, "universe.create", { name: "Floor" }).document.universes,
    ).toSatisfy((table: Record<string, { name: string }>) =>
      Object.values(table).some((u) => u.name === "Floor 1"),
    );
  });

  it("route a Universe through an Output and take both away", () => {
    let document = stage();
    const first = universeId(document);
    document = run(document, "output.create", {
      id: "o",
      universeId: first,
      kind: "enttec-open-dmx",
    }).document;
    expect(document.outputs.o).toMatchObject({ device: "any" });
    document = run(document, "output.update", {
      outputId: "o",
      device: "AB12",
    }).document;
    expect(document.outputs.o?.device).toBe("AB12");
    expect(
      failure(document, "output.create", {
        universeId: "nope",
        kind: "enttec-usb-pro",
      }),
    ).toContain("does not exist");
    const removal = run(document, "universe.remove", { universeId: first });
    expect(removal.warnings).toEqual([
      "Unpatched 2 Fixtures from Universe 1",
      "Removed 1 Output",
    ]);
    expect(fixture(removal.document, "par").patch).toBeNull();
    expect(removal.document.outputs.o).toBeUndefined();
    expect(applyPatches(removal.document, removal.inverse)).toEqual(document);
  });
});

describe("Fixtures", () => {
  it("copy the type in, patch at the next free address and place to the right", () => {
    const document = stage();
    expect(Object.keys(document.fixtureTypes).sort()).toEqual([
      "generic/atomic-like-panel",
      "generic/rgb-3ch",
    ]);
    expect(fixture(document, "par").patch).toEqual({
      universeId: universeId(document),
      address: 1,
    });
    expect(fixture(document, "strobe").patch?.address).toBe(4);
    expect(fixture(document, "par").position.x).toBe(0);
    expect(fixture(document, "strobe").position.x).toBeGreaterThan(0.5);
    expect(
      failure(document, "fixture.create", {
        typeKey: "generic/rgbw-4ch",
        modeKey: "4ch",
      }),
    ).toContain("pass fixtureType");
    const reused = run(document, "fixture.create", {
      id: "par2",
      typeKey: "generic/rgb-3ch",
      modeKey: "3ch",
    });
    expect(reused.document.fixtures.par2?.name).toBe("RGB 3ch");
    expect(fixture(reused.document, "par2").patch?.address).toBe(36);
  });

  it("refuse overlapping patches and colliding Mode changes", () => {
    const document = stage();
    const first = universeId(document);
    expect(
      failure(document, "fixture.patch", {
        fixtureId: "par",
        patch: { universeId: first, address: 20 },
      }),
    ).toContain("overlap Strobe at 4");
    expect(
      failure(document, "fixture.patch", {
        fixtureId: "strobe",
        patch: { universeId: first, address: 500 },
      }),
    ).toContain("past the end");
    const moved = run(document, "fixture.patch", {
      fixtureId: "par",
      patch: { universeId: first, address: 100 },
    }).document;
    expect(fixture(moved, "par").patch?.address).toBe(100);
    const unpatched = run(moved, "fixture.patch", {
      fixtureId: "par",
      patch: null,
    }).document;
    expect(fixture(unpatched, "par").patch).toBeNull();
    let crowded = run(document, "fixture.patch", {
      fixtureId: "strobe",
      patch: { universeId: first, address: 5 },
    }).document;
    crowded = run(crowded, "fixture.update", {
      fixtureId: "strobe",
      modeKey: "3ch",
    }).document;
    expect(fixture(crowded, "strobe").modeKey).toBe("3ch");
    crowded = run(crowded, "fixture.patch", {
      fixtureId: "par",
      patch: { universeId: first, address: 8 },
    }).document;
    expect(
      failure(crowded, "fixture.update", {
        fixtureId: "strobe",
        modeKey: "32ch",
      }),
    ).toContain("Cannot change Mode");
  });

  it("group, move, ungroup, remove, dropping unused types", () => {
    let document = stage();
    document = run(document, "fixture.create", {
      id: "g",
      kind: "group",
      name: "Truss",
    }).document;
    document = run(document, "fixture.move", {
      fixtureId: "par",
      parentId: "g",
      after: null,
    }).document;
    expect(document.fixtures.par?.parentId).toBe("g");
    expect(
      failure(document, "fixture.move", {
        fixtureId: "strobe",
        parentId: "par",
        after: null,
      }),
    ).toContain("not a Fixture Group");
    const removal = run(document, "fixture.remove", { fixtureId: "g" });
    expect(removal.document.fixtures.par).toBeUndefined();
    expect(removal.document.fixtureTypes["generic/rgb-3ch"]).toBeUndefined();
    expect(
      removal.document.fixtureTypes["generic/atomic-like-panel"],
    ).toBeDefined();
    expect(applyPatches(removal.document, removal.inverse)).toEqual(document);
    const ungrouped = run(document, "fixture.ungroup", {
      fixtureId: "g",
    }).document;
    expect(ungrouped.fixtures.par?.parentId).toBeNull();
  });

  it("place and tag", () => {
    let document = stage();
    const placed = run(document, "fixture.place", {
      fixtureId: "par",
      position: { x: 2.5, rz: 90 },
    });
    expect(placed.coalesceKey).toBe("fixture.place:par");
    document = placed.document;
    expect(fixture(document, "par").position).toMatchObject({
      x: 2.5,
      y: 0,
      rz: 90,
    });
    document = run(document, "fixture.tags.add", {
      refs: ["par/root"],
      tags: ["truss-left", "truss-left"],
    }).document;
    expect(fixture(document, "par").tags).toEqual(["truss-left"]);
  });
});

describe("Highlight and frames", () => {
  it("lists an Address per Element and lights the frame while held", () => {
    let document = stage();
    const addresses = listAddresses(document).map((a) => a.address);
    expect(addresses).toContain("element/par/root/highlight");
    expect(addresses).toContain("element/strobe/panel-3/highlight");
    expect(
      resolveAddress(document, "element/strobe/backlight/highlight"),
    ).toMatchObject({
      owner: "Strobe · Backlight",
      type: "boolean",
    });
    expect(
      resolveAddress(document, "element/strobe/nope/highlight"),
    ).toBeUndefined();
    const universe = universeId(document);
    expect(
      formatFrame(universeFrame(document, universe, resolveDocument(document))),
    ).toBe("<512x 0>");
    const held = run(document, "address.set", {
      address: "element/par/root/highlight",
      value: true,
    });
    expect(held.definition.kind).toBe("performance");
    document = held.document;
    expect(resolveDocument(document).get("par/root")).toEqual({
      dimmer: 1,
      color: [1, 1, 1, 1],
    });
    expect(
      formatFrame(universeFrame(document, universe, resolveDocument(document))),
    ).toBe("<3x 255> <509x 0>");
    document = run(document, "address.set", {
      address: "element/strobe/backlight/highlight",
      value: true,
    }).document;
    const frame = universeFrame(document, universe, resolveDocument(document));
    expect(frame[3]).toBe(255);
    expect(frame[26]).toBe(255);
    expect(frame[27]).toBe(0);
    const gone = run(document, "fixture.remove", {
      fixtureId: "strobe",
    }).document;
    expect(gone.operational.highlight["strobe/backlight"]).toBeUndefined();
  });

  it("formats a frame with grouped runs", () => {
    expect(formatFrame([0, 0, 127, 127, 12, 0])).toBe("<2x 0> <2x 127> 12 0");
  });
});

describe("A wheel head", () => {
  function withBeam(): Document {
    return run(stage(), "fixture.create", {
      id: "beam",
      typeKey: "generic/beam-moving-head",
      modeKey: "12ch",
      fixtureType: beamJson,
      name: "Beam",
    }).document;
  }

  it("runs an Action from its Address until it is ended, and forgets it with the Fixture", () => {
    let document = withBeam();
    const universe = universeId(document);
    const start = fixture(document, "beam").patch?.address ?? 0;
    expect(listAddresses(document).map((a) => a.address)).toContain(
      "fixture/beam/action/reset",
    );
    expect(resolveAddress(document, "fixture/beam/action/reset")?.type).toBe(
      "trigger",
    );
    expect(
      resolveAddress(document, "fixture/beam/action/lamp"),
    ).toBeUndefined();
    document = run(document, "address.trigger", {
      address: "fixture/beam/action/reset",
    }).document;
    expect(document.operational.actions["beam/reset"]).toBe(true);
    let frame = universeFrame(document, universe, resolveDocument(document));
    expect(frame[start - 1 + 11]).toBe(255);
    document = run(document, "address.set", {
      address: "installation/blackout",
      value: true,
    }).document;
    frame = universeFrame(document, universe, resolveDocument(document));
    expect(frame[start - 1 + 11]).toBe(255);
    document = run(document, "fixture.action.end", {
      fixtureId: "beam",
      key: "reset",
    }).document;
    expect(document.operational.actions["beam/reset"]).toBeUndefined();
    frame = universeFrame(document, universe, resolveDocument(document));
    expect(frame[start - 1 + 11]).toBe(0);
    document = run(document, "address.trigger", {
      address: "fixture/beam/action/reset",
    }).document;
    const gone = run(document, "fixture.remove", {
      fixtureId: "beam",
    }).document;
    expect(gone.operational.actions["beam/reset"]).toBeUndefined();
  });

  it("resolves a colour to its swatch at the asked brightness, and a Set row offers every wheel's options", () => {
    let document = withBeam();
    document = run(document, "scene.create", {
      id: "s",
      name: "Show",
    }).document;
    document = run(document, "layer.create", {
      id: "l",
      sceneId: "s",
      name: "Look",
      targets: ["beam/root"],
    }).document;
    document = run(document, "layer.row.set", {
      layerId: "l",
      targets: ["beam/root"],
      attribute: "color",
      value: [0.5, 0.2, 0, 1],
    }).document;
    expect(resolveDocument(document).get("beam/root")?.color).toEqual([
      0.5, 0.25, 0, 1,
    ]);
    document = run(document, "set.create", {
      id: "all",
      name: "All",
      members: ["par/root", "beam/root"],
    }).document;
    const row = rowDefinition(document, "set:all", "gobo1");
    expect(row.kind).toBe("choice");
    if (row.kind === "choice")
      expect(row.options.map((option) => option.value)).toContain("flower");
  });
});
