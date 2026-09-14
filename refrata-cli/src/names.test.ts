import {
  createBuiltInRegistry,
  emptyDocument,
  executeCommand,
  type Document,
} from "@refrata/core";
import { describe, expect, it } from "vitest";

import { stageLook } from "./composition-lines.test.ts";
import {
  resolveAddressNames,
  resolveId,
  resolvePathNames,
  resolvePayloadNames,
  resolveTargetRef,
} from "./names.ts";

const registry = createBuiltInRegistry();

function stage(): Document {
  let document = emptyDocument("Living");
  for (const [name, payload] of [
    ["controller.create", { id: "ctl_e", kind: "number", name: "Energy" }],
    ["controller.create", { id: "ctl_g", kind: "group", name: "Looks" }],
    [
      "controller.create",
      { id: "ctl_t", kind: "color", name: "Tint", parentId: "ctl_g" },
    ],
    ["controller.create", { id: "ctl_h", kind: "group", name: "Hits" }],
    [
      "controller.create",
      { id: "ctl_t2", kind: "color", name: "Tint", parentId: "ctl_h" },
    ],
    ["macro.create", { id: "mac_hit", name: "Hit" }],
    ["macro.create", { id: "mac_g", kind: "group", name: "Looks" }],
  ] as const) {
    const result = executeCommand(registry, document, name, payload);
    if (!result.ok) throw new Error(result.error);
    document = result.document;
  }
  return document;
}

describe("resolveId", () => {
  it("passes an existing id through, whatever the names", () => {
    const document = stage();
    expect(resolveId(document, "controllers", "ctl_e")).toBe("ctl_e");
    expect(resolveId(document, "macros", "mac_hit")).toBe("mac_hit");
  });

  it("finds the one entity with the name, ignoring case", () => {
    const document = stage();
    expect(resolveId(document, "controllers", "energy")).toBe("ctl_e");
    expect(resolveId(document, "macros", "HIT")).toBe("mac_hit");
    // The same name in another table is a different entity.
    expect(resolveId(document, "controllers", "Looks")).toBe("ctl_g");
    expect(resolveId(document, "macros", "Looks")).toBe("mac_g");
  });

  it("lists every candidate when the name is ambiguous, with where it lives", () => {
    const document = stage();
    expect(() => resolveId(document, "controllers", "Tint")).toThrow(
      "“Tint” matches 2 Controllers: Tint (ctl_t, in Group Looks), Tint (ctl_t2, in Group Hits)",
    );
  });

  it("names the table when nothing matches", () => {
    expect(() => resolveId(stage(), "macros", "nope")).toThrow(
      "No Macro is called or identified “nope”.",
    );
  });
});

describe("resolveAddressNames", () => {
  it("turns the entity segment of an Address into its id", () => {
    const document = stage();
    expect(resolveAddressNames(document, "controller/Energy/value")).toBe(
      "controller/ctl_e/value",
    );
    expect(resolveAddressNames(document, "macro/hit/run")).toBe(
      "macro/mac_hit/run",
    );
    expect(resolveAddressNames(document, "installation/blackout")).toBe(
      "installation/blackout",
    );
  });

  it("leaves an Address it does not know the shape of alone", () => {
    const document = stage();
    expect(resolveAddressNames(document, "controller/Energy")).toBe(
      "controller/Energy",
    );
    expect(resolveAddressNames(document, "thing/x/y")).toBe("thing/x/y");
  });
});

describe("resolveTargetRef", () => {
  it("names a Fixture's root, an Element, or a Set by id or name", () => {
    const document = stageLook();
    expect(resolveTargetRef(document, "Par")).toBe("par/root");
    expect(resolveTargetRef(document, "par")).toBe("par/root");
    expect(resolveTargetRef(document, "Strobe/panel-3")).toBe("strobe/panel-3");
    expect(resolveTargetRef(document, "set:Wash")).toBe("set:wash");
    expect(resolveTargetRef(document, "wash")).toBe("set:wash");
    expect(() => resolveTargetRef(document, "nope")).toThrow(
      "No Fixture or Fixture Set is called or identified “nope”",
    );
  });

  it("resolves the Target inside a row Address", () => {
    const document = stageLook();
    expect(resolveAddressNames(document, "layer/Base/row/Par/dimmer")).toBe(
      "layer/base/row/par/root/dimmer",
    );
    expect(
      resolveAddressNames(document, "layer/Base/row/Strobe/panel-3/color"),
    ).toBe("layer/base/row/strobe/panel-3/color");
    expect(
      resolveAddressNames(document, "layer/Base/row/Par/dimmer/alpha"),
    ).toBe("layer/base/row/par/root/dimmer/alpha");
    expect(
      resolveAddressNames(document, "layer/Base/row/set:Wash/color/alpha"),
    ).toBe("layer/base/row/set:wash/color/alpha");
    expect(resolveAddressNames(document, "layer/Base/row/wash/color")).toBe(
      "layer/base/row/set:wash/color",
    );
    expect(resolveAddressNames(document, "layer/Base/opacity")).toBe(
      "layer/base/opacity",
    );
  });
});

describe("resolvePathNames", () => {
  it("turns a name in a table path into its id and leaves an unknown one as typed", () => {
    const document = stage();
    expect(resolvePathNames(document, "controllers/Energy/value")).toBe(
      "controllers/ctl_e/value",
    );
    expect(resolvePathNames(document, "macros/hit")).toBe("macros/mac_hit");
    expect(resolvePathNames(document, "controllers/nope")).toBe(
      "controllers/nope",
    );
    expect(resolvePathNames(document, "installation/name")).toBe(
      "installation/name",
    );
    expect(() => resolvePathNames(document, "controllers/Tint/value")).toThrow(
      "matches 2 Controllers",
    );
  });
});

describe("resolvePayloadNames", () => {
  it("resolves ids by key, siblings by the command's table, and Addresses", () => {
    const document = stage();
    expect(
      resolvePayloadNames(document, "entity.move", {
        table: "macros",
        id: "Hit",
        after: "Looks",
      }),
    ).toEqual({ table: "macros", id: "mac_hit", after: "mac_g" });
    // A create's own id is the new one and stays as given.
    expect(
      resolvePayloadNames(document, "macro.create", {
        id: "Hit",
        name: "X",
        parentId: "looks",
      }),
    ).toEqual({ id: "Hit", name: "X", parentId: "mac_g" });
    expect(
      resolvePayloadNames(document, "controller.move", {
        controllerId: "Energy",
        parentId: "Looks",
        after: null,
      }),
    ).toEqual({ controllerId: "ctl_e", parentId: "ctl_g", after: null });
    expect(
      resolvePayloadNames(document, "link.create", {
        controllerId: "energy",
        addresses: ["controller/Energy/value", "installation/blackout"],
      }),
    ).toEqual({
      controllerId: "ctl_e",
      addresses: ["controller/ctl_e/value", "installation/blackout"],
    });
    expect(
      resolvePayloadNames(document, "macro.actions.add", {
        macroId: "Hit",
        actions: [
          { kind: "trigger", address: "macro/Hit/run" },
          { kind: "set", address: "controller/Energy/value", value: 1 },
        ],
      }),
    ).toEqual({
      macroId: "mac_hit",
      actions: [
        { kind: "trigger", address: "macro/mac_hit/run" },
        { kind: "set", address: "controller/ctl_e/value", value: 1 },
      ],
    });
  });

  it("leaves plain values alone and reports an ambiguous name", () => {
    const document = stage();
    expect(
      resolvePayloadNames(document, "controller.rename", {
        controllerId: "ctl_e",
        name: "Tint",
      }),
    ).toEqual({ controllerId: "ctl_e", name: "Tint" });
    expect(() =>
      resolvePayloadNames(document, "controller.remove", {
        controllerId: "Tint",
      }),
    ).toThrow("matches 2 Controllers");
  });
});
