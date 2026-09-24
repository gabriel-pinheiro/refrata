import { describe, expect, it } from "vitest";

import { addressLabel, formatTable } from "./read.ts";

describe("addresses listing", () => {
  it("labels a row with its owner so same-labelled rows differ", () => {
    expect(addressLabel({ owner: "Energy", label: "Value" })).toBe(
      "Energy · Value",
    );
    expect(addressLabel({ owner: "Base · Par", label: "Dimmer" })).toBe(
      "Base · Par · Dimmer",
    );
    expect(addressLabel({ label: "Blackout" })).toBe("Blackout");
  });

  it("sizes each column to its widest cell", () => {
    expect(
      formatTable([
        ["installation/blackout", "boolean", "false", "Blackout", ""],
        [
          "layer/layer_ab12/row/all/dimmer",
          "number",
          "1",
          "Base · All Targets · Dimmer",
          "",
        ],
        ["controller/c/value", "number", "0.5", "Energy · Value", "← x"],
      ]),
    ).toBe(
      [
        "installation/blackout            boolean  false  Blackout",
        "layer/layer_ab12/row/all/dimmer  number   1      Base · All Targets · Dimmer",
        "controller/c/value               number   0.5    Energy · Value               ← x",
      ].join("\n"),
    );
  });
});
