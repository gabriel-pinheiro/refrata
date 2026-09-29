import type { Document } from "../document/document.ts";
import { allFixtures, fixtureElements } from "../document/fixtures.ts";
import type { Color, ParameterValue, ParameterValues } from "../parameters.ts";
import { elementRef, type ElementParameter } from "./elements.ts";
import type { SettleTime } from "./fixture-type.ts";
import type { ResolvedValuesByRef } from "./frames.ts";
import { nearestSwatch } from "./gamut.ts";

interface Wheel {
  /** The slot the wheel was last sent to, by its place among the swatches. */
  at: number;
  /** Where the wheel has got to on its way there, in slots. */
  position: number;
  dark: boolean;
  /** Seconds of `base` left once the wheel has arrived. */
  hold: number;
}

/**
 * Settle: hides a wheel's travel. Between Resolve and Encoding, it follows
 * every wheel whose Parameter declares a settle time and, when the swatch
 * asked is more than one slot from where the wheel was last sent, holds the
 * Element's `dimmer` at 0 for `base` plus `perSlot` per slot crossed, then
 * lets it go at once. Neighbouring slots change lit, since the beam only
 * ever shows the two colours asked. The wheel is followed on its way, a
 * slot every `perSlot`, so a change during the dark settles from where the
 * wheel has got to and the dark never outlasts one travel of the whole
 * wheel. It reacts to the swatch, whatever moved it: a
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
    time: SettleTime,
    step: number,
    blackout: boolean,
  ): boolean {
    const wheel = this.#wheels.get(key);
    if (wheel === undefined || blackout) {
      this.#wheels.set(key, {
        at: asked,
        position: asked,
        dark: false,
        hold: 0,
      });
      return false;
    }
    const left = Math.abs(wheel.at - wheel.position) * time.perSlot;
    if (step < left)
      wheel.position +=
        (Math.sign(wheel.at - wheel.position) * step) / time.perSlot;
    else {
      wheel.position = wheel.at;
      wheel.hold -= step - left;
      if (wheel.hold <= 0) wheel.dark = false;
    }
    if (asked !== wheel.at) {
      if (wheel.dark || Math.abs(asked - wheel.position) > 1) {
        wheel.dark = true;
        wheel.hold = time.base;
      }
      wheel.at = asked;
    }
    return wheel.dark;
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
