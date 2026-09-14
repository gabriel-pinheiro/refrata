import {
  effectiveValue,
  flattenTree,
  listAddresses,
  qualifiedName,
  type AddressValue,
  type Color,
  type Controller,
  type Document,
  type ResolvedAddress,
} from "@refrata/core";

import { oscPathOfAddress } from "@refrata/protocol";

import type { OscArgument } from "./osc-codec.ts";

/**
 * The OSCQuery tree: what Chataigne browses and maps. One leaf per
 * Controller (`/controller/<id>`) and per Macro (`/macro/<id>`), as before,
 * and one per composition Address at its own path: `/scene/<id>/play`,
 * `/installation/master`, `/layer/<id>/opacity`, `/layer/<id>/enabled` and
 * every Look Layer row. Paths carry ids so a rename never breaks a mapping;
 * the name, with its owner, is the node's DESCRIPTION. A number is a float
 * with its range, a colour an RGBA colour, a switch T or F, a choice a
 * string, a trigger an impulse. Operational switches (Blackout, Highlight)
 * are not leaves: a hub reaches Blackout through a Macro.
 */
export interface OscNode {
  readonly FULL_PATH: string;
  readonly DESCRIPTION?: string;
  /** 0 none, 1 read, 2 write, 3 both. */
  readonly ACCESS: 0 | 1 | 2 | 3;
  readonly TYPE?: string;
  readonly VALUE?: readonly unknown[];
  readonly RANGE?: readonly {
    readonly MIN?: number;
    readonly MAX?: number;
    readonly VALS?: readonly string[];
  }[];
  readonly CLIPMODE?: readonly string[];
  readonly CONTENTS?: Readonly<Record<string, OscNode>>;
}

export const OSC_ATTRIBUTES = new Set([
  "ACCESS",
  "CLIPMODE",
  "CONTENTS",
  "DESCRIPTION",
  "FULL_PATH",
  "RANGE",
  "TYPE",
  "VALUE",
]);

/** What an incoming OSC path names: a Controller, a Macro, or any other document Address. */
export type OscTarget =
  | { readonly kind: "controller"; readonly id: string }
  | { readonly kind: "macro"; readonly id: string }
  | { readonly kind: "address"; readonly address: string };

const SEGMENT = /^[A-Za-z0-9_.:-]+$/;

/** The target an incoming address names; undefined for anything that is not a plain path (patterns included). */
export function targetOf(address: string): OscTarget | undefined {
  if (!address.startsWith("/") || address.endsWith("/")) return undefined;
  const segments = address.slice(1).split("/");
  if (segments.length < 2 || !segments.every((s) => SEGMENT.test(s)))
    return undefined;
  const [kind, id = ""] = segments;
  if (segments.length === 2 && kind === "controller") return { kind, id };
  if (segments.length === 2 && kind === "macro") return { kind, id };
  if (kind === "layer" && segments[2] === "row" && segments.at(-1) === "value")
    segments.pop();
  return { kind: "address", address: segments.join("/") };
}

function colorHex(color: Color): string {
  return `#${color
    .map((channel) =>
      Math.round(channel * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")
    .toUpperCase()}`;
}

/** A Controller's value as OSC arguments: one float, or one RGBA color. */
export function controllerArguments(
  controller: Controller,
): readonly OscArgument[] {
  if (controller.kind === "number")
    return [{ type: "float32", value: controller.value }];
  if (controller.kind === "color") return colorArguments(controller.value);
  return [];
}

function colorArguments(color: Color): readonly OscArgument[] {
  return [
    {
      type: "color",
      value: [
        Math.round(color[0] * 255),
        Math.round(color[1] * 255),
        Math.round(color[2] * 255),
        Math.round(color[3] * 255),
      ],
    },
  ];
}

/** An Address's current value as OSC arguments, by its type; a trigger has none. */
export function addressArguments(
  resolved: ResolvedAddress,
  value: AddressValue,
): readonly OscArgument[] {
  switch (resolved.type) {
    case "number":
      return [
        { type: "float32", value: typeof value === "number" ? value : 0 },
      ];
    case "boolean":
      return [{ type: value === true ? "true" : "false" }];
    case "color":
      return colorArguments(typeof value === "object" ? value : [0, 0, 0, 1]);
    case "choice":
      return [{ type: "string", value: String(value) }];
    case "trigger":
      return [];
  }
}

/** One leaf of the tree, kept flat for diffing between documents. */
export interface OscLeaf {
  readonly path: string;
  readonly target: OscTarget;
  readonly node: OscNode;
  /** The value as OSC arguments, sent to clients that LISTEN. */
  readonly args: readonly OscArgument[];
}

/** The node for one resolved Address showing `value`. */
function nodeOf(
  path: string,
  description: string,
  resolved: ResolvedAddress,
  value: AddressValue,
): OscNode {
  const base = { FULL_PATH: path, DESCRIPTION: description } as const;
  switch (resolved.type) {
    case "number": {
      const range = resolved.range ?? { min: 0, max: 1 };
      return {
        ...base,
        ACCESS: 3,
        TYPE: "f",
        VALUE: [typeof value === "number" ? value : 0],
        RANGE: [{ MIN: range.min, MAX: range.max }],
        CLIPMODE: ["both"],
      };
    }
    case "boolean":
      return {
        ...base,
        ACCESS: 3,
        TYPE: value === true ? "T" : "F",
        VALUE: [value === true],
      };
    case "color":
      return {
        ...base,
        ACCESS: 3,
        TYPE: "r",
        VALUE: [colorHex(typeof value === "object" ? value : [0, 0, 0, 1])],
      };
    case "choice":
      return {
        ...base,
        ACCESS: 3,
        TYPE: "s",
        VALUE: [String(value)],
        RANGE: [
          { VALS: (resolved.options ?? []).map((option) => option.value) },
        ],
      };
    case "trigger":
      return { ...base, ACCESS: 2, TYPE: "I" };
  }
}

/** Every leaf the document exposes: Controllers and Macros in navigator order, then the composition Addresses. */
export function leavesOf(document: Document | undefined): readonly OscLeaf[] {
  if (document === undefined) return [];
  const leaves: OscLeaf[] = [];
  for (const controller of flattenTree(document.controllers)) {
    if (controller.kind === "group") continue;
    const target: OscTarget = { kind: "controller", id: controller.id };
    const path = `/controller/${controller.id}`;
    const description = qualifiedName(document.controllers, controller);
    leaves.push({
      path,
      target,
      args: controllerArguments(controller),
      node:
        controller.kind === "number"
          ? {
              FULL_PATH: path,
              DESCRIPTION: description,
              ACCESS: 3,
              TYPE: "f",
              VALUE: [controller.value],
              RANGE: [{ MIN: 0, MAX: 1 }],
              CLIPMODE: ["both"],
            }
          : {
              FULL_PATH: path,
              DESCRIPTION: description,
              ACCESS: 3,
              TYPE: "r",
              VALUE: [colorHex(controller.value)],
            },
    });
  }
  for (const macro of flattenTree(document.macros)) {
    if (macro.kind === "group") continue;
    const target: OscTarget = { kind: "macro", id: macro.id };
    const path = `/macro/${macro.id}`;
    leaves.push({
      path,
      target,
      args: [],
      node: {
        FULL_PATH: path,
        DESCRIPTION: qualifiedName(document.macros, macro),
        ACCESS: 2,
        TYPE: "I",
      },
    });
  }
  for (const resolved of listAddresses(document)) {
    const [head] = resolved.address.split("/");
    if (
      head === "controller" ||
      head === "macro" ||
      resolved.path[0] === "operational"
    )
      continue;
    const path = oscPathOfAddress(resolved.address);
    const value =
      resolved.type === "trigger" ? "" : effectiveValue(document, resolved);
    const description =
      resolved.owner === undefined
        ? resolved.label
        : `${resolved.owner} · ${resolved.label}`;
    leaves.push({
      path,
      target: { kind: "address", address: resolved.address },
      args: addressArguments(resolved, value),
      node: nodeOf(path, description, resolved, value),
    });
  }
  return leaves;
}

const HEADINGS: Readonly<Record<string, string>> = {
  controller: "Controllers",
  macro: "Macros",
  scene: "Scenes",
  layer: "Layers",
  installation: "Installation",
};

interface MutableNode {
  FULL_PATH: string;
  DESCRIPTION?: string;
  ACCESS: 0 | 1 | 2 | 3;
  CONTENTS: Record<string, OscNode>;
}

export function buildTree(
  document: Document | undefined,
  leaves: readonly OscLeaf[] = leavesOf(document),
): OscNode {
  const root: MutableNode = {
    FULL_PATH: "/",
    DESCRIPTION: document?.installation.name ?? "No Installation open",
    ACCESS: 0,
    CONTENTS: {},
  };
  const containers = new Map<string, MutableNode>([["/", root]]);
  for (const [head, description] of Object.entries(HEADINGS)) {
    const node: MutableNode = {
      FULL_PATH: `/${head}`,
      DESCRIPTION: description,
      ACCESS: 0,
      CONTENTS: {},
    };
    containers.set(node.FULL_PATH, node);
    root.CONTENTS[head] = node;
  }
  for (const leaf of leaves) {
    const segments = leaf.path.slice(1).split("/");
    let parent = root;
    let path = "";
    for (const segment of segments.slice(0, -1)) {
      path += `/${segment}`;
      let container = containers.get(path);
      if (container === undefined) {
        container = { FULL_PATH: path, ACCESS: 0, CONTENTS: {} };
        containers.set(path, container);
        parent.CONTENTS[segment] = container;
      }
      parent = container;
    }
    const last = segments[segments.length - 1];
    if (last !== undefined) parent.CONTENTS[last] = leaf.node;
  }
  return root;
}

export function nodeAt(root: OscNode, path: string): OscNode | undefined {
  if (path === "/") return root;
  if (!path.startsWith("/") || path.endsWith("/")) return undefined;
  let node = root;
  for (const segment of path.slice(1).split("/")) {
    const child = node.CONTENTS?.[segment];
    if (child === undefined) return undefined;
    node = child;
  }
  return node;
}

/** What the OSCQuery HOST_INFO query answers: who this is and which doors are open. */
export function hostInfo(name: string, port: number): Record<string, unknown> {
  return {
    NAME: name,
    EXTENSIONS: {
      ACCESS: true,
      CLIPMODE: true,
      DESCRIPTION: true,
      RANGE: true,
      TYPE: true,
      VALUE: true,
      LISTEN: true,
      PATH_ADDED: true,
      PATH_REMOVED: true,
      PATH_CHANGED: true,
    },
    OSC_PORT: port,
    OSC_TRANSPORT: "UDP",
    WS_PORT: port,
  };
}
