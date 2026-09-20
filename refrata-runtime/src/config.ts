import { settings } from "@refrata/core";
import { DocumentsModeSchema, type DocumentsMode } from "@refrata/protocol";
import { parseArgs } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface RuntimeConfig {
  readonly host: string;
  readonly port: number;
  /**
   * `pinned`: the runtime keeps `openPath` open and refuses new, open, close
   * and save to another path. `free`: loopback clients may do all of those;
   * any other peer is still treated as pinned.
   */
  readonly documents: DocumentsMode;
  /** The file to open at startup; a pinned runtime always has one and creates it when missing. */
  readonly openPath: string | undefined;
  readonly studioDist: string | undefined;
  /** Where the bundled Fixture Type files live. */
  readonly libraryDir: string;
  readonly autosaveIntervalMs: number;
  /** OSC and OSCQuery port; undefined keeps the door closed. */
  readonly oscPort: number | undefined;
}

function nonEmpty(value: string | undefined): string | undefined {
  return value === undefined || value === "" ? undefined : value;
}

const packageRoot = fileURLToPath(new URL("../..", import.meta.url));

export function configFromEnvironment(
  argv: readonly string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): RuntimeConfig {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      host: { type: "string" },
      port: { type: "string" },
      documents: { type: "string" },
      "osc-port": { type: "string" },
      "no-osc": { type: "boolean" },
    },
  });
  if (positionals.length > 1)
    throw new Error(
      "A runtime holds one Installation; pass at most one .refrata file.",
    );
  const documents = DocumentsModeSchema.safeParse(
    values.documents ?? settings.runtime.documents,
  );
  if (!documents.success)
    throw new Error(
      `--documents takes "pinned" or "free", not “${String(values.documents)}”.`,
    );
  const file = positionals[0] ?? nonEmpty(env.REFRATA_FILE);
  if (documents.data === "pinned" && file === undefined)
    throw new Error(
      "Name the .refrata file to hold: refrata-runtime <file.refrata>, or set REFRATA_FILE. It is created when missing. Pass --documents free to start without one.",
    );
  return {
    host: values.host ?? env.REFRATA_HOST ?? settings.runtime.host,
    port: Number.parseInt(
      values.port ?? env.REFRATA_PORT ?? String(settings.runtime.port),
      10,
    ),
    documents: documents.data,
    openPath: file === undefined ? undefined : path.resolve(file),
    studioDist:
      env.REFRATA_STUDIO_DIST ??
      path.join(packageRoot, "refrata-studio", "dist"),
    libraryDir:
      env.REFRATA_LIBRARY_DIR ?? path.join(packageRoot, "refrata-library"),
    autosaveIntervalMs: settings.autosave.delayMs,
    oscPort:
      values["no-osc"] === true || env.REFRATA_NO_OSC === "1"
        ? undefined
        : Number.parseInt(
            values["osc-port"] ??
              env.REFRATA_OSC_PORT ??
              String(settings.osc.port),
            10,
          ),
  };
}
