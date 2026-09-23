import { describe, expect, it } from "vitest";

import rgbJson from "../../../refrata-library/generic/rgb-3ch.json" with { type: "json" };
import { executeCommand } from "../command/execute.ts";
import { resolveDocument } from "../composition/resolve.ts";
import { emptyDocument, type Document } from "../document/document.ts";
import { orderedEntries } from "../document/order.ts";
import { formatFrame, universeFrame } from "../rig/frames.ts";
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

function frame(document: Document): string {
  const universe = orderedEntries(document.universes)[0]?.id ?? "";
  return formatFrame(
    universeFrame(document, universe, resolveDocument(document)),
  );
}

describe("DMX Tester", () => {
  it("holds a range at 0 over the encoded frame, sets and releases channels, and is killed by Blackout", () => {
    let document = run(emptyDocument("Club"), "fixture.create", {
      id: "par",
      typeKey: "generic/rgb-3ch",
      modeKey: "3ch",
      fixtureType: rgbJson,
      name: "Par",
    });
    document = run(document, "address.set", {
      address: "element/par/root/highlight",
      value: true,
    });
    expect(frame(document)).toBe("<3x 255> <509x 0>");
    const universeId = orderedEntries(document.universes)[0]?.id ?? "";
    expect(
      failure(document, "tester.hold", { universeId, address: 500, count: 20 }),
    ).toContain("do not fit");
    expect(
      failure(document, "tester.hold", { universeId, address: 1, count: 65 }),
    ).toContain("1 to 64");
    expect(failure(document, "tester.set", { values: { "1": 10 } })).toContain(
      "holds no range",
    );
    document = run(document, "tester.hold", {
      universeId,
      address: 2,
      count: 4,
    });
    expect(document.operational.tester).toEqual({
      universeId,
      address: 2,
      values: [0, 0, 0, 0],
    });
    expect(frame(document)).toBe("255 <511x 0>");
    document = run(document, "tester.set", { values: { "3": 200, "5": 7 } });
    expect(frame(document)).toBe("255 0 200 0 7 <507x 0>");
    expect(failure(document, "tester.set", { values: { "9": 1 } })).toContain(
      "outside the held range 2 to 5",
    );
    // A released channel shows the frame underneath; a re-hold of the same range changes nothing.
    document = run(document, "tester.set", { values: { "2": null } });
    expect(frame(document)).toBe("<2x 255> 200 0 7 <507x 0>");
    const same = executeCommand(registry, document, "tester.hold", {
      universeId,
      address: 2,
      count: 4,
    });
    expect(same.ok && same.patches).toEqual([]);
    // Blackout kills the whole frame, held channels and highlight alike.
    const dark = run(document, "address.set", {
      address: "installation/blackout",
      value: true,
    });
    expect(frame(dark)).toBe("<512x 0>");
    document = run(document, "tester.zero", {});
    expect(frame(document)).toBe("255 <511x 0>");
    document = run(document, "tester.release", {});
    expect(document.operational.tester).toBeNull();
    expect(frame(document)).toBe("<3x 255> <509x 0>");
  });
});
