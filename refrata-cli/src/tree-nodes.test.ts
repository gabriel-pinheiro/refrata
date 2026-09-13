import {
  createBuiltInRegistry,
  emptyDocument,
  executeCommand,
  type Document,
} from "@refrata/core";
import { describe, expect, it } from "vitest";

import {
  describeController,
  describeMacro,
  formatTreeNodes,
  treeNodes,
} from "./tree-nodes.ts";

const registry = createBuiltInRegistry();

function stage(): Document {
  let document = emptyDocument("Living");
  const steps: readonly (readonly [string, unknown])[] = [
    ["controller.create", { id: "ctl_g", kind: "group", name: "Looks" }],
    [
      "controller.create",
      { id: "ctl_t", kind: "color", name: "Tint", parentId: "ctl_g" },
    ],
    ["controller.create", { id: "ctl_e", kind: "number", name: "Energy" }],
    ["address.set", { address: "controller/ctl_e/value", value: 0.25 }],
    ["macro.create", { id: "mac_g", kind: "group", name: "Hits" }],
    ["macro.create", { id: "mac_h", name: "Hit", parentId: "mac_g" }],
    [
      "macro.actions.add",
      {
        macroId: "mac_h",
        actions: [{ kind: "toggle", address: "installation/blackout" }],
      },
    ],
    ["macro.create", { id: "mac_l", name: "Look" }],
  ];
  for (const [name, payload] of steps) {
    const result = executeCommand(registry, document, name, payload);
    if (!result.ok) throw new Error(result.error);
    document = result.document;
  }
  return document;
}

describe("treeNodes", () => {
  it("nests Controllers under their Groups in navigator order and describes each", () => {
    const document = stage();
    const nodes = treeNodes(document.controllers);
    expect(nodes.map((node) => node.id)).toEqual(["ctl_e", "ctl_g"]);
    expect(nodes[1]?.children.map((node) => node.id)).toEqual(["ctl_t"]);
    expect(formatTreeNodes(nodes, describeController)).toEqual([
      "Number “Energy”  ctl_e  value 25%",
      "Group “Looks”  ctl_g",
      "  Color “Tint”  ctl_t  value [1, 1, 1, 1]",
    ]);
  });

  it("does the same for Macros, with their action counts", () => {
    const document = stage();
    expect(formatTreeNodes(treeNodes(document.macros), describeMacro)).toEqual([
      "Macro “Look”  mac_l  0 actions",
      "Group “Hits”  mac_g",
      "  Macro “Hit”  mac_h  1 action",
    ]);
  });
});
