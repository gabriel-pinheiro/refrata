// Puts the addon packages each package of this OS needs, beyond the ones
// `npm run build` copied into dist/node_modules for this machine, under
// release/addons/<platform>-<arch>/. electron-builder.yml adds that folder
// to dist/node_modules of the package for that platform and architecture
// only. `npm run package` runs this before electron-builder.
//
// The packages come from the npm registry with `npm pack`, at the version the
// installed `usb` names, and are kept: a second run fetches nothing.
import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { addonPackagesFor } from "./native-modules.mjs";

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const repository = path.join(packageDir, "..");

/** The architectures electron-builder.yml packages for on each OS. */
const ARCHITECTURES = {
  linux: ["x64", "arm64"],
  darwin: ["arm64", "x64"],
  win32: ["x64"],
};

async function exists(file) {
  return access(file).then(
    () => true,
    () => false,
  );
}

async function installedVersion(dir) {
  try {
    return JSON.parse(await readFile(path.join(dir, "package.json"), "utf8"))
      .version;
  } catch {
    return undefined;
  }
}

/** `npm pack`s `name@version` and unpacks it at `into`; a tarball's files sit under `package/`. */
async function fetchPackage(name, version, into) {
  const scratch = path.join(path.dirname(into), ".pack");
  await rm(scratch, { recursive: true, force: true });
  await mkdir(scratch, { recursive: true });
  // npm is a script on Windows, which only a shell runs.
  const tarball = execFileSync(
    "npm",
    ["pack", `${name}@${version}`, "--silent"],
    { cwd: scratch, encoding: "utf8", shell: process.platform === "win32" },
  )
    .trim()
    .split("\n")
    .at(-1);
  // Relative paths only: Git's tar on Windows reads `C:` as a host name.
  execFileSync("tar", ["-xzf", tarball], { cwd: scratch });
  await rm(into, { recursive: true, force: true });
  await mkdir(path.dirname(into), { recursive: true });
  await rename(path.join(scratch, "package"), into);
  await rm(scratch, { recursive: true, force: true });
}

for (const arch of ARCHITECTURES[process.platform] ?? []) {
  const stage = path.join(
    packageDir,
    "release",
    "addons",
    `${process.platform}-${arch}`,
  );
  // Always there, so electron-builder finds the folder it was told about.
  await mkdir(stage, { recursive: true });
  const wanted = await addonPackagesFor(
    process.platform,
    arch,
    path.join(repository, "refrata-runtime"),
  );
  for (const { name, version } of wanted) {
    const target = path.join(stage, name);
    const bundled = path.join(packageDir, "dist", "node_modules", name);
    if (await exists(bundled)) {
      // This machine's own, already in dist/node_modules.
      await rm(target, { recursive: true, force: true });
      continue;
    }
    if ((await installedVersion(target)) === version) continue;
    console.log(`Fetching ${name}@${version} for ${process.platform}-${arch}`);
    await fetchPackage(name, version, target);
  }
}
