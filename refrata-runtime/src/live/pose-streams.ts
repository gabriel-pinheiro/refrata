import { settings, type Pose } from "@refrata/core";
import type { PoseValues } from "@refrata/protocol";

/**
 * One session's pose stream: the Layers whose Geometry Visual pose it asked
 * for, what it was last told, and a timer that sends the changes at the
 * stream rate. A Layer whose instance is gone (its Scene stopped playing)
 * is told null once; a Layer asked for is always told something first.
 */
export interface PoseMessage {
  readonly layerId: string;
  readonly pose: PoseValues | null;
}

export class PoseStream {
  #layerIds = new Set<string>();
  #sent = new Map<string, string>();
  #latest: ReadonlyMap<string, Pose> = new Map();
  #timer: ReturnType<typeof setTimeout> | undefined;
  readonly #send: (message: PoseMessage) => void;
  readonly #rateHz: number;

  constructor(
    send: (message: PoseMessage) => void,
    rateHz = Math.min(settings.stream.rateHz, settings.output.rateHz),
  ) {
    this.#send = send;
    this.#rateHz = rateHz;
  }

  get active(): boolean {
    return this.#layerIds.size > 0;
  }

  /** Replaces the streamed set; every Layer in it is told its pose again. */
  setLayers(
    layerIds: readonly string[],
    latest: ReadonlyMap<string, Pose>,
  ): void {
    this.#layerIds = new Set(layerIds);
    this.#sent.clear();
    this.#latest = latest;
    this.flush();
  }

  /** Another session took over the document: what was sent no longer stands. */
  restart(): void {
    this.#sent.clear();
  }

  /** The loop stepped again; what changed goes out on the next flush. */
  update(latest: ReadonlyMap<string, Pose>): void {
    this.#latest = latest;
    if (!this.active || this.#timer !== undefined) return;
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      this.flush();
    }, 1_000 / this.#rateHz);
  }

  /** Sends each streamed Layer's pose when it differs from what the session was last told. */
  flush(): void {
    for (const layerId of this.#layerIds) {
      const pose = this.#latest.get(layerId);
      const encoded = pose === undefined ? "null" : JSON.stringify(pose);
      if (this.#sent.get(layerId) === encoded) continue;
      this.#sent.set(layerId, encoded);
      this.#send({
        layerId,
        pose: pose === undefined ? null : (JSON.parse(encoded) as PoseValues),
      });
    }
  }

  close(): void {
    if (this.#timer !== undefined) clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#layerIds.clear();
    this.#sent.clear();
  }
}
