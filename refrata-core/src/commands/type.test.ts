import { describe, expect, it } from "vitest";

import rgbJson from "../../../refrata-library/generic/rgb-3ch.refrata-fixture";
import { emptyDocument } from "../document/document.ts";
import {
  fixtureTypeDigest,
  fixtureTypeStanding,
  originOf,
} from "../document/fixture-types.ts";
import { applyPatches } from "../document/patch.ts";
import { footprintOf, parseFixtureType } from "../rig/fixture-type.ts";
import { edit, held, refused, RGB, rigged, run } from "./type-stage.ts";

const parsed = parseFixtureType(rgbJson);
if (!parsed.ok) throw new Error(parsed.error);
const rgb = parsed.type;

describe("type.create", () => {
  it("makes a blank type: one Mode, that many one-byte Channels on the root", () => {
    const created = run(emptyDocument("Club"), "type.create", {
      manufacturer: "Açme",
      model: "Mini Par",
      channels: 3,
    });
    const stored = created.document.fixtureTypes["acme/mini-par"];
    expect(stored?.origin).toEqual({ from: "installation" });
    expect(Object.keys(stored?.type.modes ?? {})).toEqual(["3ch"]);
    const mode = stored?.type.modes["3ch"];
    expect(mode?.channels).toEqual([
      { key: "channel-1", element: "root", bytes: 1, default: 0 },
      { key: "channel-2", element: "root", bytes: 1, default: 0 },
      { key: "channel-3", element: "root", bytes: 1, default: 0 },
    ]);
    expect(mode?.elements.root?.name).toBe("Mini Par");
    expect(created.definition.kind).toBe("authoring");
  });

  it("makes the key unique, and refuses a name with no letter or digit", () => {
    let document = emptyDocument("Club");
    for (let index = 0; index < 2; index += 1)
      document = run(document, "type.create", {
        manufacturer: "Acme",
        model: "Par",
      }).document;
    expect(Object.keys(document.fixtureTypes)).toEqual([
      "acme/par",
      "acme/par-2",
    ]);
    expect(
      refused(document, "type.create", { manufacturer: "!!", model: "Par" }),
    ).toBe(
      "Give the manufacturer and the model each a name with a letter or a digit.",
    );
  });
});

describe("type.import", () => {
  it("remembers the library with a digest, and a file by its name", () => {
    const fromLibrary = run(emptyDocument("Club"), "type.import", {
      fixtureType: rgbJson,
      origin: { from: "library" },
    }).document.fixtureTypes[rgb.key];
    expect(fromLibrary?.origin).toEqual({
      from: "library",
      digest: fixtureTypeDigest(rgb),
    });
    const fromFile = run(emptyDocument("Club"), "type.import", {
      fixtureType: rgbJson,
      origin: { from: "file", file: "par.refrata-fixture" },
    }).document.fixtureTypes[rgb.key];
    expect(fromFile?.origin).toEqual({
      from: "file",
      file: "par.refrata-fixture",
    });
  });

  it("refuses a held key until told to replace it or to bring in a copy", () => {
    const document = held();
    const fromFile = {
      fixtureType: { ...rgb, model: "RGB from a file" },
      origin: { from: "file", file: "par.refrata-fixture" },
    };
    expect(refused(document, "type.import", fromFile)).toBe(
      "The Installation already holds “generic/rgb-3ch”. Say whether to replace it or to bring this one in as a copy under a new key.",
    );
    const copied = run(document, "type.import", { ...fromFile, onHeld: "copy" })
      .document.fixtureTypes;
    expect(copied["generic/rgb-3ch"]?.type.model).toBe("RGB 3ch");
    expect(copied["generic/rgb-3ch-2"]?.type.key).toBe("generic/rgb-3ch-2");
    expect(copied["generic/rgb-3ch-2"]?.type.model).toBe("RGB from a file");
    const replaced = run(document, "type.import", {
      ...fromFile,
      onHeld: "replace",
    });
    expect(replaced.document.fixtureTypes["generic/rgb-3ch"]).toEqual({
      id: "generic/rgb-3ch",
      type: { ...rgb, model: "RGB from a file" },
      origin: { from: "file", file: "par.refrata-fixture" },
    });
    expect(applyPatches(replaced.document, replaced.inverse)).toEqual(document);
  });

  it("replaces a type in use under the rules of an edit", () => {
    const document = rigged();
    const wider = {
      ...rgb,
      modes: {
        "3ch": {
          ...rgb.modes["3ch"]!,
          channels: [
            ...rgb.modes["3ch"]!.channels,
            { key: "extra", element: "root" },
          ],
        },
      },
    };
    expect(
      refused(document, "type.import", {
        fixtureType: wider,
        origin: { from: "file", file: "wide.refrata-fixture" },
        onHeld: "replace",
      }),
    ).toBe(
      "Par has no room for it: Addresses 1 to 4 of Universe 1 overlap Strobe at 4. Repatch it first.",
    );
  });
});

describe("type.duplicate, type.update and type.remove", () => {
  it("duplicates under a new key as a type made here", () => {
    const document = run(held(), "type.duplicate", {
      typeKey: RGB.typeKey,
    }).document;
    const copy = document.fixtureTypes["generic/rgb-3ch-copy"];
    expect(copy?.type.model).toBe("RGB 3ch copy");
    expect(copy?.type.key).toBe("generic/rgb-3ch-copy");
    expect(copy?.origin).toEqual({ from: "installation" });
    expect(copy?.type.modes).toEqual(rgb.modes);
  });

  it("renames without the key following, and drops empty notes", () => {
    let document = edit(held(), "type.update", {
      typeKey: RGB.typeKey,
      manufacturer: "Acme",
      model: "Par 64",
      notes: "Borrowed",
    }).document;
    const stored = document.fixtureTypes[RGB.typeKey];
    expect(stored?.type).toMatchObject({
      key: "generic/rgb-3ch",
      manufacturer: "Acme",
      model: "Par 64",
      notes: "Borrowed",
    });
    // An edit leaves the origin alone; the standing says it was edited.
    expect(originOf(stored!).from).toBe("library");
    expect(fixtureTypeStanding(stored!, rgb)).toBe("edited");
    document = edit(document, "type.update", {
      typeKey: RGB.typeKey,
      notes: " ",
    }).document;
    expect("notes" in document.fixtureTypes[RGB.typeKey]!.type).toBe(false);
  });

  it("keeps a type when its last Fixture goes, and removes it only when asked", () => {
    let document = rigged();
    expect(refused(document, "type.remove", { typeKey: RGB.typeKey })).toBe(
      "Par uses RGB 3ch. Remove it or change its type first.",
    );
    document = run(document, "fixture.remove", { fixtureId: "par" }).document;
    expect(document.fixtureTypes[RGB.typeKey]).toBeDefined();
    const removed = run(document, "type.remove", { typeKey: RGB.typeKey });
    expect(removed.document.fixtureTypes[RGB.typeKey]).toBeUndefined();
    expect(applyPatches(removed.document, removed.inverse)).toEqual(document);
    expect(
      refused(removed.document, "type.remove", { typeKey: RGB.typeKey }),
    ).toBe("The Installation holds no Fixture Type “generic/rgb-3ch”.");
  });

  it("keeps the old type when a Fixture changes to another", () => {
    let document = rigged();
    document = run(document, "fixture.patch", {
      fixtureId: "par",
      patch: null,
    }).document;
    document = run(document, "fixture.update", {
      fixtureId: "par",
      typeKey: "generic/beam-moving-head",
      modeKey: "12ch",
    }).document;
    expect(document.fixtures.par).toMatchObject({
      typeKey: "generic/beam-moving-head",
    });
    expect(document.fixtureTypes[RGB.typeKey]).toBeDefined();
    expect(
      footprintOf(document.fixtureTypes[RGB.typeKey]!.type.modes["3ch"]!),
    ).toBe(3);
  });
});
