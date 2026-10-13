import {
  footprintOf,
  parseFixtureType,
  settings,
  type FixtureType,
} from "@refrata/core";
import type { LibraryEntry } from "@refrata/protocol";
import { watch, type FSWatcher } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/** The extensions a library file may have: `.refrata-fixture`, and `.json` for a folder written before it. */
const EXTENSIONS = [".refrata-fixture", ".json"] as const;

/**
 * The Fixture Library: every Fixture Type file under the library folder,
 * keyed by the type's own key. Read-only, read at startup and read again
 * when a file under the folder changes, so a type being written is seen at
 * once; an Installation's types never change by themselves, a reload does
 * that. It answers about its own files only: what an Installation holds is
 * in the document. A file that does not parse is logged and skipped;
 * nothing else stops the runtime.
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

  /** Reads every Fixture Type file under `dir`, recursively, replacing what was read before. */
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
      .filter((entry) => EXTENSIONS.some((ending) => entry.endsWith(ending)))
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

  get(key: string): FixtureType | undefined {
    return this.#types.get(key);
  }

  list(): readonly LibraryEntry[] {
    return [...this.#types.values()]
      .map(entryOf)
      .sort((a, b) => a.key.localeCompare(b.key));
  }
}

function entryOf(type: FixtureType): LibraryEntry {
  return {
    key: type.key,
    manufacturer: type.manufacturer,
    model: type.model,
    modes: Object.entries(type.modes).map(([key, mode]) => ({
      key,
      name: mode.name,
      footprint: footprintOf(mode),
    })),
  };
}
