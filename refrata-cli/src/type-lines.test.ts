import {
  createBuiltInRegistry,
  emptyDocument,
  executeCommand,
  type Document,
} from "@refrata/core";
import { describe, expect, it } from "vitest";

import beamJson from "../../refrata-library/generic/beam-moving-head.refrata-fixture";
import rgbJson from "../../refrata-library/generic/rgb-3ch.refrata-fixture";
import { formatChart, formatTypes, resolveTypeKey } from "./type-lines.ts";

const registry = createBuiltInRegistry();

function stage(): Document {
  let document = emptyDocument("Club");
  for (const [name, payload] of [
    [
      "fixture.create",
      {
        id: "fx_p",
        typeKey: "generic/rgb-3ch",
        modeKey: "3ch",
        fixtureType: rgbJson,
        name: "Par",
      },
    ],
    ["type.import", { fixtureType: beamJson, origin: { from: "library" } }],
    [
      "type.import",
      {
        fixtureType: rgbJson,
        origin: { from: "file", file: "par.refrata-fixture" },
        onHeld: "copy",
      },
    ],
    ["type.create", { manufacturer: "Acme", model: "Mini Par", channels: 4 }],
  ] as const) {
    const result = executeCommand(registry, document, name, payload);
    if (!result.ok) throw new Error(result.error);
    document = result.document;
  }
  return document;
}

describe("formatTypes", () => {
  it("lists each type with its origin, its standing and how many Fixtures use it", () => {
    expect(
      formatTypes(stage(), {
        "generic/rgb-3ch": "matches",
        "generic/beam-moving-head": "newer",
      }),
    ).toEqual([
      "acme/mini-par                Acme Mini Par  [Made here]  0 Fixtures  modes: 4ch (4ch)",
      "generic/beam-moving-head     Generic Beam Moving Head  [Library is newer]  0 Fixtures  modes: 12ch (12ch)",
      "generic/rgb-3ch              Generic RGB 3ch  [Matches the library]  1 Fixture  modes: 3ch (3ch)",
      "generic/rgb-3ch-2            Generic RGB 3ch  [From par.refrata-fixture]  0 Fixtures  modes: 3ch (3ch)",
    ]);
    expect(formatTypes(emptyDocument("Club"), {})).toEqual([
      "The Installation holds no Fixture Types.",
    ]);
  });

  it("finds a type by key or by a model only one type has", () => {
    const document = stage();
    expect(resolveTypeKey(document, "generic/rgb-3ch-2")).toBe(
      "generic/rgb-3ch-2",
    );
    expect(resolveTypeKey(document, "mini par")).toBe("acme/mini-par");
    expect(resolveTypeKey(document, "Generic Beam Moving Head")).toBe(
      "generic/beam-moving-head",
    );
    expect(() => resolveTypeKey(document, "RGB 3ch")).toThrow(
      "2 Fixture Types are called “RGB 3ch”; use a key: generic/rgb-3ch, generic/rgb-3ch-2.",
    );
    expect(() => resolveTypeKey(document, "nope")).toThrow(
      "The Installation holds no Fixture Type “nope”.",
    );
  });
});

describe("formatChart", () => {
  it("prints a Mode as a manual's chart, one number per Channel", () => {
    const beam = stage().fixtureTypes["generic/beam-moving-head"]!.type;
    const lines = formatChart("12ch", beam.modes["12ch"]!);
    expect(lines[0]).toBe("Mode 12ch “12ch”  Footprint 12  1 Element");
    expect(lines[1]).toBe("1–2  Pan      16 bit  root  pan (scale)");
    expect(lines[3]).toBe("5    Speed            root  not mapped");
    expect(lines[8]).toBe(
      "10   Prism            root  prism (switch): 0-99 Off, 100-127 On; prism-rotation (spread): 128-255 On",
    );
    expect(lines[7]).toContain("gobo1 (range): 0-5 Open, 6-11 Medium");
    expect(lines.at(-1)).toBe(
      "Action reset “Reset”  byte 255 on 12 Control for 6 s",
    );
    expect(lines).toHaveLength(1 + 10 + 1);
  });
});
