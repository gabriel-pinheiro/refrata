import { settings } from "@refrata/core";
import path from "node:path";

/** Where the built pieces the runtime needs sit; `scripts/build.mjs` puts them next to `main.js`. */
export interface RuntimeLocations {
  /** The bundled runtime, one JavaScript file. */
  readonly script: string;
  readonly studioDist: string;
  /** The Fixture Library shipped with Desktop: read and watched by the runtime, never written. */
  readonly libraryDir: string;
}

/**
 * In a packaged Desktop `distDir` is inside the app's asar archive, where the
 * runtime's script loads fine but a folder does not behave as one: Node's
 * `access` does not find it and `fs.watch` cannot watch it. So Studio and the
 * Fixture Library are unpacked next to the archive (electron-builder.yml's
 * `asarUnpack`), and read from there. A checkout's `dist/` is left as it is.
 */
export function unpackedPath(file: string): string {
  return file.replace(/\.asar(?=[\\/]|$)/, ".asar.unpacked");
}

export function runtimeLocations(distDir: string): RuntimeLocations {
  return {
    script: path.join(distDir, "runtime.mjs"),
    studioDist: unpackedPath(path.join(distDir, "studio")),
    libraryDir: unpackedPath(path.join(distDir, "library")),
  };
}

function nonEmpty(value: string | undefined): string | undefined {
  return value === undefined || value === "" ? undefined : value;
}

/** `REFRATA_PORT` moves Desktop's runtime off the default port, as it does a standalone one. */
export function runtimePort(env: NodeJS.ProcessEnv): number {
  const port = Number.parseInt(env.REFRATA_PORT ?? "", 10);
  return Number.isInteger(port) && port > 0 && port < 65_536
    ? port
    : settings.runtime.port;
}

/**
 * The runtime's command line. `free` lets this machine's Studio create, open
 * and save Installations anywhere. Every interface, not loopback: a Studio or
 * CLI on another machine reaches this runtime too.
 */
export function runtimeArguments(options: {
  readonly port: number;
  readonly file: string | undefined;
}): string[] {
  return [
    "--documents",
    "free",
    "--host",
    settings.runtime.host,
    "--port",
    String(options.port),
    ...(options.file === undefined ? [] : [options.file]),
  ];
}

/**
 * The runtime's environment: Desktop's own, plus where the built Studio and
 * the Fixture Library are. The bundled runtime cannot find them relative to
 * its source files the way a checkout does. A `REFRATA_LIBRARY_DIR` of the
 * person's own is kept: that is how someone writing Fixture Types points
 * Desktop at their folder. Desktop decides the file, host and port on the
 * command line, so their variables do not travel.
 */
export function runtimeEnvironment(
  base: NodeJS.ProcessEnv,
  locations: RuntimeLocations,
): Record<string, string> {
  const { REFRATA_FILE, REFRATA_HOST, REFRATA_PORT, ...inherited } = base;
  const defined = Object.entries(inherited).filter(
    (entry): entry is [string, string] => entry[1] !== undefined,
  );
  return {
    ...Object.fromEntries(defined),
    REFRATA_STUDIO_DIST: locations.studioDist,
    REFRATA_LIBRARY_DIR:
      nonEmpty(base.REFRATA_LIBRARY_DIR) ?? locations.libraryDir,
  };
}
