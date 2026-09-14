import {
  ColorSchema,
  numberProblem,
  type NumberBounds,
  type ParameterValue,
} from "../parameters.ts";
import type { Controller, Document } from "../document/document.ts";
import { allFixtures, fixtureElements } from "../document/fixtures.ts";
import { lookLayers } from "../document/layers.ts";
import { orderedEntries } from "../document/order.ts";
import {
  rowDefinition,
  targetAttributes,
  targetLabel,
} from "../document/targets.ts";
import { flattenTree } from "../document/tree.ts";
import type { PatchPath } from "../document/patch.ts";
import { id as brand } from "../ids.ts";
import { isSetRef, SET_REF_PREFIX } from "../document/composition.ts";
import { isAttributeKey } from "../rig/attributes.ts";
import { elementRef } from "../rig/elements.ts";

/**
 * An Address names one controllable property or trigger in a Document, such
 * as `installation/blackout`, `controller/<id>/value` or
 * `layer/<id>/opacity`. Controllers, Macros, OSC and the CLI all read and
 * write Addresses, so adding an entry here makes a property reachable from
 * every control surface at once.
 *
 * A resolved Address carries everything a control needs: the value type,
 * the default, and for numbers the range and for choices the options. The
 * Studio inspector draws one row per Address from this alone.
 */
export type AddressValueType =
  "boolean" | "number" | "color" | "choice" | "trigger";

export type AddressValue = ParameterValue;

export interface NumberRange extends NumberBounds {
  readonly unit?: string;
  /** Shown as 0 to 100 with a percent sign; the value itself stays 0 to 1. */
  readonly percent?: boolean;
}

export interface ChoiceOption {
  readonly value: string;
  readonly label: string;
}

export interface ResolvedAddress {
  readonly address: string;
  /** The property's own name, such as "Value" or "Run". */
  readonly label: string;
  /** What the property belongs to, such as the Controller's name; absent for Installation-wide ones. */
  readonly owner?: string;
  readonly path: PatchPath;
  readonly type: AddressValueType;
  /** What the property starts at; a trigger has none. */
  readonly default?: AddressValue;
  readonly range?: NumberRange;
  readonly options?: readonly ChoiceOption[];
}

/** What resolving needs from a Document: the tables that own Addresses. */
export type AddressSource = Pick<
  Document,
  | "installation"
  | "controllers"
  | "macros"
  | "fixtures"
  | "fixtureTypes"
  | "fixtureSets"
  | "scenes"
  | "layers"
>;

/** A source with nothing but the given entities, for resolving one entity's own Addresses. */
export function addressSource(partial: Partial<AddressSource>): AddressSource {
  return {
    installation: {
      id: brand("installation", ""),
      name: "",
      activeScene: null,
      master: 1,
    },
    controllers: {},
    macros: {},
    fixtures: {},
    fixtureTypes: {},
    fixtureSets: {},
    scenes: {},
    layers: {},
    ...partial,
  };
}

interface AddressPattern {
  /**
   * Segments; `*` captures one entity id (never a name: names resolve to
   * ids in the CLI), and `<prefix>*` captures the rest of a segment that
   * starts with the prefix, which is how a Set Target stays one segment.
   */
  readonly pattern: readonly string[];
  resolve(
    source: AddressSource,
    captures: readonly string[],
  ): Omit<ResolvedAddress, "address"> | undefined;
  list(source: AddressSource): readonly (readonly string[])[];
}

const PERCENT = { min: 0, max: 1, step: 0.01, percent: true } as const;

/** The Address rows of one Target of a Look Layer, for the value or the alpha, resolved from a Target ref and an Attribute. */
function rowPattern(
  pattern: readonly string[],
  refOf: (captures: readonly string[]) => string,
  attributeOf: (captures: readonly string[]) => string,
  alpha: boolean,
): AddressPattern {
  return {
    pattern,
    resolve: (document, captures) => {
      const layerId = captures[0] ?? "";
      const layer = document.layers[layerId];
      if (layer?.kind !== "look") return undefined;
      const ref = refOf(captures);
      const attribute = attributeOf(captures);
      if (!layer.targets.some((target) => target.ref === ref)) return undefined;
      if (!isAttributeKey(attribute)) return undefined;
      if (!targetAttributes(document, ref).includes(attribute))
        return undefined;
      const definition = rowDefinition(document, ref, attribute);
      const owner = `${layer.name} · ${targetLabel(document, ref)}`;
      if (alpha) {
        if (layer.rows[ref]?.[attribute] === undefined) return undefined;
        return {
          label: `${definition.label} alpha`,
          owner,
          path: ["layers", layerId, "rows", ref, attribute, "alpha"],
          type: "number",
          default: 1,
          range: PERCENT,
        };
      }
      const base = {
        label: definition.label,
        owner,
        path: ["layers", layerId, "rows", ref, attribute, "value"] as const,
        default: definition.default,
      };
      switch (definition.kind) {
        case "number":
          return {
            ...base,
            type: "number",
            range: {
              min: definition.min,
              max: definition.max,
              ...(definition.unit === undefined
                ? {}
                : { unit: definition.unit }),
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
    },
    list: (document) => {
      const result: (readonly string[])[] = [];
      for (const layer of orderedEntries(document.layers)) {
        if (layer.kind !== "look") continue;
        for (const target of layer.targets) {
          const set = isSetRef(target.ref);
          if (set !== pattern.includes(`${SET_REF_PREFIX}*`)) continue;
          for (const attribute of targetAttributes(document, target.ref)) {
            if (alpha && layer.rows[target.ref]?.[attribute] === undefined)
              continue;
            const ref = set
              ? target.ref.slice(SET_REF_PREFIX.length)
              : target.ref;
            result.push([layer.id, ...ref.split("/"), attribute]);
          }
        }
      }
      return result;
    },
  };
}

const setRowRef = (captures: readonly string[]): string =>
  `${SET_REF_PREFIX}${captures[1] ?? ""}`;
const elementRowRef = (captures: readonly string[]): string =>
  elementRef(captures[1] ?? "", captures[2] ?? "");

const patterns: readonly AddressPattern[] = [
  {
    pattern: ["installation", "blackout"],
    resolve: () => ({
      label: "Blackout",
      path: ["operational", "blackout"],
      type: "boolean",
      default: false,
    }),
    list: () => [[]],
  },
  {
    pattern: ["installation", "master"],
    resolve: () => ({
      label: "Master",
      path: ["installation", "master"],
      type: "number",
      default: 1,
      range: PERCENT,
    }),
    list: () => [[]],
  },
  {
    // Held highlight of one Element: performance state, never saved.
    pattern: ["element", "*", "*", "highlight"],
    resolve: (document, [fixtureId = "", key = ""]) => {
      const fixture = document.fixtures[fixtureId];
      if (fixture?.kind !== "fixture") return undefined;
      const element = fixtureElements(document, fixture).find(
        (candidate) => candidate.key === key,
      );
      if (element === undefined) return undefined;
      return {
        label: "Highlight",
        owner:
          element.parentKey === null
            ? fixture.name
            : `${fixture.name} · ${element.name}`,
        path: ["operational", "highlight", elementRef(fixtureId, key)],
        type: "boolean",
        default: false,
      };
    },
    list: (document) =>
      allFixtures(document.fixtures).flatMap((fixture) =>
        fixtureElements(document, fixture).map((element) => [
          fixture.id,
          element.key,
        ]),
      ),
  },
  {
    pattern: ["scene", "*", "play"],
    resolve: (document, [id = ""]) => {
      const scene = document.scenes[id];
      if (scene === undefined) return undefined;
      return {
        label: "Play",
        owner: scene.name,
        path: ["scenes", id, "play"],
        type: "trigger",
      };
    },
    list: (document) =>
      orderedEntries(document.scenes).map((scene) => [scene.id]),
  },
  {
    pattern: ["layer", "*", "enabled"],
    resolve: (document, [id = ""]) => {
      const layer = document.layers[id];
      if (layer === undefined) return undefined;
      return {
        label: "Enabled",
        owner: layer.name,
        path: ["layers", id, "enabled"],
        type: "boolean",
        default: true,
      };
    },
    list: (document) =>
      orderedEntries(document.layers).map((layer) => [layer.id]),
  },
  {
    pattern: ["layer", "*", "opacity"],
    resolve: (document, [id = ""]) => {
      const layer = document.layers[id];
      if (layer?.kind !== "look") return undefined;
      return {
        label: "Opacity",
        owner: layer.name,
        path: ["layers", id, "opacity"],
        type: "number",
        default: 1,
        range: PERCENT,
      };
    },
    list: (document) => lookLayers(document.layers).map((layer) => [layer.id]),
  },
  rowPattern(
    ["layer", "*", "row", `${SET_REF_PREFIX}*`, "*"],
    setRowRef,
    (captures) => captures[2] ?? "",
    false,
  ),
  rowPattern(
    ["layer", "*", "row", `${SET_REF_PREFIX}*`, "*", "alpha"],
    setRowRef,
    (captures) => captures[2] ?? "",
    true,
  ),
  rowPattern(
    ["layer", "*", "row", "*", "*", "*"],
    elementRowRef,
    (captures) => captures[3] ?? "",
    false,
  ),
  rowPattern(
    ["layer", "*", "row", "*", "*", "*", "alpha"],
    elementRowRef,
    (captures) => captures[3] ?? "",
    true,
  ),
  {
    pattern: ["macro", "*", "run"],
    resolve: (document, [id = ""]) => {
      const macro = document.macros[id];
      if (macro === undefined || macro.kind === "group") return undefined;
      return {
        label: "Run",
        owner: macro.name,
        path: ["macros", id, "run"],
        type: "trigger",
      };
    },
    list: (document) =>
      flattenTree(document.macros)
        .filter((macro) => macro.kind === "macro")
        .map((macro) => [macro.id]),
  },
  {
    pattern: ["controller", "*", "value"],
    resolve: (document, [id = ""]) => {
      const controller = document.controllers[id];
      if (controller === undefined || controller.kind === "group")
        return undefined;
      const base = {
        label: "Value",
        owner: controller.name,
        path: ["controllers", id, "value"] as const,
      };
      return controller.kind === "number"
        ? { ...base, type: "number", range: PERCENT }
        : { ...base, type: "color" };
    },
    list: (document) =>
      orderedEntries(document.controllers)
        .filter((controller) => controller.kind !== "group")
        .map((controller) => [controller.id]),
  },
];

export function formatAddress(segments: readonly string[]): string {
  return segments.join("/");
}

/** The captures when `segments` fit `pattern`, or undefined. */
function matchPattern(
  pattern: readonly string[],
  segments: readonly string[],
): string[] | undefined {
  if (pattern.length !== segments.length) return undefined;
  const captures: string[] = [];
  for (const [index, expected] of pattern.entries()) {
    const actual = segments[index] ?? "";
    if (expected === "*") captures.push(actual);
    else if (expected.endsWith("*")) {
      const prefix = expected.slice(0, -1);
      if (!actual.startsWith(prefix) || actual.length === prefix.length)
        return undefined;
      captures.push(actual.slice(prefix.length));
    } else if (expected !== actual) return undefined;
  }
  return captures;
}

export function resolveAddress(
  document: AddressSource,
  address: string,
): ResolvedAddress | undefined {
  const segments = address.split("/");
  for (const candidate of patterns) {
    const captures = matchPattern(candidate.pattern, segments);
    if (captures === undefined) continue;
    const resolved = candidate.resolve(document, captures);
    return resolved === undefined ? undefined : { ...resolved, address };
  }
  return undefined;
}

/** Every Address currently reachable in the Document, for OSCQuery and the CLI. */
export function listAddresses(
  document: AddressSource,
): readonly ResolvedAddress[] {
  const result: ResolvedAddress[] = [];
  for (const candidate of patterns) {
    for (const captures of candidate.list(document)) {
      let captureIndex = 0;
      const segments = candidate.pattern.map((segment) =>
        segment === "*"
          ? (captures[captureIndex++] ?? "")
          : segment.endsWith("*")
            ? `${segment.slice(0, -1)}${captures[captureIndex++] ?? ""}`
            : segment,
      );
      const address = formatAddress(segments);
      const resolved = resolveAddress(document, address);
      if (resolved !== undefined) result.push(resolved);
    }
  }
  return result;
}

/** The value Address of a Controller; a Group has none. */
export function controllerAddress(
  controller: Controller,
): ResolvedAddress | undefined {
  return resolveAddress(
    addressSource({ controllers: { [controller.id]: controller } }),
    formatAddress(["controller", controller.id, "value"]),
  );
}

/**
 * Document tables whose Addresses a Controller may drive: a Layer's
 * opacity, enabled and rows, and the Installation's Master. A Controller's
 * own value and the operational switches (Blackout, Highlight) are sources
 * of control or Macro actions, never targets.
 */
export const LINKABLE_TABLES: readonly string[] = ["layers", "installation"];

/**
 * Whether a Controller of `kind` can drive `resolved`: Addresses in a
 * linkable table only, a Number Controller onto numbers and booleans, a
 * Color Controller onto colors. Choices have no scale to map onto.
 */
export function linkable(
  resolved: ResolvedAddress,
  kind: "number" | "color",
): boolean {
  if (!LINKABLE_TABLES.includes(resolved.path[0] ?? "")) return false;
  return kind === "number"
    ? resolved.type === "number" || resolved.type === "boolean"
    : resolved.type === "color";
}

/**
 * Why `value` cannot be written to `resolved`, or undefined when it can. A
 * number must be within the range and on its step grid, the same rule a
 * Parameter value is held to.
 */
export function addressValueProblem(
  resolved: ResolvedAddress,
  value: unknown,
): string | undefined {
  switch (resolved.type) {
    case "boolean":
      return typeof value === "boolean" ? undefined : "must be true or false";
    case "number":
      return numberProblem(resolved.range, value);
    case "color":
      return ColorSchema.safeParse(value).success
        ? undefined
        : "must be a color of four components from 0 to 1";
    case "choice":
      return resolved.options?.some((option) => option.value === value)
        ? undefined
        : `must be one of ${(resolved.options ?? []).map((option) => option.value).join(", ")}`;
    case "trigger":
      return value === undefined || value === null
        ? undefined
        : "is a trigger and takes no value";
  }
}

export function isValidAddressValue(
  resolved: ResolvedAddress,
  value: unknown,
): boolean {
  return addressValueProblem(resolved, value) === undefined;
}

/** Whether two Address values are the same; colors compare by component. */
export function sameAddressValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((item, index) => item === b[index]);
  return a === b;
}
