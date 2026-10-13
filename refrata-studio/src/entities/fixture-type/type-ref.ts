import type { Selection } from "@/selection/selection";

/**
 * What can be picked in the Fixture Editor, and how each pick is a
 * selection: one entity kind per thing, its id the type's key, then the
 * Mode's, then the thing's own, joined with a bar, which no key contains.
 */
export type Pick =
  | { readonly kind: "type" }
  | { readonly kind: "mode" }
  | { readonly kind: "channel"; readonly key: string }
  | { readonly kind: "element"; readonly key: string }
  | {
      readonly kind: "parameter";
      readonly element: string;
      readonly attribute: string;
    }
  | { readonly kind: "action"; readonly key: string };

const SEPARATOR = "|";

export const TYPE_KINDS = [
  "fixtureType",
  "typeMode",
  "typeChannel",
  "typeElement",
  "typeParameter",
  "typeAction",
] as const;
export type TypeKind = (typeof TYPE_KINDS)[number];

/** Where a pick lives: its type, its Mode, and the pick within it. */
export interface PickRef {
  readonly typeKey: string;
  /** Absent only for a pick of the type itself. */
  readonly modeKey: string | undefined;
  readonly pick: Pick;
}

/** The selection a pick is. */
export function pickSelection(
  typeKey: string,
  modeKey: string,
  pick: Pick,
): Selection {
  const id = (...parts: string[]): string =>
    [typeKey, modeKey, ...parts].join(SEPARATOR);
  switch (pick.kind) {
    case "type":
      return { kind: "fixtureType", id: typeKey };
    case "mode":
      return { kind: "typeMode", id: id() };
    case "channel":
      return { kind: "typeChannel", id: id(pick.key) };
    case "element":
      return { kind: "typeElement", id: id(pick.key) };
    case "parameter":
      return { kind: "typeParameter", id: id(pick.element, pick.attribute) };
    case "action":
      return { kind: "typeAction", id: id(pick.key) };
  }
}

/** The pick an entity kind and id stand for, or undefined when they are not one. */
export function parsePick(kind: string, id: string): PickRef | undefined {
  const [typeKey, modeKey, first, second] = id.split(SEPARATOR);
  if (typeKey === undefined || typeKey === "") return undefined;
  if (kind === "fixtureType")
    return { typeKey, modeKey: undefined, pick: { kind: "type" } };
  if (modeKey === undefined) return undefined;
  if (kind === "typeMode") return { typeKey, modeKey, pick: { kind: "mode" } };
  if (first === undefined) return undefined;
  if (kind === "typeChannel")
    return { typeKey, modeKey, pick: { kind: "channel", key: first } };
  if (kind === "typeElement")
    return { typeKey, modeKey, pick: { kind: "element", key: first } };
  if (kind === "typeAction")
    return { typeKey, modeKey, pick: { kind: "action", key: first } };
  if (kind === "typeParameter" && second !== undefined)
    return {
      typeKey,
      modeKey,
      pick: { kind: "parameter", element: first, attribute: second },
    };
  return undefined;
}

export const samePick = (a: Pick | undefined, b: Pick): boolean =>
  JSON.stringify(a) === JSON.stringify(b);
