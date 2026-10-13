import { describe, expect, it } from "vitest";

import { applyPatches } from "../document/patch.ts";
import { BEAM, edit, modeOf, refused, rigged, run } from "./type-stage.ts";

describe("type.action.add, update and remove", () => {
  it("adds an Action with a key from its name, on the last Channel unless told", () => {
    let document = edit(rigged(), "type.action.add", {
      ...BEAM,
      name: "Lamp On",
    }).document;
    expect(modeOf(document, BEAM).actions["lamp-on"]).toEqual({
      name: "Lamp On",
      channel: "control",
      byte: 255,
      seconds: 5,
    });
    document = edit(document, "type.action.update", {
      ...BEAM,
      action: "lamp-on",
      name: "Strike",
      channel: "auto",
      byte: 200,
      seconds: 2.5,
    }).document;
    expect(modeOf(document, BEAM).actions["lamp-on"]).toEqual({
      name: "Strike",
      channel: "auto",
      byte: 200,
      seconds: 2.5,
    });
    expect(
      refused(document, "type.action.update", {
        ...BEAM,
        action: "lamp-on",
        channel: "nope",
      }),
    ).toBe("The Mode has no Channel “nope”.");
    expect(
      refused(document, "type.action.update", { ...BEAM, action: "nope" }),
    ).toBe("The Mode has no Action “nope”.");
  });

  it("removes an Action, stopping it where it runs", () => {
    let document = rigged();
    document = run(document, "address.trigger", {
      address: "fixture/beam/action/reset",
    }).document;
    expect(document.operational.actions).toEqual({ "beam/reset": true });
    const removed = edit(document, "type.action.remove", {
      ...BEAM,
      action: "reset",
    });
    expect(modeOf(removed.document, BEAM).actions).toEqual({});
    expect(removed.document.operational.actions).toEqual({});
    expect(applyPatches(removed.document, removed.inverse)).toEqual(document);
  });
});
