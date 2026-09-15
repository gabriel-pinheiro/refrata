import {
  createBuiltInRegistry,
  emptyDocument,
  executeCommand,
} from "@refrata/core";
import { describe, expect, it } from "vitest";

import rgbJson from "../../../refrata-library/generic/rgb-3ch.json" with { type: "json" };
import { testerChannels } from "./tester-channels";

describe("testerChannels", () => {
  it("names held channels after the Fixture patched over them", () => {
    const registry = createBuiltInRegistry();
    const result = executeCommand(
      registry,
      emptyDocument("N"),
      "fixture.create",
      {
        id: "par",
        typeKey: "generic/rgb-3ch",
        modeKey: "3ch",
        fixtureType: rgbJson,
        name: "Par",
      },
    );
    if (!result.ok) throw new Error(result.error);
    const universeId = Object.keys(result.document.universes)[0] ?? "";
    const channels = testerChannels(result.document, {
      universeId,
      address: 2,
      values: [10, null, 0],
    });
    expect(channels).toEqual([
      { channel: 2, value: 10, name: "Par · green" },
      { channel: 3, value: null, name: "Par · blue" },
      { channel: 4, value: 0, name: undefined },
    ]);
  });
});
