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
    /**
     * Where the open document travels as a `.refrata` file: GET downloads a
     * copy, PUT replaces its content.
     */
    documentPath: "/document",
    /** The largest `.refrata` file a PUT there may carry. */
    maxDocumentBytes: 64 * 1024 * 1024,
    /**
     * Document mode when `--documents` is not given. `pinned` keeps the file
     * the runtime was started with; `free` lets loopback clients create, open
     * and close Installations and save them elsewhere.
     */
    documents: "pinned",
  },
  osc: {
    /** UDP for OSC input, HTTP and WebSocket for OSCQuery, all on this port. */
    port: 9100,
    /** How the runtime announces itself to Chataigne and other OSCQuery browsers. */
    name: "Refrata",
    /** Rejected OSC input is logged at most once per reason within this window. */
    rejectionLogIntervalMs: 5_000,
  },
  discovery: {
    /** The DNS-SD service the runtime announces on its HTTP port: `_refrata._tcp`. */
    serviceType: "refrata",
    /** The instance is "<name> on <hostname>", like the OSC one. */
    name: "Refrata",
    /** A run of document changes re-announces the TXT record once, this long after the last. */
    txtUpdateDelayMs: 1_000,
    /** How long `refrata runtimes` listens for answers. */
    browseMs: 1_500,
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
    /** How long to wait before looking again for a widget that is missing or failed. */
    deviceRetryMs: 2_000,
    /** A frame's send that has neither landed nor failed after this counts as failed, so a hung widget is let go and looked for again. */
    sendTimeoutMs: 1_000,
  },
  visuals: {
    /** The longest step a Visual is handed, so a stalled tick does not jump an animation. */
    maxFrameSeconds: 0.1,
    /** Automatic firings a Visual makes in one frame at most, whatever its rate. */
    maxFiringsPerFrame: 16,
  },
  stream: {
    /** Resolved Stream coalescing rate toward Studio; never above `output.rateHz`. */
    rateHz: 20,
  },
  highlight: {
    /** A held highlight is released by the runtime after this, in case the client vanished. */
    timeoutMs: 30_000,
  },
  library: {
    /** Library file changes are gathered this long before the library is read again, since an editor's save is several events. */
    watchDebounceMs: 250,
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
  desktop: {
    /** How long Desktop waits for the runtime it started to answer `/health`. */
    runtimeStartTimeoutMs: 15_000,
    /** The first wait between two `/health` attempts; doubles up to the maximum. */
    healthPollInitialMs: 50,
    healthPollMaxMs: 500,
    /** How long the runtime gets to flush and exit on quit before it is killed. */
    runtimeStopTimeoutMs: 5_000,
    /** The Studio window's size on first show. */
    windowWidth: 1440,
    windowHeight: 900,
  },
} as const;
