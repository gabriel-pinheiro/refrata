import {
  validateParameterValue,
  type ParameterValue,
} from "../../parameters.ts";
import { ATTRIBUTES, isAttributeKey } from "../attributes.ts";
import { attributeInfo } from "../chart.ts";
import { definitionOf } from "../elements.ts";
import type {
  Mode,
  ParameterDeclaration,
  SettleTime,
} from "../fixture-type.ts";
import { isEncodable, rulesFor } from "../rules.ts";
import { ruleProblem, withRule } from "./fresh-rule.ts";
import {
  refuse,
  withElement,
  withParameter,
  without,
  type Edited,
} from "./edit.ts";

/** Why an Element cannot take `attribute` as a new Parameter, or undefined when it can. */
export function attributeProblem(
  mode: Mode,
  elementKey: string,
  attribute: string,
): string | undefined {
  const element = mode.elements[elementKey];
  if (element === undefined) return `The Mode has no Element “${elementKey}”.`;
  if (!isAttributeKey(attribute)) return `“${attribute}” is not an Attribute.`;
  const { label } = ATTRIBUTES[attribute];
  if (!isEncodable(attribute))
    return `${label} has no Encoding rule yet, so a Mode cannot declare it.`;
  if (attribute in element.parameters)
    return `${element.name} already has ${label}.`;
  return undefined;
}

/** Why an Element cannot be given a Parameter of `attribute`: the Attribute does not fit, or its first rule has nothing to be filled in with. */
export function addParameterProblem(
  mode: Mode,
  elementKey: string,
  attribute: string,
): string | undefined {
  const problem = attributeProblem(mode, elementKey, attribute);
  if (problem !== undefined) return problem;
  const rule = rulesFor(attributeInfo(attribute).kind)[0];
  return rule === undefined
    ? undefined
    : ruleProblem(mode, elementKey, attribute, rule);
}

/** The spread of an Element that follows `attribute`, by its label, or undefined. */
function followerOf(
  parameters: Readonly<Record<string, ParameterDeclaration>>,
  attribute: string,
): string | undefined {
  const follower = Object.entries(parameters).find(
    ([, parameter]) =>
      "spread" in parameter.encode && parameter.encode.by === attribute,
  );
  return follower === undefined ? undefined : attributeInfo(follower[0]).label;
}

/** Adds a Parameter with the first Encoding rule that reads its Attribute's kind, pointed at the Element's Channels. */
export function addParameter(
  mode: Mode,
  elementKey: string,
  attribute: string,
): Edited<Mode> {
  const problem = attributeProblem(mode, elementKey, attribute);
  if (problem !== undefined) return refuse(problem);
  const element = mode.elements[elementKey];
  const rule = rulesFor(attributeInfo(attribute).kind)[0];
  if (element === undefined || rule === undefined)
    return refuse(`“${attribute}” has no Encoding rule.`);
  const parameter = withRule(mode, elementKey, attribute, {}, rule);
  if ("error" in parameter) return parameter;
  return withElement(mode, elementKey, {
    ...element,
    parameters: { ...element.parameters, [attribute]: parameter },
  });
}

/** Removes a Parameter no `spread` follows. */
export function removeParameter(
  mode: Mode,
  elementKey: string,
  attribute: string,
): Edited<Mode> {
  const element = mode.elements[elementKey];
  if (element?.parameters[attribute] === undefined)
    return refuse(`“${elementKey}” has no Parameter “${attribute}”.`);
  const follower = followerOf(element.parameters, attribute);
  if (follower !== undefined)
    return refuse(
      `${follower} follows ${attributeInfo(attribute).label}. Remove it or make it follow another Parameter first.`,
    );
  return withElement(mode, elementKey, {
    ...element,
    parameters: without(element.parameters, attribute),
  });
}

/**
 * Gives a Parameter another Attribute. One of the same kind keeps the
 * Encoding, the options, the swatches and whatever a `spread` holds for it;
 * another kind starts fresh. The range, unit, Default and Highlight are
 * the old Attribute's and start over.
 */
export function changeAttribute(
  mode: Mode,
  elementKey: string,
  attribute: string,
  to: string,
): Edited<Mode> {
  const element = mode.elements[elementKey];
  const current = element?.parameters[attribute];
  if (element === undefined || current === undefined)
    return refuse(`“${elementKey}” has no Parameter “${attribute}”.`);
  if (to === attribute) return mode;
  const rest = withElement(mode, elementKey, {
    ...element,
    parameters: without(element.parameters, attribute),
  });
  const problem = attributeProblem(rest, elementKey, to);
  if (problem !== undefined) return refuse(problem);
  if (attributeInfo(to).kind !== attributeInfo(attribute).kind) {
    const follower = followerOf(element.parameters, attribute);
    if (follower !== undefined)
      return refuse(
        `${follower} follows ${attributeInfo(attribute).label}. Remove it or make it follow another Parameter first.`,
      );
    const added = addParameter(rest, elementKey, to);
    if ("error" in added || current.notes === undefined) return added;
    const fresh = added.elements[elementKey]?.parameters[to];
    return fresh === undefined
      ? added
      : withParameter(added, elementKey, to, {
          ...fresh,
          notes: current.notes,
        });
  }
  const {
    default: _default,
    highlight: _highlight,
    min: _min,
    max: _max,
    unit: _unit,
    ...kept
  } = current;
  const parameters: Record<string, ParameterDeclaration> = {};
  for (const [key, parameter] of Object.entries(element.parameters)) {
    if (key === attribute) parameters[to] = kept;
    else if ("spread" in parameter.encode && parameter.encode.by === attribute)
      parameters[key] = {
        ...parameter,
        encode: { ...parameter.encode, by: to },
      };
    else parameters[key] = parameter;
  }
  return withElement(mode, elementKey, { ...element, parameters });
}

/** What `type.parameter.update` may change; null takes a value away, back to the Attribute's. */
export interface ParameterChange {
  readonly default?: ParameterValue | null | undefined;
  readonly highlight?: ParameterValue | null | undefined;
  readonly min?: number | null | undefined;
  readonly max?: number | null | undefined;
  /** An empty unit goes back to the Attribute's. */
  readonly unit?: string | undefined;
  /** Empty notes are removed. */
  readonly notes?: string | undefined;
  readonly settle?: SettleTime | null | undefined;
}

function withField<TKey extends keyof ParameterDeclaration>(
  parameter: ParameterDeclaration,
  key: TKey,
  value: ParameterDeclaration[TKey] | null | undefined,
): ParameterDeclaration {
  if (value === undefined) return parameter;
  const { [key]: _old, ...rest } = parameter;
  return (
    value === null ? rest : { ...rest, [key]: value }
  ) as ParameterDeclaration;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Changes what a Parameter declares over its Attribute. A Default or Highlight outside a new range moves to its nearest end. */
export function updateParameter(
  mode: Mode,
  elementKey: string,
  attribute: string,
  change: ParameterChange,
): Edited<Mode> {
  const element = mode.elements[elementKey];
  const current = element?.parameters[attribute];
  if (
    element === undefined ||
    current === undefined ||
    !isAttributeKey(attribute)
  )
    return refuse(`“${elementKey}” has no Parameter “${attribute}”.`);
  const attributeDefinition = ATTRIBUTES[attribute];
  const { label, kind } = attributeDefinition;
  const ranged =
    change.min !== undefined ||
    change.max !== undefined ||
    change.unit !== undefined;
  if (ranged && kind !== "number")
    return refuse(
      `${label} is a ${kind}; only a number has a range and a unit.`,
    );
  if (change.settle !== undefined && change.settle !== null) {
    if (current.swatches === undefined)
      return refuse("Settle is for a colour on a wheel.");
  }
  let next = withField(current, "min", change.min);
  next = withField(next, "max", change.max);
  next = withField(
    next,
    "unit",
    change.unit === undefined ? undefined : change.unit.trim() || null,
  );
  next = withField(
    next,
    "notes",
    change.notes === undefined ? undefined : change.notes.trim() || null,
  );
  next = withField(next, "settle", change.settle);
  next = withField(next, "default", change.default);
  next = withField(next, "highlight", change.highlight);
  const definition = definitionOf(attributeDefinition, next);
  if (definition.kind === "number") {
    if (definition.min >= definition.max)
      return refuse(
        `The lowest value, ${String(definition.min)}, must be below the highest, ${String(definition.max)}.`,
      );
    // A value the new range leaves outside goes to its nearest end.
    for (const field of ["default", "highlight"] as const) {
      const value = next[field];
      if (typeof value === "number" && change[field] === undefined)
        next = withField(
          next,
          field,
          clamp(value, definition.min, definition.max),
        );
    }
  }
  for (const field of ["default", "highlight"] as const) {
    const value = next[field];
    if (value === undefined) continue;
    const problem = validateParameterValue(definition, value);
    if (problem !== undefined)
      return refuse(
        `The ${field === "default" ? "Default" : "Highlight"} of ${label} ${problem}.`,
      );
  }
  return withElement(mode, elementKey, {
    ...element,
    parameters: { ...element.parameters, [attribute]: next },
  });
}
