/**
 * Every tunable in one place. Packages import from here instead of carrying
 * their own literals, so someone adjusting Refrata for their rig changes one
 * file. Command-line flags and environment variables override the runtime
 * values at startup (see `refrata-runtime/src/config.ts`).
 */
export const settings = {
  runtime: {
    host: "0.0.0.0",
    port: 4900,
    /** Where the live websocket is served. */
    livePath: "/live",
  },
  osc: {
    /** UDP for OSC input, HTTP and WebSocket for OSCQuery, all on this port. */
    port: 9100,
    /** How the runtime announces itself to Chataigne and other OSCQuery browsers. */
    name: "Refrata",
    /** Rejected OSC input is logged at most once per reason within this window. */
    rejectionLogIntervalMs: 5_000,
  },
  history: {
    /** Consecutive same-key entries from one actor within this window merge into one undo step. */
    coalesceWindowMs: 1_000,
    /** Oldest undo entries are dropped past this count. */
    limit: 500,
  },
  autosave: {
    /** Delay between the last change to a dirty document and its sidecar being written. */
    delayMs: 5_000,
    /** A run of changes never keeps a sidecar waiting longer than this since the previous write. */
    maxWaitMs: 30_000,
  },
  numbers: {
    /**
     * How far a number may sit off its step grid and still count as on it, as
     * a fraction of the step: float noise from JSON and sliders, not a value
     * between steps.
     */
    stepTolerance: 1e-9,
  },
  client: {
    /** First reconnect delay; doubles on each failure up to the maximum. */
    reconnectInitialMs: 500,
    reconnectMaxMs: 5_000,
  },
  cli: {
    connectTimeoutMs: 3_000,
    /** How long `refrata highlight` holds an Element lit before releasing it. */
    highlightHoldMs: 2_000,
    /** How long `refrata tester` holds its channels before releasing them, unless told otherwise. */
    testerHoldMs: 5_000,
  },
  output: {
    /** Resolve and DMX Frame rate; every frame goes to every Output. */
    rateHz: 40,
    /** How long the break line is held before a frame on an Open DMX widget. */
    openDmxBreakMs: 1,
  },
  stream: {
    /** Resolved Stream coalescing rate toward Studio; never above `output.rateHz`. */
    rateHz: 20,
  },
  highlight: {
    /** A held highlight is released by the runtime after this, in case the client vanished. */
    timeoutMs: 30_000,
  },
  tester: {
    /** The most channels one DMX Tester range holds: any single fixture fits, the tab stays a row of faders. */
    maxChannels: 64,
    /** The runtime releases the range when no client has touched it for this long. */
    timeoutMs: 15_000,
    /** How often a client holding the range touches it. */
    keepaliveMs: 5_000,
  },
  inspector: {
    /** A Look row's control wraps under its label when it would be narrower than this, in pixels. */
    controlWrapPx: 160,
  },
  rigView: {
    /** Side of one schematic shape cell, in metres; templates are laid out in these. */
    cellMetres: 0.25,
    /** Gap between a new Fixture and the rightmost existing one, in metres. */
    placementGapMetres: 0.25,
    /** Padding of the box drawn around a picked or outlined Fixture, as a fraction of a cell. */
    outlinePad: 0.12,
  },
} as const;
