import { describe, expect, it } from "vitest";

import rgbJson from "../../../refrata-library/generic/rgb-3ch.json" with { type: "json" };
import strobeJson from "../../../refrata-library/generic/atomic-like-panel.json" with { type: "json" };
import { executeCommand } from "../command/execute.ts";
import { emptyDocument, type Document } from "../document/document.ts";
import {
  fixtureTypeDrift,
  sameFixtureType,
} from "../document/fixture-types.ts";
import { parseFixtureType, type FixtureType } from "../rig/fixture-type.ts";
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

/** The parts of a raw Fixture Type file the tests edit. */
interface RawParameter {
  highlight?: unknown;
}
interface RawMode {
  channels: { key: string; element: string }[];
  elements: Record<
    string,
    { children?: string[]; parameters?: Record<string, RawParameter> }
  >;
  shape: { panels?: number };
}
interface RawType {
  key: string;
  modes: Record<string, RawMode>;
}

function modeOf(raw: RawType, key: string): RawMode {
  const mode = raw.modes[key];
  if (mode === undefined) throw new Error(`no mode ${key}`);
  return mode;
}

function elementOf(mode: RawMode, key: string) {
  const element = mode.elements[key];
  if (element === undefined) throw new Error(`no element ${key}`);
  return element;
}

function parameterOf(mode: RawMode, element: string, key: string) {
  const parameter = elementOf(mode, element).parameters?.[key];
  if (parameter === undefined) throw new Error(`no parameter ${key}`);
  return parameter;
}

/** A library file edited by `edit`, parsed as the runtime would. */
function variant(json: unknown, edit: (raw: RawType) => void): FixtureType {
  const raw = JSON.parse(JSON.stringify(json)) as RawType;
  edit(raw);
  const parsed = parseFixtureType(raw);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.type;
}

/** A Par at 1 and a Strobe right after it at 4, the Strobe's panel 8 in a Set, a Layer and a Link. */
function stage(): Document {
  let document = emptyDocument("Club");
  for (const [name, payload] of [
    [
      "fixture.create",
      {
        id: "par",
        typeKey: "generic/rgb-3ch",
        modeKey: "3ch",
        fixtureType: rgbJson,
        name: "Par",
      },
    ],
    [
      "fixture.create",
      {
        id: "strobe",
        typeKey: "generic/atomic-like-panel",
        modeKey: "32ch",
        fixtureType: strobeJson,
        name: "Strobe",
      },
    ],
    [
      "set.create",
      {
        id: "edge",
        name: "Edge",
        members: ["strobe/panel-7", "strobe/panel-8"],
      },
    ],
    ["scene.create", { id: "verse", name: "Verse" }],
    [
      "layer.create",
      {
        id: "base",
        sceneId: "verse",
        name: "Base",
        targets: ["strobe/panel-8", "par/root"],
      },
    ],
    ["controller.create", { id: "fader", kind: "number", name: "Fader" }],
    [
      "link.create",
      {
        controllerId: "fader",
        addresses: ["layer/base/row/strobe/panel-8/dimmer"],
      },
    ],
    [
      "address.set",
      { address: "element/strobe/panel-8/highlight", value: true },
    ],
  ] as const)
    document = run(document, name, payload).document;
  return document;
}

describe("fixture.reload", () => {
  it("compares types whatever their key order, and says how a copy stands", () => {
    const rgb = variant(rgbJson, () => undefined);
    const reordered = JSON.parse(
      JSON.stringify(rgb, Object.keys(rgb).reverse()),
    ) as FixtureType;
    expect(sameFixtureType(rgb, { ...reordered, modes: rgb.modes })).toBe(true);
    const brighter = variant(rgbJson, (raw) => {
      parameterOf(modeOf(raw, "3ch"), "root", "dimmer").highlight = 0.5;
    });
    expect(fixtureTypeDrift(rgb, rgb)).toBe("current");
    expect(fixtureTypeDrift(rgb, brighter)).toBe("stale");
    expect(fixtureTypeDrift(rgb, undefined)).toBe("missing");
  });

  it("replaces the copy, and changes nothing when it is the same", () => {
    const document = stage();
    const same = run(document, "fixture.reload", {
      types: [variant(rgbJson, () => undefined)],
    });
    expect(same.patches).toEqual([]);
    const brighter = variant(rgbJson, (raw) => {
      parameterOf(modeOf(raw, "3ch"), "root", "dimmer").highlight = 0.5;
    });
    const reloaded = run(document, "fixture.reload", { types: [brighter] });
    expect(reloaded.definition.kind).toBe("authoring");
    expect(
      sameFixtureType(
        reloaded.document.fixtureTypes["generic/rgb-3ch"]!.type,
        brighter,
      ),
    ).toBe(true);
    expect(reloaded.warnings).toEqual([]);
  });

  it("refuses a lost Mode, a Footprint that would overlap, and a type the Installation lacks", () => {
    const document = stage();
    const renamed = variant(rgbJson, (raw) => {
      raw.modes = { rgb: modeOf(raw, "3ch") };
    });
    expect(failure(document, "fixture.reload", { types: [renamed] })).toBe(
      "Par uses Mode “3ch”, which the new RGB 3ch no longer has. Change its Mode first.",
    );
    const wider = variant(rgbJson, (raw) => {
      modeOf(raw, "3ch").channels.push({ key: "extra", element: "root" });
    });
    expect(failure(document, "fixture.reload", { types: [wider] })).toContain(
      "Cannot reload Par: Addresses 1 to 4 of Universe 1 overlap Strobe at 4.",
    );
    const other = variant(rgbJson, (raw) => {
      raw.key = "generic/other";
    });
    expect(failure(document, "fixture.reload", { types: [other] })).toContain(
      "holds no Fixture Type “generic/other”",
    );
  });

  it("drops what pointed at Element keys the new Mode no longer has, keeping the rest", () => {
    const document = stage();
    const shorter = variant(strobeJson, (raw) => {
      const mode = modeOf(raw, "32ch");
      const { ["panel-8"]: _removed, ...elements } = mode.elements;
      mode.elements = elements;
      mode.channels = mode.channels.filter(
        (channel) => channel.element !== "panel-8",
      );
      const backlight = elementOf(mode, "backlight");
      backlight.children = (backlight.children ?? []).filter(
        (key) => key !== "panel-8",
      );
      mode.shape.panels = 7;
    });
    const result = run(document, "fixture.reload", { types: [shorter] });
    expect(result.warnings).toEqual([
      "Removed 1 Fixture Set member",
      "Removed 1 Layer Target",
      "Removed 1 Link",
    ]);
    const after = result.document;
    expect((after.fixtureSets.edge as { members: string[] }).members).toEqual([
      "strobe/panel-7",
    ]);
    expect(
      (after.layers.base as { targets: { ref: string }[] }).targets.map(
        (target) => target.ref,
      ),
    ).toEqual(["par/root"]);
    expect(after.links).toEqual({});
    expect(after.operational.highlight).toEqual({});
  });
});
