// Builds everything Desktop runs from into dist/, so the app never needs tsx
// or the rest of the repository at run time:
//
//   dist/main.js       the main process (ESM)
//   dist/preload.cjs   the preload script; a sandboxed preload must be one CommonJS file
//   dist/runtime.mjs   refrata-runtime and its JavaScript dependencies, in one file, forked by main
//   dist/node_modules  the runtime's native modules (see native-modules.mjs)
//   dist/studio        the built Studio, which that runtime serves
//   dist/library       the Fixture Library shipped with Desktop, which it reads
//
// Studio is built by its own package first (`npm run build` at the root does
// them in order; `npm run desktop` too).
import { build } from "esbuild";
import { access, cp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { copyNativeModules, NATIVE_MODULES } from "./native-modules.mjs";

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const repository = path.join(packageDir, "..");
const dist = path.join(packageDir, "dist");

const shared = {
  bundle: true,
  platform: "node",
  // Electron's bundled Node; `process.versions.node` inside the app says which.
  target: "node24",
  sourcemap: true,
  logLevel: "warning",
};

await rm(dist, { recursive: true, force: true });

await build({
  ...shared,
  entryPoints: [path.join(packageDir, "src/main.ts")],
  outfile: path.join(dist, "main.js"),
  format: "esm",
  // Provided by Electron itself at run time, in main and preload alike.
  external: ["electron"],
});

await build({
  ...shared,
  entryPoints: [path.join(packageDir, "src/preload.ts")],
  outfile: path.join(dist, "preload.cjs"),
  format: "cjs",
  external: ["electron"],
});

await build({
  ...shared,
  entryPoints: [path.join(repository, "refrata-runtime/src/main.ts")],
  outfile: path.join(dist, "runtime.mjs"),
  // ESM, because the runtime's main.ts uses top-level await. Its CommonJS
  // dependencies (fastify and friends) still call `require` for Node's
  // built-ins, which an ES module lacks until this banner gives it one.
  format: "esm",
  // Loaded from dist/node_modules at run time: a compiled addon cannot go
  // inside a JavaScript bundle. The runtime imports them on first use, so it
  // starts without them and says so on the Output that needed one.
  external: NATIVE_MODULES,
  banner: {
    js: 'import { createRequire as refrataCreateRequire } from "node:module";\nconst require = refrataCreateRequire(import.meta.url);',
  },
});

await copyNativeModules({
  from: path.join(repository, "refrata-runtime"),
  to: path.join(dist, "node_modules"),
});

const studio = path.join(repository, "refrata-studio/dist");
try {
  await access(studio);
} catch {
  console.error(
    "refrata-studio/dist is missing. Build it first: npm run build -w @refrata/studio",
  );
  process.exit(1);
}
await cp(studio, path.join(dist, "studio"), { recursive: true });
await cp(path.join(repository, "refrata-library"), path.join(dist, "library"), {
  recursive: true,
});
