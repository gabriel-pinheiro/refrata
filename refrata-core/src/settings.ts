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
  },
} as const;
