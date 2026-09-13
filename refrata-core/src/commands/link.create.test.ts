import { describe, expect, it } from "vitest";

import type { ResolvedAddress } from "../address/address.ts";
import {
  anchorsProblem,
  defaultAnchors,
  mappedValue,
} from "../address/links.ts";
import { executeCommand } from "../command/execute.ts";
import {
  emptyDocument,
  type Document,
  type Link,
  type NumberController,
} from "../document/document.ts";
import { createBuiltInRegistry } from "./index.ts";

const registry = createBuiltInRegistry();

function run(document: Document, name: string, payload: unknown): Document {
  const result = executeCommand(registry, document, name, payload);
  if (!result.ok) throw new Error(result.error);
  return result.document;
}

function failure(document: Document, name: string, payload: unknown): string {
  const result = executeCommand(registry, document, name, payload);
  if (result.ok) throw new Error(`${name} was accepted.`);
  return result.error;
}

function stage(): Document {
  let document = emptyDocument("Living");
  document = run(document, "controller.create", {
    id: "energy",
    kind: "number",
    name: "Energy",
  });
  return run(document, "controller.create", {
    id: "tint",
    kind: "color",
    name: "Tint",
  });
}

/** A number target the way a linkable table would resolve one. */
const hold: ResolvedAddress = {
  address: "thing/a/param/hold",
  label: "Hold",
  owner: "A",
  path: ["things", "a", "parameters", "hold"],
  type: "number",
  default: 100,
  range: { min: 0, max: 2000, step: 10, unit: "ms" },
};
const mirror: ResolvedAddress = {
  address: "thing/a/param/mirror",
  label: "Mirror",
  owner: "A",
  path: ["things", "a", "parameters", "mirror"],
  type: "boolean",
  default: false,
};

const HOLD_RANGE =
  "Hold anchors must lie within 0 to 2000 in steps of 10; the anchor at";

describe("link.create", () => {
  it("refuses every Address while no table is linkable", () => {
    const document = stage();
    expect(
      failure(document, "link.create", {
        controllerId: "energy",
        addresses: ["controller/tint/value"],
      }),
    ).toBe("“Value” cannot be driven by a Number Controller.");
    expect(
      failure(document, "link.create", {
        controllerId: "tint",
        addresses: ["installation/blackout"],
      }),
    ).toBe("“Blackout” cannot be driven by a Color Controller.");
    expect(
      failure(document, "link.create", {
        controllerId: "energy",
        addresses: ["nope/x/value"],
      }),
    ).toBe("Unknown address “nope/x/value”.");
    expect(
      failure(document, "link.create", {
        controllerId: "zz",
        addresses: ["installation/blackout"],
      }),
    ).toBe("Controller “zz” does not exist.");
    expect(
      failure(document, "controller.create", {
        kind: "number",
        addresses: ["installation/blackout"],
      }),
    ).toMatch(/cannot be driven/);
    expect(document.links).toEqual({});
  });

  it("refuses link.update and link.remove on a Link that does not exist", () => {
    const document = stage();
    expect(
      failure(document, "link.update", {
        linkId: "zz",
        anchors: { from: 0, to: 1 },
      }),
    ).toBe("Link “zz” does not exist.");
    expect(failure(document, "link.remove", { linkId: "zz" })).toMatch(
      /does not exist/,
    );
  });
});

describe("Link anchors and mapping", () => {
  it("starts a number Link at the target's whole range and a boolean one without anchors", () => {
    expect(defaultAnchors(hold)).toEqual({ from: 0, to: 2000 });
    expect(defaultAnchors(mirror)).toBeNull();
    expect(anchorsProblem(hold, { from: 0, to: 2000 })).toBeUndefined();
  });

  it("refuses anchors outside the range, off the step, or on a non-number", () => {
    expect(anchorsProblem(hold, { from: -10, to: 2000 })).toBe(
      `${HOLD_RANGE} 0 must be between 0 and 2000.`,
    );
    expect(anchorsProblem(hold, { from: 0, to: 1995 })).toBe(
      `${HOLD_RANGE} 1 must be a multiple of 10 from 0 (got 1995).`,
    );
    expect(anchorsProblem(hold, { from: 500, to: 10 })).toBeUndefined();
    expect(anchorsProblem(mirror, { from: 0, to: 1 })).toBe(
      "Mirror is a boolean; only a number target has anchors.",
    );
  });

  it("maps a Controller's position onto the anchors, snapped and clamped", () => {
    const energy = (value: number): NumberController => ({
      id: "energy" as NumberController["id"],
      kind: "number",
      name: "Energy",
      parentId: null,
      order: "a0",
      value,
    });
    const link = (anchors: Link["anchors"]): Link => ({
      id: "l" as Link["id"],
      controllerId: "energy",
      address: hold.address,
      anchors,
    });
    expect(mappedValue(energy(0.5), link({ from: 0, to: 2000 }), hold)).toBe(
      1000,
    );
    expect(mappedValue(energy(0.5), link({ from: 500, to: 0 }), hold)).toBe(
      250,
    );
    expect(mappedValue(energy(0.33), link({ from: 500, to: 0 }), hold)).toBe(
      340,
    );
    expect(mappedValue(energy(0.5), link(null), mirror)).toBe(true);
    expect(mappedValue(energy(0.49), link(null), mirror)).toBe(false);
  });
});
