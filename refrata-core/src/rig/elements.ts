import {
  ColorSchema,
  type Color,
  type ParameterDefinition,
  type ParameterValue,
} from "../parameters.ts";
import {
  ATTRIBUTE_KEYS,
  ATTRIBUTES,
  isAttributeKey,
  type AttributeDefinition,
  type AttributeKey,
} from "./attributes.ts";
import {
  ROOT_ELEMENT_KEY,
  type Encode,
  type FixtureType,
  type Mode,
} from "./fixture-type.ts";

/**
 * Elements are derived from a Mode, never stored: a Fixture's Element tree
 * is the Mode's tree, and an Element is referenced everywhere as
 * `<fixtureId>/<key>`. A key is unique within its Mode, so the reference is
 * as stable as an id and survives a Mode change that keeps the key.
 */
export interface ElementParameter {
  readonly attribute: AttributeDefinition;
  /** The Parameter as a Control sees it: kind, label, range, default. */
  readonly definition: ParameterDefinition;
  readonly highlight: ParameterValue | undefined;
  readonly encode: Encode;
}

export interface Element {
  readonly key: string;
  readonly name: string;
  readonly parentKey: string | null;
  readonly depth: number;
  /** Keys of the children, in the Mode's order. */
  readonly children: readonly string[];
  /** Declared Tags plus the Element's own key. */
  readonly tags: readonly string[];
  readonly parameters: Readonly<
    Partial<Record<AttributeKey, ElementParameter>>
  >;
}

const derived = new WeakMap<Mode, readonly Element[]>();

/** The Elements of a Mode, depth first from the root in tree order; derived once per Mode object, since Modes never change in place. */
export function elementsOf(mode: Mode): readonly Element[] {
  const cached = derived.get(mode);
  if (cached !== undefined) return cached;
  const result = deriveElements(mode);
  derived.set(mode, result);
  return result;
}

function deriveElements(mode: Mode): readonly Element[] {
  const result: Element[] = [];
  const visit = (
    key: string,
    parentKey: string | null,
    depth: number,
  ): void => {
    const declared = mode.elements[key];
    if (declared === undefined) return;
    result.push({
      key,
      name: declared.name,
      parentKey,
      depth,
      children: declared.children,
      tags: [...new Set([key, ...declared.tags])],
      parameters: parametersOf(declared.parameters),
    });
    for (const child of declared.children) visit(child, key, depth + 1);
  };
  visit(ROOT_ELEMENT_KEY, null, 0);
  return result;
}

function parametersOf(
  declared: Mode["elements"][string]["parameters"],
): Element["parameters"] {
  const result: Partial<Record<AttributeKey, ElementParameter>> = {};
  // The vocabulary's order, whatever order the file (or a sorted save) used.
  const entries = Object.entries(declared).sort(
    ([a], [b]) =>
      ATTRIBUTE_KEYS.indexOf(a as AttributeKey) -
      ATTRIBUTE_KEYS.indexOf(b as AttributeKey),
  );
  for (const [key, parameter] of entries) {
    if (!isAttributeKey(key)) continue;
    const attribute = ATTRIBUTES[key];
    result[key] = {
      attribute,
      definition: definitionOf(attribute, parameter),
      highlight: parameter.highlight,
      encode: parameter.encode,
    };
  }
  return result;
}

function definitionOf(
  attribute: AttributeDefinition,
  parameter: Mode["elements"][string]["parameters"][string],
): ParameterDefinition {
  switch (attribute.kind) {
    case "number":
      return {
        kind: "number",
        label: attribute.label,
        min: parameter.min ?? attribute.min,
        max: parameter.max ?? attribute.max,
        default:
          typeof parameter.default === "number"
            ? parameter.default
            : attribute.default,
        ...((parameter.unit ?? attribute.unit)
          ? { unit: parameter.unit ?? attribute.unit }
          : {}),
        ...(attribute.percent === true ? { percent: true } : {}),
      };
    case "color":
      return {
        kind: "color",
        label: attribute.label,
        default: ColorSchema.safeParse(parameter.default).success
          ? (parameter.default as Color)
          : attribute.default,
      };
    case "choice":
      return {
        kind: "choice",
        label: attribute.label,
        options: attribute.options,
        default:
          typeof parameter.default === "string"
            ? parameter.default
            : attribute.default,
      };
    case "boolean":
      return {
        kind: "boolean",
        label: attribute.label,
        default:
          typeof parameter.default === "boolean"
            ? parameter.default
            : attribute.default,
      };
  }
}

/** The Mode of a Fixture Type by key, or undefined. */
export function modeOf(type: FixtureType, modeKey: string): Mode | undefined {
  return type.modes[modeKey];
}

/** `<fixtureId>/<key>`: how every Element is referenced. */
export function elementRef(fixtureId: string, key: string): string {
  return `${fixtureId}/${key}`;
}

export function parseElementRef(
  ref: string,
): { readonly fixtureId: string; readonly key: string } | undefined {
  const slash = ref.lastIndexOf("/");
  if (slash <= 0 || slash === ref.length - 1) return undefined;
  return { fixtureId: ref.slice(0, slash), key: ref.slice(slash + 1) };
}

/** The Element and every Element below it, in tree order. */
export function subtreeOf(
  elements: readonly Element[],
  key: string,
): readonly Element[] {
  const byKey = new Map(elements.map((element) => [element.key, element]));
  const result: Element[] = [];
  const visit = (current: string): void => {
    const element = byKey.get(current);
    if (element === undefined) return;
    result.push(element);
    for (const child of element.children) visit(child);
  };
  visit(key);
  return result;
}

/** The Element and its ancestors, nearest first, ending at the root. */
export function ancestorsOf(
  elements: readonly Element[],
  key: string,
): readonly Element[] {
  const byKey = new Map(elements.map((element) => [element.key, element]));
  const result: Element[] = [];
  let current = byKey.get(key);
  while (current !== undefined) {
    result.push(current);
    current =
      current.parentKey === null ? undefined : byKey.get(current.parentKey);
  }
  return result;
}
