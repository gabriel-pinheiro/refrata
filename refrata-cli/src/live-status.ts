import type { LiveState, OscLive } from "@refrata/protocol";

/**
 * What is happening around the runtime right now, read from the live state
 * a `live` subscription carries: today the OSC door.
 */
export interface LiveStatus {
  readonly osc: OscLive;
}

export function liveStatus(live: LiveState): LiveStatus {
  return { osc: live.osc };
}

export function formatLiveStatus(status: LiveStatus): string[] {
  return [
    status.osc.port === null
      ? "OSC is off."
      : `OSC on port ${String(status.osc.port)}, ${String(status.osc.listeners)} OSCQuery ${status.osc.listeners === 1 ? "listener" : "listeners"}`,
  ];
}
