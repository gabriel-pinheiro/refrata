import { z } from "zod";

/**
 * Live state: what is happening right now around a document, replicated to
 * subscribers that ask for it (`subscribe` with `live: true`) but never
 * written to the file, never in undo history, and never versioned by the
 * document revision. Today it holds the OSC door's state.
 */

/** The runtime's OSC door: which port, and how many OSCQuery clients listen for values. */
export const OscLiveSchema = z
  .object({ port: z.number().int().nullable(), listeners: z.number().int() })
  .strict();
export type OscLive = z.infer<typeof OscLiveSchema>;

export const LiveStateSchema = z.object({ osc: OscLiveSchema }).strict();
export type LiveState = z.infer<typeof LiveStateSchema>;

export const EMPTY_LIVE_STATE: LiveState = {
  osc: { port: null, listeners: 0 },
};
