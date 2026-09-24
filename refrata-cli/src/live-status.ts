import {
  outputStatusLine,
  type LiveState,
  type OscLive,
  type OutputSource,
  type OutputStatus,
} from "@refrata/protocol";

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

export function formatLiveStatus(
  status: LiveStatus,
  document?: OutputSource,
): string[] {
  const lines = [
    status.osc.port === null
      ? "OSC is off."
      : `OSC on port ${String(status.osc.port)}, ${String(status.osc.listeners)} OSCQuery ${status.osc.listeners === 1 ? "listener" : "listeners"}`,
    `DMX at ${String(status.dmx.rateHz)} Hz, ${String(status.dmx.fps)} fps`,
  ];
  for (const [id, output] of Object.entries(status.outputs))
    lines.push(`Output ${outputStatusLine(document, id, output)}`);
  return lines;
}
