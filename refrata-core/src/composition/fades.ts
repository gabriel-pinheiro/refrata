import { effectiveAt } from "../address/links.ts";
import type { Fade, FadeCurve, Layer } from "../document/composition.ts";
import type { Document } from "../document/document.ts";
import { sceneLayers } from "../document/layers.ts";

/** A curve's value at `t` from 0 to 1; every curve starts at 0, ends at 1 and stays inside. */
export function fadeCurve(curve: FadeCurve, t: number): number {
  const x = Math.min(1, Math.max(0, t));
  switch (curve) {
    case "linear":
      return x;
    case "ease-in":
      return x * x;
    case "ease-out":
      return 1 - (1 - x) * (1 - x);
    case "ease-in-out":
      return x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x);
    case "bounce":
      return bounce(x);
  }
}

/** The classic ease-out bounce: arrives, falls back three times smaller each, settles. */
function bounce(x: number): number {
  const n = 7.5625;
  const d = 2.75;
  if (x < 1 / d) return n * x * x;
  if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
  if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
  return n * (x -= 2.625 / d) * x + 0.984375;
}

interface Running {
  /** Where the envelope is now, 0 to 1. */
  value: number;
  /** Where it is going: 1 for enabled, 0 for disabled. */
  target: number;
  from: number;
  elapsed: number;
  duration: number;
  curve: FadeCurve;
}

/** Every fading or settled Layer's envelope by Layer id, 0 to 1. */
export type LayerEnvelopes = ReadonlyMap<string, number>;

/**
 * The Layer Fade envelopes of the playing Scene: one per Layer, Groups
 * included, stepped every frame by whoever owns the output loop. A fade
 * starts only when a Layer's effective `enabled` flips while its Scene is
 * playing; it samples that direction's time and curve at the flip, runs
 * from wherever the envelope is over the time scaled by the distance
 * left, and a flip back mid-fade starts the other direction from there.
 * A Layer first seen, a Scene played, opened or replaced, lands on its
 * final value with no fade.
 */
export class LayerFades {
  readonly #running = new Map<string, Running>();
  #sceneId: string | null = null;

  /** Forgets every envelope; the next `step` lands each Layer on its final value, which is what playing a Scene does. */
  restart(): void {
    this.#running.clear();
  }

  /** Steps every envelope by `dt` seconds and returns them. */
  step(document: Document, dt: number): LayerEnvelopes {
    const sceneId = document.installation.activeScene;
    if (sceneId !== this.#sceneId) this.restart();
    this.#sceneId = sceneId;
    const layers =
      sceneId === null ? [] : sceneLayers(document.layers, sceneId);
    const present = new Set<string>(layers.map((layer) => layer.id));
    for (const layerId of this.#running.keys())
      if (!present.has(layerId)) this.#running.delete(layerId);

    const envelopes = new Map<string, number>();
    const step = Math.max(dt, 0);
    for (const layer of layers) {
      const enabled =
        effectiveAt(document, `layer/${layer.id}/enabled`, layer.enabled) ===
        true;
      const target = enabled ? 1 : 0;
      let running = this.#running.get(layer.id);
      if (running === undefined) {
        running = {
          value: target,
          target,
          from: target,
          elapsed: 0,
          duration: 0,
          curve: "linear",
        };
        this.#running.set(layer.id, running);
      } else if (running.target !== target) {
        const fade = fadeOf(document, layer, enabled ? "fadeIn" : "fadeOut");
        running.target = target;
        running.from = running.value;
        running.elapsed = 0;
        running.duration = fade.time * Math.abs(target - running.value);
        running.curve = fade.curve;
      }
      if (running.value !== running.target) {
        running.elapsed += step;
        running.value =
          running.duration <= 0 || running.elapsed >= running.duration
            ? running.target
            : running.from +
              (running.target - running.from) *
                fadeCurve(running.curve, running.elapsed / running.duration);
      }
      envelopes.set(layer.id, running.value);
    }
    return envelopes;
  }
}

/** One direction's time and curve as they are right now, Controllers read. */
function fadeOf(
  document: Document,
  layer: Layer,
  direction: "fadeIn" | "fadeOut",
): Fade {
  const layerId = layer.id;
  const authored = layer[direction];
  const segment = direction === "fadeIn" ? "in" : "out";
  const time = effectiveAt(
    document,
    `layer/${layerId}/fade/${segment}/time`,
    authored.time,
  );
  const curve = effectiveAt(
    document,
    `layer/${layerId}/fade/${segment}/curve`,
    authored.curve,
  );
  return {
    time: typeof time === "number" ? time : authored.time,
    curve: typeof curve === "string" ? (curve as FadeCurve) : authored.curve,
  };
}
