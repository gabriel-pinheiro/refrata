import { chase } from "./chase.ts";
import { circle } from "./circle.ts";
import { counter } from "./counter.ts";
import { lfo } from "./lfo.ts";
import { meter } from "./meter.ts";
import { pump } from "./pump.ts";
import { rainbow } from "./rainbow.ts";
import { reveal } from "./reveal.ts";
import { roulette } from "./roulette.ts";
import type { VisualDefinition } from "./sdk.ts";
import { shimmer } from "./shimmer.ts";
import { shutter } from "./shutter.ts";
import { staticColor, staticNumber } from "./statics.ts";
import { strobe } from "./strobe.ts";
import { timer } from "./timer.ts";

/** The Catalog: every Visual a Visual Layer can run, in the order a picker shows them. */
export const CATALOG: readonly VisualDefinition[] = [
  lfo,
  shimmer,
  chase,
  strobe,
  shutter,
  pump,
  rainbow,
  staticNumber,
  staticColor,
  circle,
  meter,
  counter,
  timer,
  reveal,
  roulette,
];

const byId = new Map(CATALOG.map((definition) => [definition.id, definition]));

export function visualDefinition(id: string): VisualDefinition | undefined {
  return byId.get(id);
}
