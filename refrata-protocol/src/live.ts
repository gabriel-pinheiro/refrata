import { z } from "zod";

/**
 * Live state: what is happening right now around a document, replicated to
 * subscribers that ask for it (`subscribe` with `live: true`) but never
 * written to the file, never in undo history, and never versioned by the
 * document revision. It holds the OSC door's state, each Output's status,
 * the output loop's rate, and how each Fixture Type that came from the
 * library stands against it.
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
    /** Where the Output is delivering, or null: the serial path or USB port location opened. */
    path: z.string().nullable(),
    /** Frames delivered per second over the last second; a frame a device already holds counts without being sent again. */
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

/**
 * A Fixture Type from the library against the library's file: it matches,
 * it was edited here, the library's is newer, both changed, it is gone
 * from the library, or (for a type that remembers nothing of the library)
 * it differs with no direction known.
 */
export const FIXTURE_TYPE_STANDINGS = [
  "matches",
  "edited",
  "newer",
  "both",
  "gone",
  "differs",
] as const;
export const FixtureTypeStandingSchema = z.enum(FIXTURE_TYPE_STANDINGS);

export const LiveStateSchema = z
  .object({
    osc: OscLiveSchema,
    outputs: z.record(z.string(), OutputStatusSchema),
    dmx: DmxLiveSchema,
    /** By Fixture Type key, every type of the Installation whose origin is the library. */
    fixtureTypes: z.record(z.string(), FixtureTypeStandingSchema),
  })
  .strict();
export type LiveState = z.infer<typeof LiveStateSchema>;

export const EMPTY_LIVE_STATE: LiveState = {
  osc: { port: null, listeners: 0 },
  outputs: {},
  dmx: { rateHz: 0, fps: 0 },
  fixtureTypes: {},
};
