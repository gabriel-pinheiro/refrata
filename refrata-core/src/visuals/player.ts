import type {
  SlotOutput,
  VisualOutputs,
} from "../composition/visual-contributions.ts";
import type { Document } from "../document/document.ts";
import { geometryInput } from "../document/geometry.ts";
import { sceneVisualLayers } from "../document/layers.ts";
import { visualParameters, visualTargets } from "../document/visual-layers.ts";
import { settings } from "../settings.ts";
import { visualDefinition } from "./catalog.ts";
import type { Pose, VisualInstance } from "./sdk.ts";

interface Running {
  readonly visual: string;
  readonly instance: VisualInstance;
  cues: string[];
}

/**
 * The Visual instances of the playing Scene. One per Visual Layer, made
 * when the Layer is first seen in the active Scene, stepped every frame
 * whether the Layer is enabled or visible, and disposed when another Scene
 * plays, the Layer goes or it is given another Visual. No other edit
 * remakes one. The Runtime owns the one player; Studio and the CLI never
 * run a Visual. After each step the poses of the Geometry Visuals are
 * kept, for the Rig View to draw their figures.
 */
export class VisualPlayer {
  readonly #random: () => number;
  readonly #running = new Map<string, Running>();
  #sceneId: string | null = null;
  #poses: ReadonlyMap<string, Pose> = new Map();

  constructor(random: () => number = Math.random) {
    this.#random = random;
  }

  /** Disposes every instance; the next `step` makes them anew, which is what playing a Scene does. */
  restart(): void {
    for (const running of this.#running.values()) running.instance.dispose?.();
    this.#running.clear();
    this.#poses = new Map();
  }

  /** The pose of every Geometry Visual's instance after the last step, by Layer id. */
  poses(): ReadonlyMap<string, Pose> {
    return this.#poses;
  }

  /** Queues a Cue for a Layer's instance; dropped when the Layer has none. */
  cue(layerId: string, key: string): void {
    this.#running.get(layerId)?.cues.push(key);
  }

  /** Steps every instance by `dt` seconds and returns what each wrote. */
  step(document: Document, dt: number): VisualOutputs {
    const sceneId = document.installation.activeScene;
    if (sceneId !== this.#sceneId) this.restart();
    this.#sceneId = sceneId;
    const layers =
      sceneId === null ? [] : sceneVisualLayers(document.layers, sceneId);
    const present = new Set<string>(layers.map((layer) => layer.id));
    for (const [layerId, running] of this.#running)
      if (!present.has(layerId)) {
        running.instance.dispose?.();
        this.#running.delete(layerId);
      }

    const outputs = new Map<string, Map<string, Map<string, SlotOutput>>>();
    const poses = new Map<string, Pose>();
    const clamped = Math.min(Math.max(dt, 0), settings.visuals.maxFrameSeconds);
    for (const layer of layers) {
      const definition = visualDefinition(layer.visual);
      let running = this.#running.get(layer.id);
      if (running !== undefined && running.visual !== layer.visual) {
        running.instance.dispose?.();
        running = undefined;
        this.#running.delete(layer.id);
      }
      if (definition === undefined) continue;
      if (running === undefined) {
        running = {
          visual: layer.visual,
          instance: definition.create({ random: this.#random }),
          cues: [],
        };
        this.#running.set(layer.id, running);
      }
      for (const key of running.cues) running.instance.cue?.(key);
      running.cues = [];
      const output = new Map<string, Map<string, SlotOutput>>();
      const geometry =
        definition.geometry === undefined
          ? undefined
          : geometryInput(document, layer);
      running.instance.update(
        {
          dt: clamped,
          params: visualParameters(document, layer, definition),
          targets: visualTargets(document, layer).targets,
          ...(geometry === undefined ? {} : { geometry }),
        },
        (slot, target, value, alpha = 1) => {
          let byTarget = output.get(slot);
          if (byTarget === undefined) {
            byTarget = new Map();
            output.set(slot, byTarget);
          }
          byTarget.set(target.key, { value, alpha });
        },
      );
      outputs.set(layer.id, output);
      const pose = running.instance.pose?.();
      if (pose !== undefined) poses.set(layer.id, pose);
    }
    this.#poses = poses;
    return outputs;
  }
}
