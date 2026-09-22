import type { ParameterDefinition } from "../parameters.ts";
import {
  ATTRIBUTE_KEYS,
  ATTRIBUTES,
  type AttributeDefinition,
  type AttributeKey,
} from "../rig/attributes.ts";
import {
  elementRef,
  parseElementRef,
  subtreeOf,
  type Element,
} from "../rig/elements.ts";
import { parseSetRef, type MemberSet, type Target } from "./composition.ts";
import type { Document } from "./document.ts";
import { setMembers } from "./fixture-sets.ts";
import { fixtureElements } from "./fixtures.ts";
import type { PatchedFixture } from "./rig.ts";

/**
 * Targets and members resolved against the Rig. A Target ref is an Element
 * reference (`<fixtureId>/<key>`) or a Fixture Set (`set:<id>`); a Set
 * member is always an Element reference. Everything here reads the derived
 * Element trees, so a Mode change is seen at once.
 */
export interface LocatedElement {
  readonly ref: string;
  readonly fixture: PatchedFixture;
  readonly element: Element;
  /** Every Element of the Fixture's Mode, tree order. */
  readonly elements: readonly Element[];
}

export type TargetSource = Pick<
  Document,
  "fixtures" | "fixtureTypes" | "fixtureSets"
>;

/** The Element an Element reference names, with its Fixture and siblings; undefined when it does not exist. */
export function locateElement(
  document: Pick<Document, "fixtures" | "fixtureTypes">,
  ref: string,
): LocatedElement | undefined {
  const parsed = parseElementRef(ref);
  if (parsed === undefined) return undefined;
  const fixture = document.fixtures[parsed.fixtureId];
  if (fixture?.kind !== "fixture") return undefined;
  const elements = fixtureElements(document, fixture);
  const element = elements.find((candidate) => candidate.key === parsed.key);
  return element === undefined
    ? undefined
    : { ref, fixture, element, elements };
}

/** The Set a `set:<id>` ref names, or undefined. */
export function locateSet(
  document: Pick<Document, "fixtureSets">,
  ref: string,
): MemberSet | undefined {
  const setId = parseSetRef(ref);
  if (setId === undefined) return undefined;
  const set = document.fixtureSets[setId];
  return set?.kind === "set" ? set : undefined;
}

/**
 * The Elements a Target stands for: the Element itself, or a Set's members
 * in their order. Members that no longer exist are skipped.
 */
export function targetElements(
  document: TargetSource,
  ref: string,
): readonly LocatedElement[] {
  const set = locateSet(document, ref);
  if (set !== undefined)
    return setMembers(document, set).flatMap((member) => {
      const located = locateElement(document, member);
      return located === undefined ? [] : [located];
    });
  const located = locateElement(document, ref);
  return located === undefined ? [] : [located];
}

/** One thing a Layer renders into once Spread is applied. */
export interface ExpandedTarget {
  /** The Target entry this came from. */
  readonly source: string;
  /** The entry's own ref, or the member or child a spread entry became. */
  readonly ref: string;
  readonly elements: readonly LocatedElement[];
}

/**
 * A Layer's Targets with Spread applied, one level deep: a spread Set is
 * its ordered members and a spread Element its children in tree order, one
 * Target each; an Element without children stays itself. An entry that is
 * not spread is one Target standing for all its Elements.
 */
export function expandTargets(
  document: TargetSource,
  targets: readonly Target[],
): readonly ExpandedTarget[] {
  return targets.flatMap((target): ExpandedTarget[] => {
    const elements = targetElements(document, target.ref);
    if (!target.spread)
      return [{ source: target.ref, ref: target.ref, elements }];
    if (locateSet(document, target.ref) !== undefined)
      return elements.map((member) => ({
        source: target.ref,
        ref: member.ref,
        elements: [member],
      }));
    const parent = elements[0];
    if (parent === undefined) return [];
    if (parent.element.children.length === 0)
      return [{ source: target.ref, ref: target.ref, elements }];
    return parent.element.children.flatMap((key) => {
      const child = locateElement(document, elementRef(parent.fixture.id, key));
      return child === undefined
        ? []
        : [{ source: target.ref, ref: child.ref, elements: [child] }];
    });
  });
}

/** Every Attribute found across a Target's Elements and their descendants, in vocabulary order. */
export function targetAttributes(
  document: TargetSource,
  ref: string,
): readonly AttributeKey[] {
  const found = new Set<AttributeKey>();
  for (const located of targetElements(document, ref))
    for (const element of subtreeOf(located.elements, located.element.key))
      for (const key of Object.keys(element.parameters))
        found.add(key as AttributeKey);
  return ATTRIBUTE_KEYS.filter((key) => found.has(key));
}

/** The vocabulary's own definition of an Attribute, for rows on a Set. */
export function attributeDefinition(key: AttributeKey): ParameterDefinition {
  const attribute = ATTRIBUTES[key] as AttributeDefinition;
  switch (attribute.kind) {
    case "number":
      return {
        kind: "number",
        label: attribute.label,
        min: attribute.min,
        max: attribute.max,
        default: attribute.default,
        ...(attribute.unit === undefined ? {} : { unit: attribute.unit }),
        ...(attribute.percent === true ? { percent: true } : {}),
      };
    case "color":
      return {
        kind: "color",
        label: attribute.label,
        default: attribute.default,
      };
    case "choice":
      return {
        kind: "choice",
        label: attribute.label,
        options: attribute.options,
        default: attribute.default,
      };
    default:
      return {
        kind: "boolean",
        label: attribute.label,
        default: attribute.default,
      };
  }
}

/**
 * What a row on a Target for an Attribute is checked and drawn against: the
 * Element's own Parameter when it has one, else the vocabulary's definition
 * (a Set, or an Element that fans the Attribute down to its parts).
 */
export function rowDefinition(
  document: TargetSource,
  ref: string,
  attribute: AttributeKey,
): ParameterDefinition {
  const own = locateElement(document, ref)?.element.parameters[attribute];
  if (own !== undefined) return own.definition;
  const definition = attributeDefinition(attribute);
  if (definition.kind !== "choice") return definition;
  const options = unionOptions(document, ref, attribute);
  return options.length === 0 ? definition : { ...definition, options };
}

/**
 * The options a choice row offers over several Elements: the union of what
 * they declare, by value, in the order met, a wheel's slots after the
 * vocabulary's. A member without the chosen value stays at its default.
 */
function unionOptions(
  document: TargetSource,
  ref: string,
  attribute: AttributeKey,
): readonly { readonly value: string; readonly label: string }[] {
  const seen = new Map<string, string>();
  for (const located of targetElements(document, ref))
    for (const element of subtreeOf(located.elements, located.element.key)) {
      const definition = element.parameters[attribute]?.definition;
      if (definition?.kind !== "choice") continue;
      for (const option of definition.options)
        if (!seen.has(option.value)) seen.set(option.value, option.label);
    }
  return [...seen].map(([value, label]) => ({ value, label }));
}

/** "Strobe › Panel 3", "Par", or the Set's name; the ref itself when nothing has it. */
export function targetLabel(document: TargetSource, ref: string): string {
  const set = locateSet(document, ref);
  if (set !== undefined) return set.name;
  const located = locateElement(document, ref);
  if (located === undefined) return ref;
  return located.element.parentKey === null
    ? located.fixture.name
    : `${located.fixture.name} › ${located.element.name}`;
}

/** Why `ref` cannot be a Target, or undefined when it can. */
export function targetProblem(
  document: TargetSource,
  ref: string,
): string | undefined {
  if (parseSetRef(ref) !== undefined)
    return locateSet(document, ref) === undefined
      ? `Fixture Set “${ref}” does not exist.`
      : undefined;
  return memberProblem(document, ref);
}

/** Why `ref` cannot be a Set member, or undefined when it can. */
export function memberProblem(
  document: Pick<Document, "fixtures" | "fixtureTypes">,
  ref: string,
): string | undefined {
  const parsed = parseElementRef(ref);
  if (parsed === undefined)
    return `“${ref}” is not an Element reference (<fixtureId>/<key>).`;
  const fixture = document.fixtures[parsed.fixtureId];
  if (fixture?.kind !== "fixture")
    return `Fixture “${parsed.fixtureId}” does not exist.`;
  if (locateElement(document, ref) === undefined)
    return `${fixture.name} has no Element “${parsed.key}”.`;
  return undefined;
}

/** Whether an Element reference still names an Element of the Rig. */
export function elementExists(
  document: Pick<Document, "fixtures" | "fixtureTypes">,
  ref: string,
): boolean {
  return locateElement(document, ref) !== undefined;
}

/** The root Element reference of a Fixture. */
export function fixtureRootRef(fixtureId: string): string {
  return elementRef(fixtureId, "root");
}
