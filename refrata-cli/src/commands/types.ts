import { parseFixtureType, type FixtureType } from "@refrata/core";
import type { CommandResult, LibraryEntry } from "@refrata/protocol";
import type { Command } from "commander";
import { readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

import type { Cli } from "../cli.ts";
import { formatCommandResult } from "../result.ts";
import { formatLibrary } from "../rig-lines.ts";
import {
  formatChart,
  formatTypes,
  resolveTypeKey,
  type Standings,
} from "../type-lines.ts";

/** The extension a Fixture Type file takes. */
const EXTENSION = ".refrata-fixture";

/**
 * Fixture Types from a shell: the library's, and the Installation's, which
 * it lists, prints one Mode of as a chart, and imports, exports, duplicates
 * and removes. Every edit inside a type is a `type.*` command for `run`.
 */
export function registerTypes(program: Command, cli: Cli): void {
  program
    .command("library")
    .description(
      "List the Fixture Types of the runtime's library, with their Modes and footprints, marking the ones the Installation holds.",
    )
    .action(() =>
      cli.withClient(async (client) => {
        const { types } = await client.request<{ types: LibraryEntry[] }>(
          "library.list",
          {},
        );
        const summary = client.document.get();
        const held =
          summary === null
            ? []
            : Object.keys(
                (await cli.replica(client, summary.id)).document.fixtureTypes,
              );
        cli.print(
          types.map((type) => ({ ...type, held: held.includes(type.key) })),
          () => formatLibrary(types, held).join("\n"),
        );
      }),
    );

  const types = program
    .command("types")
    .description(
      "List the Installation's Fixture Types (the default), print one as a chart, or import, export, duplicate and remove one.",
    );

  types
    .command("list", { isDefault: true })
    .description(
      "List the Installation's Fixture Types: where each came from, how it stands against the library and how many Fixtures use it.",
    )
    .action(() =>
      cli.withDocument(async (client, summary) => {
        const { document, view } = await cli.replica(client, summary.id);
        const standings: Standings = view.liveState.get().fixtureTypes;
        cli.print(
          Object.values(document.fixtureTypes).map((stored) => ({
            ...stored,
            standing: standings[stored.type.key] ?? null,
          })),
          () => formatTypes(document, standings).join("\n"),
        );
      }),
    );

  types
    .command("show <type> [mode]")
    .description(
      "Print a Fixture Type's Modes as charts, or one Mode: each Channel's place in the Footprint, name, width, Element, the Parameters that write it and their byte ranges.",
    )
    .action((type: string, modeKey: string | undefined) =>
      cli.withDocument(async (client, summary) => {
        const { document } = await cli.replica(client, summary.id);
        const stored = document.fixtureTypes[resolveTypeKey(document, type)];
        if (stored === undefined) return;
        const modes = Object.entries(stored.type.modes).filter(
          ([key]) => modeKey === undefined || key === modeKey,
        );
        if (modes.length === 0)
          throw new Error(
            `${stored.type.model} has no Mode “${modeKey ?? ""}”; it has ${Object.keys(stored.type.modes).join(", ")}.`,
          );
        cli.print(stored.type, () =>
          [
            `${stored.type.key}  ${stored.type.manufacturer} ${stored.type.model}`,
            ...modes.flatMap(([key, mode]) => ["", ...formatChart(key, mode)]),
          ].join("\n"),
        );
      }),
    );

  types
    .command("import <source>")
    .description(
      `Import a Fixture Type from a ${EXTENSION} file here, or from the library by key (see "library"). When the Installation already holds its key, say --replace or --copy.`,
    )
    .option("--replace", "replace the type the Installation holds", false)
    .option("--copy", "bring it in under a new key", false)
    .action((source: string, local: { replace: boolean; copy: boolean }) =>
      cli.withDocument(async (client, summary) => {
        let fixtureType: unknown;
        let origin: { from: "library" } | { from: "file"; file: string };
        const text = await readFile(resolve(source), "utf8").catch(
          () => undefined,
        );
        if (text === undefined) {
          const reply = await client
            .request<{ type: FixtureType }>("library.get", { key: source })
            .catch(() => undefined);
          if (reply === undefined)
            throw new Error(
              `“${source}” is neither a file here nor a key of the library.`,
            );
          fixtureType = reply.type;
          origin = { from: "library" };
        } else {
          let json: unknown;
          try {
            json = JSON.parse(text);
          } catch (error) {
            throw new Error(`${source} is not valid JSON: ${String(error)}`, {
              cause: error,
            });
          }
          const parsed = parseFixtureType(json);
          if (!parsed.ok) throw new Error(`${source}: ${parsed.error}`);
          fixtureType = parsed.type;
          origin = { from: "file", file: basename(source) };
        }
        const reply = await client.command<CommandResult>(
          summary.id,
          "type.import",
          {
            fixtureType,
            origin,
            ...(local.replace
              ? { onHeld: "replace" }
              : local.copy
                ? { onHeld: "copy" }
                : {}),
          },
        );
        cli.print(reply, () => formatCommandResult(reply, "type.import"));
      }),
    );

  types
    .command("export <type> [path]")
    .description(
      `Write a Fixture Type the Installation holds to a ${EXTENSION} file here: <model>${EXTENSION} unless a path is given.`,
    )
    .action((type: string, path: string | undefined) =>
      cli.withDocument(async (client, summary) => {
        const { document } = await cli.replica(client, summary.id);
        const stored = document.fixtureTypes[resolveTypeKey(document, type)];
        if (stored === undefined) return;
        const fallback = `${stored.type.key.slice(stored.type.key.indexOf("/") + 1)}${EXTENSION}`;
        const file = resolve(path ?? fallback);
        await writeFile(file, `${JSON.stringify(stored.type, null, 2)}\n`);
        cli.print(
          { key: stored.type.key, path: file },
          () => `Wrote ${stored.type.model} to ${file}.`,
        );
      }),
    );

  types
    .command("duplicate <type>")
    .description(
      "Duplicate a Fixture Type under a new key, as a type made in this Installation.",
    )
    .option(
      "--model <model>",
      "the duplicate's model (default: “<model> copy”)",
    )
    .action((type: string, local: { model?: string }) =>
      cli.withDocument(async (client, summary) => {
        const { document } = await cli.replica(client, summary.id);
        const reply = await client.command<CommandResult>(
          summary.id,
          "type.duplicate",
          {
            typeKey: resolveTypeKey(document, type),
            ...(local.model === undefined ? {} : { model: local.model }),
          },
        );
        cli.print(reply, () => formatCommandResult(reply, "type.duplicate"));
      }),
    );

  types
    .command("remove <type>")
    .description(
      "Remove a Fixture Type from the Installation; refused while a Fixture uses it.",
    )
    .action((type: string) =>
      cli.withDocument(async (client, summary) => {
        const { document } = await cli.replica(client, summary.id);
        const reply = await client.command<CommandResult>(
          summary.id,
          "type.remove",
          { typeKey: resolveTypeKey(document, type) },
        );
        cli.print(reply, () => formatCommandResult(reply, "type.remove"));
      }),
    );
}
