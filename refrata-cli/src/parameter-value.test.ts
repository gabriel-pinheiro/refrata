import { visualDefinition, type ParameterSchema } from "@refrata/core";
import { describe, expect, it } from "vitest";

import { parseParameterValue } from "./parameter-value.ts";

const parameters: ParameterSchema = {
  ...visualDefinition("chase")?.parameters,
  flag: { kind: "boolean", label: "Flag", default: false },
};

function parse(name: string, text: string): unknown {
  const definition = parameters[name];
  if (definition === undefined) throw new Error(`No Parameter ${name}.`);
  return parseParameterValue(name, definition, text);
}

describe("parseParameterValue", () => {
  it("reads each kind the way the Parameter declares it", () => {
    expect(parse("rate", "2.5")).toBe(2.5);
    expect(parse("order", "bounce")).toBe("bounce");
    expect(parse("color", "[1,0,0,1]")).toEqual([1, 0, 0, 1]);
    expect(parse("flag", "on")).toBe(true);
    expect(parse("flag", "false")).toBe(false);
  });

  it("refuses what cannot be read as the kind", () => {
    expect(() => parse("rate", "fast")).toThrow(/is a number/);
    expect(() => parse("color", "white")).toThrow(/\[r,g,b,a\]/);
    expect(() => parse("flag", "maybe")).toThrow(/on or off/);
  });

  it("leaves a choice the Visual lacks for the command to refuse", () => {
    expect(parse("order", "sideways")).toBe("sideways");
  });
});
