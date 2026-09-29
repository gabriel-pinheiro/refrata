import type { Document } from "../document/document.ts";
import { allFixtures, fixtureElements } from "../document/fixtures.ts";
import type { Color, ParameterValue, ParameterValues } from "../parameters.ts";
import { elementRef, type ElementParameter } from "./elements.ts";
import type { ResolvedValuesByRef } from "./frames.ts";
import { nearestSwatch } from "./gamut.ts";

interface Wheel {
  /** The slot the wheel was last sent to, by its place among the swatches. */
  at: number;
  /** Seconds of dark left. */
  dark: number;
}

/**
 * Settle: hides a wheel's travel. Between Resolve and Encoding, it follows
 * every wheel whose Parameter declares a settle time and, when the swatch
 * asked is more than one slot from where the wheel was last sent, holds the
 * Element's `dimmer` at 0 for `base` plus `perSlot` per slot crossed, then
 * lets it go at once. Neighbouring slots change lit, since the beam only
 * ever shows the two colours asked. A change during the dark adds its own
 * slots to what is left. It reacts to the swatch, whatever moved it: a
 * Layer, a Fade, a Scene played, a Highlight. Under Blackout the wheel is
 * sent to the slot holding byte 0, so leaving Blackout settles from there.
 * A wheel first seen is taken to be where it is asked. The positions live
 * with whoever owns the output loop and outlast a Scene, as the wheel does.
 */
export class Settle {
  readonly #wheels = new Map<string, Wheel>();

  /** Forgets every wheel; the next `step` takes each to be where it is asked. */
  restart(): void {
    this.#wheels.clear();
  }

  /** Steps every wheel by `dt` seconds and returns `resolved` with the settling Elements dark. */
  step(
    document: Document,
    resolved: ResolvedValuesByRef,
    dt: number,
  ): ResolvedValuesByRef {
    const step = Math.max(dt, 0);
    const blackout = document.operational.blackout;
    const seen = new Set<string>();
    let settled: Map<string, ParameterValues> | undefined;
    for (const fixture of allFixtures(document.fixtures)) {
      for (const element of fixtureElements(document, fixture)) {
        const ref = elementRef(fixture.id, element.key);
        const values = resolved.get(ref);
        let dark = false;
        for (const [attribute, parameter] of Object.entries(
          element.parameters,
        )) {
          if (parameter.settle === undefined) continue;
          const key = `${ref}/${attribute}`;
          const asked = blackout
            ? restSlot(parameter)
            : askedSlot(parameter, values?.[attribute]);
          if (asked === undefined) continue;
          seen.add(key);
          if (this.#travel(key, asked, parameter.settle, step, blackout))
            dark = true;
        }
        const dimmer = element.parameters.dimmer;
        if (!dark || dimmer === undefined || values === undefined) continue;
        settled ??= new Map(resolved);
        settled.set(ref, {
          ...values,
          dimmer:
            dimmer.definition.kind === "number" ? dimmer.definition.min : 0,
        });
      }
    }
    for (const key of this.#wheels.keys())
      if (!seen.has(key)) this.#wheels.delete(key);
    return settled ?? resolved;
  }

  /** Moves one wheel toward the slot asked; true while it is dark. */
  #travel(
    key: string,
    asked: number,
    time: { readonly base: number; readonly perSlot: number },
    step: number,
    blackout: boolean,
  ): boolean {
    const wheel = this.#wheels.get(key);
    if (wheel === undefined || blackout) {
      this.#wheels.set(key, { at: asked, dark: 0 });
      return false;
    }
    wheel.dark = Math.max(0, wheel.dark - step);
    const slots = Math.abs(asked - wheel.at);
    if (wheel.dark > 0) wheel.dark += time.perSlot * slots;
    else if (slots > 1) wheel.dark = time.base + time.perSlot * slots;
    wheel.at = asked;
    return wheel.dark > 0;
  }
}

/** The place among the swatches of the one a colour lands on. */
function askedSlot(
  parameter: ElementParameter,
  value: ParameterValue | undefined,
): number | undefined {
  const swatches = parameter.swatches ?? [];
  if (!Array.isArray(value)) return undefined;
  const swatch = nearestSwatch(value as Color, swatches);
  return swatch === undefined ? undefined : swatches.indexOf(swatch);
}

/** The slot a wheel goes to when its Channel is sent 0, as under Blackout; undefined when no swatch holds it. */
function restSlot(parameter: ElementParameter): number | undefined {
  const index = (parameter.swatches ?? []).findIndex(
    ({ bytes: [low] }) => low === 0,
  );
  return index < 0 ? undefined : index;
}
