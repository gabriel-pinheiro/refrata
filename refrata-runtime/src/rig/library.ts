import {
  fixtureTypeDrift,
  footprintOf,
  parseFixtureType,
  settings,
  type Document,
  type FixtureType,
} from "@refrata/core";
import type { LibraryEntry } from "@refrata/protocol";
import { watch, type FSWatcher } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * The Fixture Library: every Fixture Type file under the library folder,
 * keyed by the type's own key. Read at startup and read again when a file
 * under the folder changes, so a type being written is seen at once; an
 * Installation's copies never change by themselves, a reload does that. A
 * type an Installation holds is listed too, so a file opened on another
 * machine still offers what it uses. A file that does not parse is logged
 * and skipped; nothing else stops the runtime.
 */
export class FixtureLibrary {
  #types = new Map<string, FixtureType>();
  readonly #log: (message: string) => void;
  readonly #listeners = new Set<() => void>();
  #watcher: FSWatcher | undefined;
  #debounce: ReturnType<typeof setTimeout> | undefined;

  constructor(log: (message: string) => void) {
    this.#log = log;
  }

  /** Reads every `.json` under `dir`, recursively, replacing what was read before. */
  async load(dir: string): Promise<void> {
    let names: string[];
    try {
      names = await readdir(dir, { recursive: true });
    } catch (error) {
      this.#log(`Fixture Library at ${dir} is unreadable: ${String(error)}`);
      return;
    }
    const types = new Map<string, FixtureType>();
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
        types.set(parsed.type.key, parsed.type);
      } catch (error) {
        this.#log(`${file}: ${String(error)}`);
      }
    }
    this.#types = types;
    this.#notify();
  }

  /** Reads `dir` again whenever something under it changes, gathered over `settings.library.watchDebounceMs`. */
  watch(dir: string): void {
    this.close();
    try {
      this.#watcher = watch(dir, { recursive: true }, () => {
        if (this.#debounce !== undefined) clearTimeout(this.#debounce);
        this.#debounce = setTimeout(() => {
          this.#debounce = undefined;
          void this.load(dir);
        }, settings.library.watchDebounceMs);
      });
      this.#watcher.on("error", (error) =>
        this.#log(`Fixture Library watch on ${dir} stopped: ${String(error)}`),
      );
    } catch (error) {
      this.#log(`Fixture Library at ${dir} is not watched: ${String(error)}`);
    }
  }

  close(): void {
    this.#watcher?.close();
    this.#watcher = undefined;
    if (this.#debounce !== undefined) clearTimeout(this.#debounce);
    this.#debounce = undefined;
  }

  /** Called after every read of the folder and every `add`. */
  onChange(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #notify(): void {
    for (const listener of this.#listeners) listener();
  }

  /** Adds a type by hand, for tests and for later importers. */
  add(type: FixtureType): void {
    this.#types.set(type.key, type);
    this.#notify();
  }

  /** The library's own file for `key`, never an Installation's copy: what a reload loads. */
  libraryType(key: string): FixtureType | undefined {
    return this.#types.get(key);
  }

  get(key: string, document?: Document): FixtureType | undefined {
    return this.#types.get(key) ?? document?.fixtureTypes[key]?.type;
  }

  list(document?: Document): readonly LibraryEntry[] {
    const entries = new Map<string, LibraryEntry>();
    for (const type of this.#types.values()) {
      const stored = document?.fixtureTypes[type.key]?.type;
      const stale =
        stored !== undefined && fixtureTypeDrift(stored, type) === "stale";
      entries.set(type.key, {
        ...entryOf(type, "library"),
        ...(stale ? { stale: true } : {}),
      });
    }
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
