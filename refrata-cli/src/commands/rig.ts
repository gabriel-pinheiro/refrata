import { formatFrame, settings, type FixtureType } from "@refrata/core";
import type { CommandResult, DmxFrame, LibraryEntry } from "@refrata/protocol";
import type { Command } from "commander";

import type { Cli } from "../cli.ts";
import { resolveId } from "../names.ts";
import { formatCommandResult } from "../result.ts";
import { formatFixtures, formatLibrary } from "../rig-lines.ts";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function registerRig(program: Command, cli: Cli): void {
  program
    .command("library")
    .description(
      "List the Fixture Types the runtime knows, with their Modes and footprints.",
    )
    .action(() =>
      cli.withClient(async (client) => {
        const { types } = await client.request<{ types: LibraryEntry[] }>(
          "library.list",
          {},
        );
        cli.print(types, () => formatLibrary(types).join("\n"));
      }),
    );

  const fixtures = program
    .command("fixtures")
    .description(
      "List the Fixtures in their Groups with their Elements (the default), or add one.",
    );

  fixtures
    .command("list", { isDefault: true })
    .description("List the Fixtures with their Patch and Elements.")
    .action(() =>
      cli.withDocument(async (client, summary) => {
        const { document } = await cli.replica(client, summary.id);
        cli.print(Object.values(document.fixtures), () =>
          formatFixtures(document).join("\n"),
        );
      }),
    );

  fixtures
    .command("add <typeKey> <modeKey>")
    .description(
      "Add a Fixture of a library type and Mode, e.g. fixtures add generic/rgb-3ch 3ch. It takes the next free address unless told.",
    )
    .option("--name <name>", "the Fixture's name (default: the model)")
    .option("--universe <universe>", "Universe id or name (default: the first)")
    .option("--address <number>", "start address (default: next free)")
    .option("--unpatched", "leave it unpatched", false)
    .action(
      (
        typeKey: string,
        modeKey: string,
        local: {
          name?: string;
          universe?: string;
          address?: string;
          unpatched: boolean;
        },
      ) =>
        cli.withDocument(async (client, summary) => {
          const { document } = await cli.replica(client, summary.id);
          const { type } = await client.request<{ type: FixtureType }>(
            "library.get",
            { key: typeKey },
          );
          const result = await client.command<CommandResult>(
            summary.id,
            "fixture.create",
            {
              typeKey,
              modeKey,
              fixtureType: type,
              ...(local.name === undefined ? {} : { name: local.name }),
              ...(local.universe === undefined
                ? {}
                : {
                    universeId: resolveId(
                      document,
                      "universes",
                      local.universe,
                    ),
                  }),
              ...(local.address === undefined
                ? {}
                : { address: Number(local.address) }),
              ...(local.unpatched ? { unpatched: true } : {}),
            },
          );
          cli.print(result, () =>
            formatCommandResult(result, "fixture.create"),
          );
        }),
    );

  program
    .command("patch <fixture> <universe> <address>")
    .description(
      "Patch a Fixture at a Universe and start address; overlap is refused. Use `run fixture.patch` with null to unpatch.",
    )
    .action((fixture: string, universe: string, address: string) =>
      cli.withDocument(async (client, summary) => {
        const { document } = await cli.replica(client, summary.id);
        const result = await client.command<CommandResult>(
          summary.id,
          "fixture.patch",
          {
            fixtureId: resolveId(document, "fixtures", fixture),
            patch: {
              universeId: resolveId(document, "universes", universe),
              address: Number(address),
            },
          },
        );
        cli.print(result, () => formatCommandResult(result, "fixture.patch"));
      }),
    );

  fixtures
    .command("reload [type]")
    .description(
      "Reload a Fixture Type the Installation holds from the library (a type key, or a Fixture's name for its type), or every held type when none is given. Its Fixtures take the new definition as one undo step; refused when a Mode is gone or a Footprint would overlap.",
    )
    .action((type: string | undefined) =>
      cli.withDocument(async (client, summary) => {
        const { document } = await cli.replica(client, summary.id);
        const held = Object.keys(document.fixtureTypes);
        let keys: readonly string[] = held;
        if (type !== undefined) {
          if (held.includes(type)) keys = [type];
          else {
            const fixture =
              document.fixtures[resolveId(document, "fixtures", type)];
            if (fixture?.kind !== "fixture")
              throw new Error(`“${type}” is a Group, not a Fixture.`);
            keys = [fixture.typeKey];
          }
        }
        const types: FixtureType[] = [];
        const skipped: string[] = [];
        for (const key of keys) {
          try {
            const reply = await client.request<{ type: FixtureType }>(
              "library.get",
              { key, libraryOnly: true },
            );
            types.push(reply.type);
          } catch {
            skipped.push(key);
          }
        }
        if (types.length === 0)
          throw new Error(
            keys.length === 0
              ? "The Installation holds no Fixture Types yet."
              : `The library has no ${keys.map((key) => `“${key}”`).join(", ")}.`,
          );
        const result = await client.command<CommandResult>(
          summary.id,
          "fixture.reload",
          { types },
        );
        cli.print({ ...result, skipped }, () =>
          [
            formatCommandResult(result, "fixture.reload"),
            ...skipped.map((key) => `  not in the library: ${key}`),
          ].join("\n"),
        );
      }),
    );

  program
    .command("highlight <element>")
    .description(
      `Light a Fixture or one Element (<fixture>/<key>) at its Highlight values for ${String(settings.cli.highlightHoldMs / 1000)} s, or hold it with --on and release it with --off.`,
    )
    .option(
      "--on",
      "hold the highlight until --off or the runtime's timeout",
      false,
    )
    .option("--off", "release the highlight", false)
    .action((element: string, local: { on: boolean; off: boolean }) =>
      cli.withDocument(async (client, summary) => {
        const { document } = await cli.replica(client, summary.id);
        const slash = element.indexOf("/");
        const fixture = slash === -1 ? element : element.slice(0, slash);
        const key = slash === -1 ? "root" : element.slice(slash + 1);
        const fixtureId = resolveId(document, "fixtures", fixture);
        const address = `element/${fixtureId}/${key}/highlight`;
        const set = (value: boolean): Promise<CommandResult> =>
          client.command<CommandResult>(summary.id, "address.set", {
            address,
            value,
          });
        if (local.off) {
          await set(false);
          cli.print({ address, held: false }, () => `${address} released`);
          return;
        }
        await set(true);
        if (local.on) {
          cli.print({ address, held: true }, () => `${address} held`);
          return;
        }
        await sleep(settings.cli.highlightHoldMs);
        await set(false);
        cli.print(
          { address, held: false, heldMs: settings.cli.highlightHoldMs },
          () =>
            `${address} lit for ${String(settings.cli.highlightHoldMs / 1000)} s`,
        );
      }),
    );

  program
    .command("dmx <universe>")
    .description(
      "Print the DMX Frame a Universe is sending now: 512 bytes, runs of one value grouped as <Nx value>.",
    )
    .action((universe: string) =>
      cli.withDocument(async (client, summary) => {
        const { document } = await cli.replica(client, summary.id);
        const universeId = resolveId(document, "universes", universe);
        const frame = await client.request<DmxFrame>("dmx.frame", {
          documentId: summary.id,
          universeId,
        });
        cli.print(frame, () => formatFrame(frame.bytes));
      }),
    );
}
