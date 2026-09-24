import {
  DEFAULT_FADE,
  emptyDocument,
  id,
  type Document,
  type ResolvedAddress,
} from "@refrata/core";
import { describe, expect, it } from "vitest";

import { addressPlacer } from "./address-place.ts";

const document: Document = {
  ...emptyDocument("Club"),
  scenes: { s: { id: id("scene", "s"), name: "Intro", order: "a0" } },
  layers: {
    l: {
      id: id("layer", "l"),
      name: "Look",
      sceneId: id("scene", "s"),
      parentId: null,
      enabled: true,
      opacity: 1,
      fadeIn: DEFAULT_FADE,
      fadeOut: DEFAULT_FADE,
      order: "a0",
      kind: "look",
      blendMode: "normal",
      targets: [{ ref: "par/root", spread: false }],
      rows: {},
      all: {},
    },
  },
};

const row = (address: string, owner: string): ResolvedAddress => ({
  address,
  label: "Dimmer",
  owner,
  path: ["layers", "l", "all", "dimmer", "value"],
  type: "number",
  default: 0,
});

describe("addressPlacer", () => {
  it("keeps a Look row's owner from core, so the All Targets and a Target's rows read apart", () => {
    const place = addressPlacer(document);
    expect(
      place(row("layer/l/row/all/dimmer", "Look · All Targets")),
    ).toMatchObject({ group: "Intro", owner: "Look · All Targets" });
    expect(
      place(row("layer/l/row/par/root/dimmer", "Look · Par 1")),
    ).toMatchObject({ group: "Intro", owner: "Look · Par 1" });
  });

  it("falls back to the Layer's name for an Address without an owner", () => {
    const place = addressPlacer(document);
    expect(
      place({
        address: "layer/l/enabled",
        label: "Enabled",
        path: ["layers", "l", "enabled"],
        type: "boolean",
        default: true,
      }),
    ).toMatchObject({ group: "Intro", owner: "Look" });
    expect(
      place({
        address: "layer/gone/enabled",
        label: "Enabled",
        path: ["layers", "gone", "enabled"],
        type: "boolean",
      }),
    ).toBeUndefined();
  });
});
