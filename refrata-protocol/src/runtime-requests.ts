import { z } from "zod";

/**
 * Runtime-scoped requests: the document and files. These are not Document
 * commands; they manage which Document the runtime has open. Names and
 * payload schemas live here so the runtime, Studio and CLI agree.
 */
export const RuntimeRequestSchemas = {
  /** Replaces the open document with a new, unsaved one. */
  "documents.new": z
    .object({
      name: z.string().trim().min(1).max(120),
      /** Drop unsaved changes of the current document instead of failing. */
      discard: z.boolean().optional(),
    })
    .strict(),
  /** Replaces the open document with a file. */
  "documents.open": z
    .object({
      /**
       * Path relative to the runtime's projects directory, or absolute. When
       * an autosave newer than the file exists it is loaded instead and the
       * document opens dirty and `recovered`.
       */
      path: z.string().min(1),
      discard: z.boolean().optional(),
    })
    .strict(),
  "documents.save": z
    .object({
      documentId: z.string().min(1),
      /** Save As: a new path relative to the projects directory, or absolute. */
      path: z.string().min(1).optional(),
    })
    .strict(),
  /** Reload the file as last saved over the open document, dropping autosaves. */
  "documents.revert": z.object({ documentId: z.string().min(1) }).strict(),
  "documents.close": z
    .object({ documentId: z.string().min(1), discard: z.boolean().optional() })
    .strict(),
  "files.list": z.object({}).strict(),
  /** The Fixture Types the runtime knows: bundled files and anything the open Installation holds. */
  "library.list": z.object({}).strict(),
  /** One Fixture Type by key, the whole file, for a `fixture.create` payload. */
  "library.get": z.object({ key: z.string().min(1) }).strict(),
  /** The DMX Frame a Universe is sending right now, 512 bytes. */
  "dmx.frame": z
    .object({ documentId: z.string().min(1), universeId: z.string().min(1) })
    .strict(),
} as const;

export type RuntimeRequestName = keyof typeof RuntimeRequestSchemas;
export type RuntimeRequestPayload<TName extends RuntimeRequestName> = z.infer<
  (typeof RuntimeRequestSchemas)[TName]
>;

export const FileEntrySchema = z
  .object({
    path: z.string(),
    name: z.string(),
    modifiedAt: z.number(),
    /** True when an autosave sidecar newer than the file exists next to it. */
    recoveryAvailable: z.boolean(),
  })
  .strict();
export type FileEntry = z.infer<typeof FileEntrySchema>;

/** One Mode of a Fixture Type as the library lists it. */
export const LibraryModeSchema = z
  .object({ key: z.string(), name: z.string(), footprint: z.number().int() })
  .strict();
export type LibraryMode = z.infer<typeof LibraryModeSchema>;

/** One Fixture Type as the library lists it: enough to pick one. */
export const LibraryEntrySchema = z
  .object({
    key: z.string(),
    manufacturer: z.string(),
    model: z.string(),
    modes: z.array(LibraryModeSchema),
    /** Where it came from: a bundled file, or the open Installation. */
    source: z.enum(["library", "installation"]),
  })
  .strict();
export type LibraryEntry = z.infer<typeof LibraryEntrySchema>;

/** What `dmx.frame` replies: the Universe's 512 bytes. */
export const DmxFrameSchema = z
  .object({ universeId: z.string(), bytes: z.array(z.number().int()) })
  .strict();
export type DmxFrame = z.infer<typeof DmxFrameSchema>;

/** Undo and redo are document commands handled by the session, not the registry. */
export const HISTORY_COMMANDS = {
  undo: "history.undo",
  redo: "history.redo",
} as const;

export const HistoryCommandPayloadSchema = z
  .object({ global: z.boolean().optional() })
  .strict();
