import { describe, expect, it } from "vitest";

import rgbJson from "../../../refrata-library/generic/rgb-3ch.json" with { type: "json" };
import { executeCommand } from "../command/execute.ts";
import { createBuiltInRegistry } from "../commands/index.ts";
import { resolveDocument } from "../composition/index.ts";
import { setRef } from "./composition.ts";
import {
  DocumentSchema,
  FIRST_UNIVERSE_NAME,
  tableEntries,
} from "./document.ts";
import { allSets, setMembers } from "./fixture-sets.ts";
import { STARTER, starterDocument } from "./starter.ts";

const registry = createBuiltInRegistry();

describe("starterDocument", () => {
  it("holds Universe 1, the Set All, Scene 1 playing and a lit Base Layer on the Set", () => {
    const document = starterDocument("Club", registry);
    expect(document.installation.name).toBe("Club");
    expect(tableEntries(document.universes).map((u) => u.name)).toEqual([
      FIRST_UNIVERSE_NAME,
    ]);
    expect(document.fixtures).toEqual({});

    const [set, ...moreSets] = tableEntries(document.fixtureSets);
    const [scene, ...moreScenes] = tableEntries(document.scenes);
    const [layer, ...moreLayers] = tableEntries(document.layers);
    expect([moreSets, moreScenes, moreLayers]).toEqual([[], [], []]);
    expect(set).toMatchObject({
      kind: "set",
      name: STARTER.set,
      rules: [[]],
      members: [],
    });
    expect(scene?.name).toBe(STARTER.scene);
    expect(document.installation.activeScene).toBe(scene?.id);
    const ref = setRef(set?.id ?? "");
    expect(layer).toMatchObject({
      kind: "look",
      name: STARTER.layer,
      sceneId: scene?.id,
      parentId: null,
      enabled: true,
      targets: [{ ref, spread: false }],
      rows: {
        [ref]: {
          dimmer: { value: 1, alpha: 1 },
          color: { value: [1, 1, 1, 1], alpha: 1 },
        },
      },
    });
  });

  it("lights the first Fixture added, through the Set's empty Rule", () => {
    const document = starterDocument("Club", registry);
    const result = executeCommand(registry, document, "fixture.create", {
      id: "par",
      typeKey: "generic/rgb-3ch",
      modeKey: "3ch",
      fixtureType: rgbJson,
    });
    if (!result.ok) throw new Error(result.error);
    const [set] = allSets(result.document.fixtureSets);
    expect(set && setMembers(result.document, set)).toEqual(["par/root"]);
    expect(resolveDocument(result.document).get("par/root")).toEqual({
      dimmer: 1,
      color: [1, 1, 1, 1],
    });
  });

  it("generates fresh ids every time", () => {
    const first = starterDocument("A", registry);
    const second = starterDocument("B", registry);
    expect(second.installation.id).not.toBe(first.installation.id);
    for (const table of [
      "universes",
      "fixtureSets",
      "scenes",
      "layers",
    ] as const)
      for (const id of Object.keys(first[table]))
        expect(second[table]).not.toHaveProperty(id);
  });

  it("validates as a Document", () => {
    const document = starterDocument("Club", registry);
    expect(DocumentSchema.safeParse(document).success).toBe(true);
  });
});
