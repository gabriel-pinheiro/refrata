import { attributeInfo } from "../chart.ts";
import type { Mode, ParameterDeclaration, Swatch } from "../fixture-type.ts";
import { nextRange } from "../keys.ts";
import { asRange, rangeProblem, refuse, type Edited } from "./edit.ts";
import { withParameters, type Bytes } from "./options.ts";

function swatchesOf(
  mode: Mode,
  elementKey: string,
  attribute: string,
): Edited<{
  readonly parameter: ParameterDeclaration;
  readonly swatches: readonly Swatch[];
}> {
  const parameter = mode.elements[elementKey]?.parameters[attribute];
  if (parameter === undefined)
    return refuse(`“${elementKey}” has no Parameter “${attribute}”.`);
  if (parameter.swatches === undefined)
    return refuse(
      `${attributeInfo(attribute).label} is not on a wheel and has no swatches.`,
    );
  return { parameter, swatches: parameter.swatches };
}

/** Adds a swatch after the last, white and starting where the highest range ends unless told. */
export function addSwatch(
  mode: Mode,
  elementKey: string,
  attribute: string,
  swatch: {
    readonly label?: string | undefined;
    readonly color?: readonly [number, number, number] | undefined;
    readonly bytes?: Bytes | undefined;
  } = {},
): Edited<Mode> {
  const found = swatchesOf(mode, elementKey, attribute);
  if ("error" in found) return found;
  const bytes =
    swatch.bytes ?? nextRange(found.swatches.map((each) => each.bytes));
  if (bytes === undefined)
    return refuse(
      "The last range ends at 255. Make room, or give the swatch its bytes.",
    );
  const problem = rangeProblem(bytes);
  if (problem !== undefined) return refuse(problem);
  if (swatch.label?.trim() === "") return refuse("A swatch needs a label.");
  const [red, green, blue] = swatch.color ?? [1, 1, 1];
  return withParameters(mode, elementKey, (parameters) => ({
    ...parameters,
    [attribute]: {
      ...found.parameter,
      swatches: [
        ...found.swatches,
        {
          label: swatch.label?.trim() ?? "New",
          color: [red, green, blue],
          bytes: asRange(bytes),
        },
      ],
    },
  }));
}

/** Changes the swatch at `index`, counted from 0 in wheel order. */
export function updateSwatch(
  mode: Mode,
  elementKey: string,
  attribute: string,
  index: number,
  change: {
    readonly label?: string | undefined;
    readonly color?: readonly [number, number, number] | undefined;
    readonly bytes?: Bytes | undefined;
  },
): Edited<Mode> {
  const found = swatchesOf(mode, elementKey, attribute);
  if ("error" in found) return found;
  const current = found.swatches[index];
  if (current === undefined)
    return refuse(
      `${attributeInfo(attribute).label} has no swatch ${String(index + 1)}.`,
    );
  if (change.label?.trim() === "") return refuse("A swatch needs a label.");
  const problem =
    change.bytes === undefined ? undefined : rangeProblem(change.bytes);
  if (problem !== undefined) return refuse(problem);
  const [red, green, blue] = change.color ?? current.color;
  const changed: Swatch = {
    label: change.label?.trim() ?? current.label,
    color: [red, green, blue],
    bytes: change.bytes === undefined ? current.bytes : asRange(change.bytes),
  };
  return withParameters(mode, elementKey, (parameters) => ({
    ...parameters,
    [attribute]: {
      ...found.parameter,
      swatches: found.swatches.map((swatch, at) =>
        at === index ? changed : swatch,
      ),
    },
  }));
}

/** Removes the swatch at `index`, but the last one a wheel has. */
export function removeSwatch(
  mode: Mode,
  elementKey: string,
  attribute: string,
  index: number,
): Edited<Mode> {
  const found = swatchesOf(mode, elementKey, attribute);
  if ("error" in found) return found;
  if (found.swatches[index] === undefined)
    return refuse(
      `${attributeInfo(attribute).label} has no swatch ${String(index + 1)}.`,
    );
  if (found.swatches.length === 1)
    return refuse("A wheel needs at least one swatch.");
  return withParameters(mode, elementKey, (parameters) => ({
    ...parameters,
    [attribute]: {
      ...found.parameter,
      swatches: found.swatches.filter((_, at) => at !== index),
    },
  }));
}
