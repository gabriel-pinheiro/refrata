import { ballyhoo } from "./ballyhoo.ts";
import { chase } from "./chase.ts";
import { fan } from "./fan.ts";
import { figure } from "./figure.ts";
import { flyout } from "./flyout.ts";
import { counter } from "./counter.ts";
import { lfo } from "./lfo.ts";
import { meter } from "./meter.ts";
import { pump } from "./pump.ts";
import { radar } from "./radar.ts";
import { rainbow } from "./rainbow.ts";
import { reveal } from "./reveal.ts";
import { ripple } from "./ripple.ts";
import { roulette } from "./roulette.ts";
import type { VisualDefinition } from "./sdk.ts";
import { shimmer } from "./shimmer.ts";
import { shutter } from "./shutter.ts";
import { spectrum } from "./spectrum.ts";
import { sweep } from "./sweep.ts";
import { staticColor, staticNumber } from "./statics.ts";
import { strobe } from "./strobe.ts";
import { timer } from "./timer.ts";
import { wipe } from "./wipe.ts";

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
  figure,
  sweep,
  ballyhoo,
  fan,
  flyout,
  meter,
  counter,
  timer,
  reveal,
  roulette,
  wipe,
  radar,
  spectrum,
  ripple,
];

const byId = new Map(CATALOG.map((definition) => [definition.id, definition]));

export function visualDefinition(id: string): VisualDefinition | undefined {
  return byId.get(id);
}
