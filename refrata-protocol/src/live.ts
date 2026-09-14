import { z } from "zod";

/**
 * Live state: what is happening right now around a document, replicated to
 * subscribers that ask for it (`subscribe` with `live: true`) but never
 * written to the file, never in undo history, and never versioned by the
 * document revision. It holds the OSC door's state and each Output's
 * status.
 */

/** The runtime's OSC door: which port, and how many OSCQuery clients listen for values. */
export const OscLiveSchema = z
  .object({ port: z.number().int().nullable(), listeners: z.number().int() })
  .strict();
export type OscLive = z.infer<typeof OscLiveSchema>;

export const OUTPUT_STATES = ["delivering", "device-missing", "error"] as const;
export type OutputState = (typeof OUTPUT_STATES)[number];

/** One Output's status: whether it is delivering, through which device, at what rate. */
export const OutputStatusSchema = z
  .object({
    state: z.enum(OUTPUT_STATES),
    /** The serial path actually opened, or null. */
    path: z.string().nullable(),
    /** Frames actually sent per second, measured over the last second. */
    fps: z.number(),
    /** What went wrong, for `error` and `device-missing`. */
    message: z.string().optional(),
  })
  .strict();
export type OutputStatus = z.infer<typeof OutputStatusSchema>;

/** The output loop: its rate and the frames it produced per second, Outputs or not. */
export const DmxLiveSchema = z
  .object({ rateHz: z.number(), fps: z.number() })
  .strict();
export type DmxLive = z.infer<typeof DmxLiveSchema>;

export const LiveStateSchema = z
  .object({
    osc: OscLiveSchema,
    outputs: z.record(z.string(), OutputStatusSchema),
    dmx: DmxLiveSchema,
  })
  .strict();
export type LiveState = z.infer<typeof LiveStateSchema>;

export const EMPTY_LIVE_STATE: LiveState = {
  osc: { port: null, listeners: 0 },
  outputs: {},
  dmx: { rateHz: 0, fps: 0 },
};
