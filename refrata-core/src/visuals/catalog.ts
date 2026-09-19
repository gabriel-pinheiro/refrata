import { chase } from "./chase.ts";
import { circle } from "./circle.ts";
import { lfo } from "./lfo.ts";
import { rainbow } from "./rainbow.ts";
import type { VisualDefinition } from "./sdk.ts";
import { shimmer } from "./shimmer.ts";
import { staticColor, staticNumber } from "./statics.ts";

/** The Catalog: every Visual a Visual Layer can run, in the order a picker shows them. */
export const CATALOG: readonly VisualDefinition[] = [
  lfo,
  shimmer,
  chase,
  rainbow,
  staticNumber,
  staticColor,
  circle,
];

const byId = new Map(CATALOG.map((definition) => [definition.id, definition]));

export function visualDefinition(id: string): VisualDefinition | undefined {
  return byId.get(id);
}
