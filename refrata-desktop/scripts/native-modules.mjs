// The runtime's native modules, carried next to the bundled runtime.
//
// `serialport` and `usb` reach the hardware through compiled addons (`.node`
// files), which esbuild cannot put inside `runtime.mjs`. They stay ordinary
// packages: the bundle leaves `import("serialport")` and `import("usb")` as
// they are, and Node resolves them from `dist/node_modules`, the folder next
// to the file doing the import. So `dist/` still runs without the repository.
//
// Both ship prebuilt N-API addons. N-API is the addon interface that stays the
// same across Node versions, which is why the binaries npm installed for
// system Node load unchanged in the Node inside Electron, with no rebuild.
import { cp, readFile } from "node:fs/promises";
import path from "node:path";

/** What the runtime bundle leaves as imports. */
export const NATIVE_MODULES = ["serialport", "usb"];

/** The folder of `name` as Node would find it from `fromDir`: the nearest node_modules up the tree. */
async function packageDir(name, fromDir) {
  for (let dir = fromDir; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, "node_modules", name);
    try {
      await readFile(path.join(candidate, "package.json"));
      return candidate;
    } catch {
      if (dir === path.dirname(dir)) return undefined;
    }
  }
}

/**
 * Copies `NATIVE_MODULES` and everything they depend on into `to`, keeping
 * each package where Node looks for it (a nested `node_modules` stays
 * nested). Optional dependencies are how `usb` brings the addon of the
 * platform npm installed on; the ones of other platforms are not there and
 * are skipped. `@types/*` packages are for the compiler only.
 */
export async function copyNativeModules({ from, to }) {
  const copied = new Set();
  const visit = async (name, fromDir, optional) => {
    const dir = await packageDir(name, fromDir);
    if (dir === undefined) {
      if (optional) return;
      throw new Error(`${name} is not installed. Run npm install first.`);
    }
    if (copied.has(dir)) return;
    copied.add(dir);

    // `…/node_modules/a/node_modules/b` lands at `<to>/a/node_modules/b`.
    const marker = `${path.sep}node_modules${path.sep}`;
    const inside = dir.slice(dir.indexOf(marker) + marker.length);
    await cp(dir, path.join(to, inside), {
      recursive: true,
      // Nested dependencies are visited on their own, so only what is needed comes along.
      filter: (source) =>
        path.relative(dir, source).split(path.sep)[0] !== "node_modules",
    });

    const manifest = JSON.parse(
      await readFile(path.join(dir, "package.json"), "utf8"),
    );
    for (const [group, isOptional] of [
      [manifest.dependencies, false],
      [manifest.optionalDependencies, true],
    ])
      for (const dependency of Object.keys(group ?? {}))
        if (!dependency.startsWith("@types/"))
          await visit(dependency, dir, isOptional);
  };
  for (const name of NATIVE_MODULES) await visit(name, from, false);
}
