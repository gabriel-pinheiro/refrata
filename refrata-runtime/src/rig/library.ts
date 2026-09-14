import {
  footprintOf,
  parseFixtureType,
  type Document,
  type FixtureType,
} from "@refrata/core";
import type { LibraryEntry } from "@refrata/protocol";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * The Fixture Library: every Fixture Type file under the library folder,
 * read once at startup, keyed by the type's own key. A type an Installation
 * holds is listed too, so a file opened on another machine still offers
 * what it uses. A file that does not parse is logged and skipped; nothing
 * else stops the runtime.
 */
export class FixtureLibrary {
  readonly #types = new Map<string, FixtureType>();
  readonly #log: (message: string) => void;

  constructor(log: (message: string) => void) {
    this.#log = log;
  }

  /** Reads every `.json` under `dir`, recursively. */
  async load(dir: string): Promise<void> {
    let names: string[];
    try {
      names = await readdir(dir, { recursive: true });
    } catch (error) {
      this.#log(`Fixture Library at ${dir} is unreadable: ${String(error)}`);
      return;
    }
    for (const name of names
      .filter((entry) => entry.endsWith(".json"))
      .sort()) {
      const file = path.join(dir, name);
      try {
        const parsed = parseFixtureType(
          JSON.parse(await readFile(file, "utf8")),
        );
        if (!parsed.ok) {
          this.#log(`${file}: ${parsed.error}`);
          continue;
        }
        this.#types.set(parsed.type.key, parsed.type);
      } catch (error) {
        this.#log(`${file}: ${String(error)}`);
      }
    }
  }

  /** Adds a type by hand, for tests and for later importers. */
  add(type: FixtureType): void {
    this.#types.set(type.key, type);
  }

  get(key: string, document?: Document): FixtureType | undefined {
    return this.#types.get(key) ?? document?.fixtureTypes[key]?.type;
  }

  list(document?: Document): readonly LibraryEntry[] {
    const entries = new Map<string, LibraryEntry>();
    for (const type of this.#types.values())
      entries.set(type.key, entryOf(type, "library"));
    for (const stored of Object.values(document?.fixtureTypes ?? {}))
      if (!entries.has(stored.type.key))
        entries.set(stored.type.key, entryOf(stored.type, "installation"));
    return [...entries.values()].sort((a, b) => a.key.localeCompare(b.key));
  }
}

function entryOf(
  type: FixtureType,
  source: LibraryEntry["source"],
): LibraryEntry {
  return {
    key: type.key,
    manufacturer: type.manufacturer,
    model: type.model,
    modes: Object.entries(type.modes).map(([key, mode]) => ({
      key,
      name: mode.name,
      footprint: footprintOf(mode),
    })),
    source,
  };
}
