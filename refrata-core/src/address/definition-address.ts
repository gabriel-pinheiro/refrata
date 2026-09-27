import type { ParameterDefinition } from "../parameters.ts";
import type { ResolvedAddress } from "./address.ts";

/**
 * What an Address of a row takes from the Parameter definition the row is
 * checked against: its value type and default, a number's range in the
 * Parameter's units, a choice's options.
 */
export function definitionAddress(
  definition: ParameterDefinition,
): Pick<ResolvedAddress, "type" | "default" | "range" | "options"> {
  const base = { default: definition.default };
  switch (definition.kind) {
    case "number":
      return {
        ...base,
        type: "number",
        range: {
          min: definition.min,
          max: definition.max,
          ...(definition.unit === undefined ? {} : { unit: definition.unit }),
          ...(definition.percent === true ? { percent: true } : {}),
        },
      };
    case "color":
      return { ...base, type: "color" };
    case "choice":
      return { ...base, type: "choice", options: definition.options };
    case "boolean":
      return { ...base, type: "boolean" };
  }
}
