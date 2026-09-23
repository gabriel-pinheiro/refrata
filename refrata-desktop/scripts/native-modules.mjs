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

/**
 * The packages that hold `usb`'s addon, by the platform and architecture a
 * package is for. `usb` names one per platform as an optional dependency and
 * npm installs only the one of the machine it runs on, so a package for
 * another architecture (the arm64 AppImage built on an x86_64 machine, the
 * Intel dmg built on Apple silicon) gets its addon from `addonPackagesFor`.
 * `serialport`'s addon needs nothing of the kind: `@serialport/bindings-cpp`
 * carries every platform's in its `prebuilds/` folder.
 */
const USB_ADDONS = {
  "linux-x64": "@node-usb/usb-linux-x64-gnu",
  "linux-arm64": "@node-usb/usb-linux-arm64-gnu",
  "darwin-x64": "@node-usb/usb-darwin-x64",
  "darwin-arm64": "@node-usb/usb-darwin-arm64",
  "win32-x64": "@node-usb/usb-win32-x64-msvc",
};

/**
 * The addon packages a package for `platform`-`arch` needs, each with the
 * version the installed `usb` asks for, so `npm pack` fetches the very
 * binary npm would have installed on that machine.
 */
export async function addonPackagesFor(platform, arch, fromDir) {
  const name = USB_ADDONS[`${platform}-${arch}`];
  if (name === undefined)
    throw new Error(`No usb addon is known for ${platform}-${arch}.`);
  const usb = await packageDir("usb", fromDir);
  if (usb === undefined)
    throw new Error("usb is not installed. Run npm install first.");
  const manifest = JSON.parse(
    await readFile(path.join(usb, "package.json"), "utf8"),
  );
  return [{ name, version: manifest.optionalDependencies[name] }];
}
