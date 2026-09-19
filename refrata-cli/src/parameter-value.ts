import type { ParameterDefinition } from "@refrata/core";

import { parseValue } from "./connection.ts";

const ON = new Set(["true", "on", "yes", "1"]);
const OFF = new Set(["false", "off", "no", "0"]);

/**
 * What a person typed for a Visual Parameter, read by the Parameter's kind:
 * a number, a colour as `[r,g,b,a]` like a row takes, a choice's value as
 * text, a switch as on or off. Whether the value is acceptable is the
 * command's business; this only refuses what cannot be read at all.
 */
export function parseParameterValue(
  name: string,
  definition: ParameterDefinition,
  text: string,
): unknown {
  switch (definition.kind) {
    case "number": {
      const number = Number(text);
      if (text.trim() === "" || !Number.isFinite(number))
        throw new Error(`${name} is a number; “${text}” is not one.`);
      return number;
    }
    case "boolean": {
      const word = text.trim().toLowerCase();
      if (ON.has(word)) return true;
      if (OFF.has(word)) return false;
      throw new Error(`${name} is a switch; it takes on or off.`);
    }
    case "choice":
      return text;
    case "color": {
      const value = parseValue(text);
      if (!Array.isArray(value))
        throw new Error(
          `${name} is a colour; write it as [r,g,b,a] with each component from 0 to 1.`,
        );
      return value;
    }
  }
}
