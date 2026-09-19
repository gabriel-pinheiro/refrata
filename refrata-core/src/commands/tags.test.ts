import { describe, expect, it } from "vitest";

import rgbJson from "../../../refrata-library/generic/rgb-3ch.json" with { type: "json" };
import strobeJson from "../../../refrata-library/generic/atomic-like-panel.json" with { type: "json" };
import { executeCommand } from "../command/execute.ts";
import { resolveDocument } from "../composition/resolve.ts";
import { emptyDocument, type Document } from "../document/document.ts";
import { allSets, setMembers } from "../document/fixture-sets.ts";
import { matchRule, normaliseTag, tagsInUse } from "../document/tags.ts";
import { expandTargets } from "../document/targets.ts";
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

function apply(document: Document, steps: readonly [string, unknown][]) {
  let current = document;
  for (const [name, payload] of steps)
    current = run(current, name, payload).document;
  return current;
}

const strobe = (id: string) =>
  [
    "fixture.create",
    {
      id,
      typeKey: "generic/atomic-like-panel",
      modeKey: "32ch",
      fixtureType: strobeJson,
      name: id,
    },
  ] as [string, unknown];

/** Strobes s1, s2, s3 and a Par; s1 and s2 on the left truss, the Par on the wall. */
function rig(): Document {
  // A new Fixture lands first, so the navigator reads s1, s2, s3, Par.
  return apply(emptyDocument("Club"), [
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
    strobe("s3"),
    strobe("s2"),
    strobe("s1"),
    [
      "fixture.tags.add",
      { refs: ["s1/root", "s2/root"], tags: ["truss-left"] },
    ],
    ["fixture.tags.add", { refs: ["par/root"], tags: ["wall"] }],
  ]);
}

const membersOf = (document: Document, setId: string) => {
  const set = allSets(document.fixtureSets).find((row) => row.id === setId);
  if (set === undefined) throw new Error(`No Set ${setId}.`);
  return setMembers(document, set);
};

describe("Rule matching", () => {
  it("stops at the first Element where every Tag has been met", () => {
    const document = rig();
    expect(matchRule(document, ["truss-left"])).toEqual(["s1/root", "s2/root"]);
    expect(matchRule(document, ["panel", "bottom", "truss-left"])).toEqual(
      [1, 2, 3, 4]
        .map((n) => `s1/panel-${n}`)
        .concat([1, 2, 3, 4].map((n) => `s2/panel-${n}`)),
    );
    expect(
      matchRule(document, ["odd", "generic/atomic-like-panel"]),
    ).toHaveLength(24);
    expect(matchRule(document, [])).toEqual([
      "s1/root",
      "s2/root",
      "s3/root",
      "par/root",
    ]);
    expect(matchRule(document, ["backlight", "truss-left"])).toEqual([
      "s1/backlight",
      "s2/backlight",
    ]);
  });

  it("takes a person's Tag on one Element", () => {
    const document = apply(rig(), [
      ["fixture.tags.add", { refs: ["s3/panel-2"], tags: ["hero"] }],
    ]);
    expect(matchRule(document, ["hero"])).toEqual(["s3/panel-2"]);
    expect(matchRule(document, ["hero", "panel"])).toEqual(["s3/panel-2"]);
  });

  it("normalises what a person types", () => {
    expect(normaliseTag("  Truss Left ")).toBe("truss-left");
    expect(normaliseTag("--")).toBe("");
    expect(
      failure(rig(), "fixture.tags.add", { refs: ["s1/root"], tags: ["Wall"] }),
    ).toMatch(/lowercase/);
  });
});

describe("Fixture Sets by rule", () => {
  const mixed = () =>
    apply(rig(), [
      [
        "set.create",
        { id: "mixed", name: "Mixed", rules: [["wall"], ["panel", "odd"]] },
      ],
    ]);

  it("is the union Rule by Rule and follows the Rig", () => {
    let document = mixed();
    const members = membersOf(document, "mixed");
    expect(members[0]).toBe("par/root");
    expect(members).toHaveLength(13);
    document = apply(document, [
      ["set.rules.move", { setId: "mixed", index: 0, to: 1 }],
    ]);
    expect(membersOf(document, "mixed").at(-1)).toBe("par/root");
    document = apply(document, [
      ["fixture.tags.add", { refs: ["s3/root"], tags: ["wall"] }],
    ]);
    // s3 as a whole is now a member, so its odd Panels are dropped.
    const after = membersOf(document, "mixed");
    expect(after).toContain("s3/root");
    expect(after.some((ref) => ref.startsWith("s3/panel"))).toBe(false);
    expect(after).toHaveLength(8 + 2);
  });

  it("refuses list edits, duplicate Rules and both kinds at once", () => {
    const document = mixed();
    expect(
      failure(document, "set.members.add", {
        setId: "mixed",
        refs: ["s1/root"],
      }),
    ).toMatch(/by rule/);
    expect(
      failure(document, "set.rules.add", {
        setId: "mixed",
        tags: ["odd", "panel"],
      }),
    ).toMatch(/already has/);
    expect(
      failure(document, "set.create", { rules: [[]], members: ["s1/root"] }),
    ).toMatch(/never both/);
  });

  it("feeds a Look Layer, and a newly tagged Fixture joins", () => {
    let document = apply(rig(), [
      [
        "set.create",
        {
          id: "lb",
          name: "Left Bottom",
          rules: [["panel", "bottom", "truss-left"]],
        },
      ],
      ["scene.create", { id: "verse", name: "Verse" }],
      [
        "layer.create",
        { id: "red", sceneId: "verse", name: "Red", targets: ["set:lb"] },
      ],
      [
        "layer.row.set",
        { layerId: "red", targets: ["set:lb"], attribute: "dimmer", value: 1 },
      ],
      ["address.trigger", { address: "scene/verse/play" }],
    ]);
    const dimmer = (doc: Document, ref: string) =>
      resolveDocument(doc).get(ref)?.dimmer;
    expect(dimmer(document, "s1/panel-1")).toBe(1);
    expect(dimmer(document, "s3/panel-1")).not.toBe(1);
    document = apply(document, [
      ["fixture.tags.add", { refs: ["s3/root"], tags: ["truss-left"] }],
    ]);
    expect(dimmer(document, "s3/panel-1")).toBe(1);
  });

  it("converts to a list that stops following", () => {
    let document = apply(mixed(), [["set.convert", { setId: "mixed" }]]);
    const frozen = membersOf(document, "mixed");
    expect(frozen).toHaveLength(13);
    document = apply(document, [
      ["fixture.tags.remove", { refs: ["par/root"], tags: ["wall"] }],
    ]);
    expect(membersOf(document, "mixed")).toEqual(frozen);
    expect(failure(document, "set.convert", { setId: "mixed" })).toMatch(
      /by list/,
    );
  });
});

describe("Tags", () => {
  it("renames on Fixtures, Elements and Rules, merging", () => {
    const document = apply(rig(), [
      [
        "fixture.tags.add",
        { refs: ["s3/panel-1"], tags: ["truss-left", "sl"] },
      ],
      ["set.create", { id: "left", rules: [["truss-left"]] }],
      ["tag.rename", { from: "truss-left", to: "sl" }],
    ]);
    const s3 = document.fixtures.s3;
    expect(s3?.kind === "fixture" && s3.elementTags["panel-1"]).toEqual(["sl"]);
    expect(membersOf(document, "left")).toEqual([
      "s1/root",
      "s2/root",
      "s3/panel-1",
    ]);
    expect(failure(document, "tag.rename", { from: "panel", to: "x" })).toMatch(
      /locked/,
    );
  });

  it("locks declared Tags and counts uses", () => {
    const document = rig();
    expect(
      failure(document, "fixture.tags.remove", {
        refs: ["s1/panel-1"],
        tags: ["panel"],
      }),
    ).toMatch(/locked/);
    const uses = tagsInUse(document);
    expect(uses.find((use) => use.tag === "truss-left")).toMatchObject({
      count: 2,
      person: true,
      declared: false,
    });
    expect(uses.find((use) => use.tag === "bottom")?.count).toBe(12);
  });

  it("drops a person's Tags with the Element key a Mode change drops", () => {
    const tagged = apply(rig(), [
      ["fixture.tags.add", { refs: ["s1/panel-1"], tags: ["hero"] }],
    ]);
    const result = run(tagged, "fixture.update", {
      fixtureId: "s1",
      modeKey: "3ch",
    });
    const s1 = result.document.fixtures.s1;
    expect(s1?.kind === "fixture" && s1.elementTags).toEqual({});
    expect(s1?.kind === "fixture" && s1.tags).toEqual(["truss-left"]);
    expect(result.warnings?.join(" ")).toMatch(/Removed Tags from 1 Element/);
  });
});

describe("Spread", () => {
  it("expands a Set to its members and an Element to its children, one level", () => {
    const document = apply(rig(), [
      ["set.create", { id: "left", rules: [["truss-left"]] }],
    ]);
    const refs = (ref: string, spread: boolean) =>
      expandTargets(document, [{ ref, spread }]).map((target) => target.ref);
    expect(refs("set:left", false)).toEqual(["set:left"]);
    expect(refs("set:left", true)).toEqual(["s1/root", "s2/root"]);
    expect(refs("s1/root", true)).toEqual(["s1/backlight", "s1/strobe"]);
    expect(refs("s1/backlight", true)).toHaveLength(8);
    expect(refs("par/root", true)).toEqual(["par/root"]);
  });

  it("is set on one Target entry", () => {
    const document = apply(rig(), [
      ["scene.create", { id: "verse" }],
      ["layer.create", { id: "base", sceneId: "verse", targets: ["s1/root"] }],
      [
        "layer.targets.spread",
        { layerId: "base", ref: "s1/root", spread: true },
      ],
    ]);
    const layer = document.layers.base;
    expect(layer?.kind === "look" && layer.targets[0]?.spread).toBe(true);
  });
});
