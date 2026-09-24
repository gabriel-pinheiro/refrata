import { OUTPUT_LABELS, type Document } from "@refrata/core";
import type { LiveState, OscLive, OutputStatus } from "@refrata/protocol";

/**
 * What is happening around the runtime right now, read from the live state
 * a `live` subscription carries: the OSC door, the output loop and every
 * Output's status.
 */
export interface LiveStatus {
  readonly osc: OscLive;
  readonly dmx: LiveState["dmx"];
  readonly outputs: Readonly<Record<string, OutputStatus>>;
}

export function liveStatus(live: LiveState): LiveStatus {
  return { osc: live.osc, dmx: live.dmx, outputs: live.outputs };
}

/**
 * An Output as Studio shows it: "Universe 1 · Enttec DMX USB Pro", with its
 * device after when another Output would read the same; its id when the
 * replica does not hold it.
 */
export function outputLabel(
  document: Pick<Document, "outputs" | "universes"> | undefined,
  id: string,
): string {
  const output = document?.outputs[id];
  if (output === undefined) return id;
  const base = (candidate: typeof output): string =>
    `${document?.universes[candidate.universeId]?.name ?? candidate.universeId} · ${OUTPUT_LABELS[candidate.kind]}`;
  const label = base(output);
  const twin = Object.values(document?.outputs ?? {}).some(
    (other) => other.id !== output.id && base(other) === label,
  );
  return twin ? `${label} · ${output.device}` : label;
}

export function formatLiveStatus(
  status: LiveStatus,
  document?: Pick<Document, "outputs" | "universes">,
): string[] {
  const lines = [
    status.osc.port === null
      ? "OSC is off."
      : `OSC on port ${String(status.osc.port)}, ${String(status.osc.listeners)} OSCQuery ${status.osc.listeners === 1 ? "listener" : "listeners"}`,
    `DMX at ${String(status.dmx.rateHz)} Hz, ${String(status.dmx.fps)} fps`,
  ];
  for (const [id, output] of Object.entries(status.outputs))
    lines.push(
      `Output ${outputLabel(document, id)}: ${formatOutputStatus(output)}`,
    );
  return lines;
}

export function formatOutputStatus(output: OutputStatus): string {
  switch (output.state) {
    case "delivering":
      return `delivering on ${output.path ?? "?"} at ${String(output.fps)} fps`;
    case "device-missing":
      return `device missing${output.message === undefined ? "" : ` (${output.message})`}`;
    case "error":
      return `error${output.message === undefined ? "" : ` (${output.message})`}`;
  }
}
