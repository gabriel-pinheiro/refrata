import { DocumentSchema, ParameterValuesSchema } from "@refrata/core";
import { z } from "zod";

import { LiveStateSchema } from "./live.ts";

/**
 * The live protocol between the runtime and every client (Studio, CLI).
 * Two flows share one socket:
 *
 * - State: `subscribe` the document, receive one `snapshot`, then `delta`
 *   messages with per-path patches and a revision. A gap means resubscribe.
 *   Subscribing with `live: true` adds the live state to the snapshot and
 *   `live` messages afterwards.
 * - Input: `input` messages are unacknowledged latest-wins writes to an
 *   Address; the runtime coalesces them per tick and replicates the result
 *   as ordinary deltas. A fired trigger Address goes out as an `event` to
 *   every subscriber, after the deltas of the same tick, and is never
 *   stored or replayed.
 *
 * - Resolved Stream: `stream` names the Fixtures a session wants resolved
 *   values for (the whole set each time; empty stops it). The runtime
 *   answers with a `resolved` message holding every Element of those
 *   Fixtures, then `resolved` messages holding only what changed, coalesced
 *   to the stream rate.
 * - Pose stream: `poses` names the Layers whose Geometry Visual pose a
 *   session wants (a Rig View showing their Frames); the runtime answers
 *   with a `pose` message per Layer whenever it changes, coalesced to the
 *   stream rate, null for a Layer with no instance.
 * - Frame stream: `frames` names the Universes a session wants DMX Frames
 *   for, the same way. The runtime answers with a `frame` message holding
 *   all 512 bytes of each, then `frame` messages holding only the addresses
 *   whose byte changed, coalesced to the stream rate.
 *
 * `command` is a document-scoped acknowledged operation (registry commands,
 * undo, redo). `request` is a runtime-scoped one (documents, the library).
 *
 * A runtime holds one document at a time. It is still addressed by id so a
 * client can tell a replaced document from the one it subscribed to.
 */
export const PROTOCOL_VERSION = 1;

export const ClientKindSchema = z.enum(["studio", "cli", "desktop"]);
export type ClientKind = z.infer<typeof ClientKindSchema>;

const RequestId = z.string().min(1);
const DocumentIdSchema = z.string().min(1);

export const PatchSchema = z.discriminatedUnion("op", [
  z
    .object({
      op: z.literal("set"),
      path: z.array(z.string()).min(1),
      value: z.unknown(),
    })
    .strict(),
  z
    .object({ op: z.literal("remove"), path: z.array(z.string()).min(1) })
    .strict(),
]);

export const ClientMessageSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("hello"),
      protocolVersion: z.number().int(),
      client: z
        .object({
          kind: ClientKindSchema,
          name: z.string().optional(),
          /**
           * Stable identity that owns this client's undo history across
           * reconnects and invocations (a Studio browser, a CLI user). Defaults
           * to the session id.
           */
          actor: z.string().min(1).max(200).optional(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("subscribe"),
      documentId: DocumentIdSchema,
      /** Also receive the live state and its changes. */
      live: z.boolean().optional(),
    })
    .strict(),
  z
    .object({ type: z.literal("unsubscribe"), documentId: DocumentIdSchema })
    .strict(),
  z
    .object({
      type: z.literal("command"),
      requestId: RequestId,
      documentId: DocumentIdSchema,
      name: z.string().min(1),
      payload: z.unknown(),
    })
    .strict(),
  z
    .object({
      type: z.literal("request"),
      requestId: RequestId,
      name: z.string().min(1),
      payload: z.unknown(),
    })
    .strict(),
  z
    .object({
      type: z.literal("input"),
      documentId: DocumentIdSchema,
      address: z.string().min(1),
      value: z.unknown(),
    })
    .strict(),
  z
    .object({
      type: z.literal("stream"),
      documentId: DocumentIdSchema,
      /** Fixtures whose Elements the session wants resolved values for; the whole set, empty to stop. */
      fixtureIds: z.array(z.string().min(1)),
    })
    .strict(),
  z
    .object({
      type: z.literal("frames"),
      documentId: DocumentIdSchema,
      /** Universes whose DMX Frames the session wants; the whole set, empty to stop. */
      universeIds: z.array(z.string().min(1)),
    })
    .strict(),
  z
    .object({
      type: z.literal("poses"),
      documentId: DocumentIdSchema,
      /** Layers whose Geometry Visual pose the session wants; the whole set, empty to stop. */
      layerIds: z.array(z.string().min(1)),
    })
    .strict(),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

/** Resolved Parameter Values by Element reference (`<fixtureId>/<key>`); a partial record on updates. */
export const ResolvedValuesSchema = z.record(
  z.string().min(1),
  ParameterValuesSchema,
);
export type ResolvedValues = z.infer<typeof ResolvedValuesSchema>;

/** A Geometry Visual's pose: small numbers or lists of them, as the Visual reports it. */
export const PoseSchema = z.record(
  z.string().min(1),
  z.union([z.number(), z.array(z.number())]),
);
export type PoseValues = z.infer<typeof PoseSchema>;

/** Bytes of a DMX Frame by DMX Address (`"1"` to `"512"`); a partial record on updates. */
export const FrameBytesSchema = z.record(
  z.string().min(1),
  z.number().int().min(0).max(255),
);
export type FrameBytes = z.infer<typeof FrameBytesSchema>;

export const DocumentSummarySchema = z
  .object({
    id: DocumentIdSchema,
    name: z.string(),
    path: z.string().nullable(),
    dirty: z.boolean(),
    /** Loaded from an autosave newer than the file; cleared by save or revert. */
    recovered: z.boolean(),
    revision: z.number().int().nonnegative(),
  })
  .strict();
export type DocumentSummary = z.infer<typeof DocumentSummarySchema>;

/**
 * What a connection may do with the runtime's document. `free`: new, open,
 * close and save to another path are allowed. `pinned`: the runtime keeps the
 * file it was started with and refuses those.
 */
export const DocumentsModeSchema = z.enum(["pinned", "free"]);
export type DocumentsMode = z.infer<typeof DocumentsModeSchema>;

/** An entity a command added: the table it went into and its id. */
export const CreatedEntitySchema = z
  .object({ table: z.string(), id: z.string() })
  .strict();
export type CreatedEntity = z.infer<typeof CreatedEntitySchema>;

/** What an accepted `command` replies with (undo and redo included). */
export const CommandResultSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    changed: z.boolean(),
    label: z.string().optional(),
    /** What a best-effort command could not do, or what a removal took with it. */
    warnings: z.array(z.string()).optional(),
    /** Entities the command created, derived from its patches; empty is omitted. */
    created: z.array(CreatedEntitySchema).optional(),
    /** After a Macro run: how many actions its Run Mode picked, and how many passed their Chance. */
    run: z
      .object({
        picked: z.number().int().nonnegative(),
        fired: z.number().int().nonnegative(),
      })
      .strict()
      .optional(),
  })
  .strict();
export type CommandResult = z.infer<typeof CommandResultSchema>;

export const ServerMessageSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("welcome"),
      protocolVersion: z.number().int(),
      sessionId: z.string(),
      runtime: z.object({ name: z.string(), version: z.string() }).strict(),
      /** This connection's document mode; a runtime may answer peers differently. */
      documents: DocumentsModeSchema,
    })
    .strict(),
  /** The open document, or null; sent after welcome and on every change. */
  z
    .object({
      type: z.literal("document"),
      summary: DocumentSummarySchema.nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal("snapshot"),
      documentId: DocumentIdSchema,
      revision: z.number().int().nonnegative(),
      document: DocumentSchema,
      live: LiveStateSchema.optional(),
    })
    .strict(),
  /** Live-state patches, relative to the live root; not revisioned. */
  z
    .object({
      type: z.literal("live"),
      documentId: DocumentIdSchema,
      patches: z.array(PatchSchema),
    })
    .strict(),
  z
    .object({
      type: z.literal("delta"),
      documentId: DocumentIdSchema,
      /** The revision the patches apply on top of; a mismatch means resubscribe. */
      fromRevision: z.number().int().nonnegative(),
      revision: z.number().int().nonnegative(),
      patches: z.array(PatchSchema),
      originSessionId: z.string().optional(),
    })
    .strict(),
  /** Resolved values for streamed Fixtures: everything on (re)subscribe, then changes only. */
  z
    .object({
      type: z.literal("resolved"),
      documentId: DocumentIdSchema,
      /** True when the message holds every Element of every streamed Fixture. */
      full: z.boolean(),
      values: ResolvedValuesSchema,
    })
    .strict(),
  /** The DMX Frame of a streamed Universe: all 512 bytes on (re)subscribe, then changed addresses only. */
  z
    .object({
      type: z.literal("frame"),
      documentId: DocumentIdSchema,
      universeId: z.string().min(1),
      /** True when `bytes` holds every address. */
      full: z.boolean(),
      bytes: FrameBytesSchema,
    })
    .strict(),
  /** The pose of a streamed Layer's Geometry Visual, or null while its Scene is not playing. */
  z
    .object({
      type: z.literal("pose"),
      documentId: DocumentIdSchema,
      layerId: z.string().min(1),
      pose: PoseSchema.nullable(),
    })
    .strict(),
  /** A trigger Address fired; not revisioned. */
  z
    .object({
      type: z.literal("event"),
      documentId: DocumentIdSchema,
      address: z.string().min(1),
      originSessionId: z.string().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("reply"),
      requestId: RequestId,
      outcome: z.discriminatedUnion("ok", [
        z.object({ ok: z.literal(true), result: z.unknown() }).strict(),
        z
          .object({
            ok: z.literal(false),
            error: z.string(),
            /** One line per payload problem when the payload failed its schema. */
            issues: z.array(z.string()).optional(),
          })
          .strict(),
      ]),
    })
    .strict(),
  z.object({ type: z.literal("error"), message: z.string() }).strict(),
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;
