import { settings } from "@refrata/core";
import { homedir } from "node:os";
import { parseArgs } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface RuntimeConfig {
  readonly host: string;
  readonly port: number;
  /** Where `.refrata` files live; relative paths in requests resolve here. */
  readonly projectsDir: string;
  /** The file to open at startup, if any. The runtime opens nothing else. */
  readonly openPath: string | undefined;
  readonly studioDist: string | undefined;
  readonly autosaveIntervalMs: number;
  /** OSC and OSCQuery port; undefined keeps the door closed. */
  readonly oscPort: number | undefined;
}

const packageRoot = fileURLToPath(new URL("../..", import.meta.url));

export function configFromEnvironment(
  argv: readonly string[] = process.argv.slice(2),
): RuntimeConfig {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      host: { type: "string" },
      port: { type: "string" },
      "projects-dir": { type: "string" },
      "osc-port": { type: "string" },
      "no-osc": { type: "boolean" },
    },
  });
  if (positionals.length > 1)
    throw new Error(
      "A runtime holds one Installation; pass at most one .refrata file.",
    );
  const env = process.env;
  return {
    host: values.host ?? env.REFRATA_HOST ?? settings.runtime.host,
    port: Number.parseInt(
      values.port ?? env.REFRATA_PORT ?? String(settings.runtime.port),
      10,
    ),
    projectsDir: path.resolve(
      values["projects-dir"] ??
        env.REFRATA_PROJECTS_DIR ??
        path.join(homedir(), "Refrata"),
    ),
    openPath:
      positionals[0] === undefined ? undefined : path.resolve(positionals[0]),
    studioDist:
      env.REFRATA_STUDIO_DIST ??
      path.join(packageRoot, "refrata-studio", "dist"),
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
