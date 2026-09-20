import { defaultParameterValues, type Color } from "../parameters.ts";
import { visualDefinition } from "./catalog.ts";
import type { VisualDefinition, VisualTarget } from "./sdk.ts";

/** What the Visual tests share: one instance run by hand, frame by frame. */
export const targetsOf = (keys: readonly string[]): VisualTarget[] =>
  keys.map((key, index) => ({ key, index, count: keys.length }));

/** A repeatable stand-in for Math.random. */
export function seeded(seed = 1): () => number {
  let state = seed;
  return () => {
    state = (state * 16_807) % 2_147_483_647;
    return state / 2_147_483_647;
  };
}

export function definitionOf(id: string): VisualDefinition {
  const definition = visualDefinition(id);
  if (definition === undefined) throw new Error(`No Visual ${id}.`);
  return definition;
}

/** Runs one instance; `frame` steps it and returns what it wrote as `slot → key → [value, alpha]`. */
export function play(
  id: string,
  overrides: Record<string, number | string | boolean | Color> = {},
) {
  const definition = definitionOf(id);
  const instance = definition.create({ random: seeded() });
  const params = {
    ...defaultParameterValues(definition.parameters),
    ...overrides,
  };
  return {
    params,
    cue: (key: string) => instance.cue?.(key),
    frame(dt: number, keys: readonly string[]) {
      const written: Record<
        string,
        Record<string, [number | Color, number]>
      > = {};
      instance.update(
        { dt, params, targets: targetsOf(keys) },
        (slot, target, value, alpha = 1) => {
          (written[slot] ??= {})[target.key] = [value, alpha];
        },
      );
      return written;
    },
  };
}

export const lit = (
  written: Record<string, Record<string, unknown>>,
  slot: string,
) => Object.keys(written[slot] ?? {});
