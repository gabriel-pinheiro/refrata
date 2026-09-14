import type { ParameterValues } from "../parameters.ts";
import {
  ancestorsOf,
  elementRef,
  elementsOf,
  type Element,
} from "./elements.ts";
import { defaultsOf } from "./encoding.ts";
import type { Mode } from "./fixture-type.ts";

/**
 * Resolve with no Layers: every Parameter rests at its Default, and a
 * highlighted Element (or one below a highlighted ancestor) takes its
 * Highlight values where the Mode declares them. Slice 2 puts the stack
 * between the two.
 */
export function resolveMode(
  mode: Mode,
  fixtureId: string,
  highlighted: (ref: string) => boolean,
): ReadonlyMap<string, ParameterValues> {
  const elements = elementsOf(mode);
  const result = new Map<string, ParameterValues>();
  for (const element of elements) {
    const values = { ...defaultsOf(element) };
    if (isHighlighted(elements, element, fixtureId, highlighted)) {
      for (const [key, parameter] of Object.entries(element.parameters)) {
        if (parameter.highlight !== undefined)
          values[key] = parameter.highlight;
      }
    }
    result.set(element.key, values);
  }
  return result;
}

function isHighlighted(
  elements: readonly Element[],
  element: Element,
  fixtureId: string,
  highlighted: (ref: string) => boolean,
): boolean {
  return ancestorsOf(elements, element.key).some((ancestor) =>
    highlighted(elementRef(fixtureId, ancestor.key)),
  );
}
