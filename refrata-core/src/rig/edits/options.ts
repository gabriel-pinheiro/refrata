import { attributeInfo } from "../chart.ts";
import type {
  DeclaredOption,
  Mode,
  ParameterDeclaration,
} from "../fixture-type.ts";
import { freeKey, keyFromName, nextRange } from "../keys.ts";
import {
  asRange,
  rangeProblem,
  refuse,
  withElement,
  without,
  type Edited,
} from "./edit.ts";

export type Bytes = readonly [number, number];

/** The value an option labelled `label` takes among a Parameter's options, or undefined when the label has no letter or digit. */
export function optionValueFor(
  options: readonly DeclaredOption[],
  label: string,
): string | undefined {
  const base = keyFromName(label);
  return base === ""
    ? undefined
    : freeKey(
        base,
        options.map((option) => option.value),
      );
}

function optionsOf(
  mode: Mode,
  elementKey: string,
  attribute: string,
): Edited<{
  readonly parameter: ParameterDeclaration;
  readonly options: readonly DeclaredOption[];
}> {
  const parameter = mode.elements[elementKey]?.parameters[attribute];
  if (parameter === undefined)
    return refuse(`“${elementKey}” has no Parameter “${attribute}”.`);
  if (parameter.options === undefined)
    return refuse(
      `${attributeInfo(attribute).label} is not a choice and has no options.`,
    );
  return { parameter, options: parameter.options };
}

/** An Element's Parameters put through `change`. */
export function withParameters(
  mode: Mode,
  elementKey: string,
  change: (
    parameters: Readonly<Record<string, ParameterDeclaration>>,
  ) => Record<string, ParameterDeclaration>,
): Mode {
  const element = mode.elements[elementKey];
  if (element === undefined) return mode;
  return withElement(mode, elementKey, {
    ...element,
    parameters: change(element.parameters),
  });
}

/** Adds an option after the last. Its value comes from its label and never changes; its bytes start where the highest range ends unless told. */
export function addOption(
  mode: Mode,
  elementKey: string,
  attribute: string,
  option: { readonly label: string; readonly bytes?: Bytes | undefined },
): Edited<Mode> {
  const found = optionsOf(mode, elementKey, attribute);
  if ("error" in found) return found;
  const value = optionValueFor(found.options, option.label);
  if (value === undefined)
    return refuse("Give the option a name with a letter or a digit.");
  const bytes =
    option.bytes ?? nextRange(found.options.map((each) => each.bytes));
  if (bytes === undefined)
    return refuse(
      "The last range ends at 255. Make room, or give the option its bytes.",
    );
  const problem = rangeProblem(bytes);
  if (problem !== undefined) return refuse(problem);
  return withParameters(mode, elementKey, (parameters) => ({
    ...parameters,
    [attribute]: {
      ...found.parameter,
      options: [
        ...found.options,
        { value, label: option.label.trim(), bytes: asRange(bytes) },
      ],
    },
  }));
}

/** Relabels an option (its value stays) or changes its bytes. */
export function updateOption(
  mode: Mode,
  elementKey: string,
  attribute: string,
  value: string,
  change: {
    readonly label?: string | undefined;
    readonly bytes?: Bytes | undefined;
  },
): Edited<Mode> {
  const found = optionsOf(mode, elementKey, attribute);
  if ("error" in found) return found;
  if (!found.options.some((option) => option.value === value))
    return refuse(
      `${attributeInfo(attribute).label} has no option “${value}”.`,
    );
  if (change.label?.trim() === "") return refuse("An option needs a label.");
  const problem =
    change.bytes === undefined ? undefined : rangeProblem(change.bytes);
  if (problem !== undefined) return refuse(problem);
  return withParameters(mode, elementKey, (parameters) => ({
    ...parameters,
    [attribute]: {
      ...found.parameter,
      options: found.options.map((option) =>
        option.value === value
          ? {
              value,
              label: change.label?.trim() ?? option.label,
              bytes:
                change.bytes === undefined
                  ? option.bytes
                  : asRange(change.bytes),
            }
          : option,
      ),
    },
  }));
}

/** Removes an option but the last, with the range any `spread` holds for it; a Default or Highlight on it goes back to the first option. */
export function removeOption(
  mode: Mode,
  elementKey: string,
  attribute: string,
  value: string,
): Edited<Mode> {
  const found = optionsOf(mode, elementKey, attribute);
  if ("error" in found) return found;
  if (!found.options.some((option) => option.value === value))
    return refuse(
      `${attributeInfo(attribute).label} has no option “${value}”.`,
    );
  if (found.options.length === 1)
    return refuse(
      `${attributeInfo(attribute).label} needs at least one option.`,
    );
  return withParameters(mode, elementKey, (parameters) => {
    const next: Record<string, ParameterDeclaration> = {};
    for (const [key, parameter] of Object.entries(parameters)) {
      if (key === attribute) {
        const { default: resting, highlight, ...rest } = parameter;
        next[key] = {
          ...rest,
          ...(resting === undefined || resting === value
            ? {}
            : { default: resting }),
          ...(highlight === undefined || highlight === value
            ? {}
            : { highlight }),
          options: found.options.filter((option) => option.value !== value),
        };
      } else if (
        "spread" in parameter.encode &&
        parameter.encode.by === attribute &&
        value in parameter.encode.ranges
      )
        next[key] = {
          ...parameter,
          encode: {
            ...parameter.encode,
            ranges: without(parameter.encode.ranges, value),
          },
        };
      else next[key] = parameter;
    }
    return next;
  });
}
