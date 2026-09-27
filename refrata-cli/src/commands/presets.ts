import { type Document } from "@refrata/core";
import type { CommandResult } from "@refrata/protocol";
import type { Command } from "commander";

import type { Cli } from "../cli.ts";
import { parseValue } from "../connection.ts";
import {
  resolveAddressNames,
  resolveElementRef,
  resolveId,
  resolveRowRef,
  resolveTargetRef,
} from "../names.ts";
import { formatPreset, formatPresets, linkedRows } from "../preset-lines.ts";
import { formatCommandResult } from "../result.ts";
import { treeNodes } from "../tree-nodes.ts";
import { runAim, valuePreset, type AimOptions } from "./aim.ts";

/** A Preset's row ref as typed: `all` for All Elements, else one Element. */
function presetRef(document: Document, text: string): string {
  const ref = resolveRowRef(document, text);
  return ref === "all" ? ref : resolveElementRef(document, text);
}

/** Presets: named values per Element that Look Layer rows link to. */
export function registerPresets(program: Command, cli: Cli): void {
  const presets = program
    .command("presets")
    .description(
      "List the Presets in their Groups (the default), show one, add one, edit its Elements and rows, link it to Look Layer rows. A Preset holds values per Element; a Look Layer row linked to it gives each Element it reaches that Element's own value.",
    );

  presets
    .command("list", { isDefault: true })
    .description("List the Presets in their Groups, with their Element counts.")
    .action(() =>
      cli.withDocument(async (client, summary) => {
        const { document } = await cli.replica(client, summary.id);
        cli.print(treeNodes(document.presets), () =>
          formatPresets(document).join("\n"),
        );
      }),
    );

  presets
    .command("show <preset>")
    .description(
      "Show one Preset: its All Elements rows, each Element's rows, and the Look Layer rows linked to it.",
    )
    .action((text: string) =>
      cli.withDocument(async (client, summary) => {
        const { document } = await cli.replica(client, summary.id);
        const preset = valuePreset(document, text);
        cli.print({ ...preset, linked: linkedRows(document, preset) }, () =>
          formatPreset(document, preset).join("\n"),
        );
      }),
    );

  presets
    .command("add <name> [element...]")
    .description(
      'Add a Preset listing the Elements given, in order: a Fixture is its root, <fixture>/<key> one Element, set:<set> the members the Set has now. --from grows it out of Look Layer rows instead and links them at once: it takes the Elements those rows reach, each holding what it shows now, so nothing changes on the rig. presets add "Table Blue" set:Movers; presets add Wall --from layer/Spot/row/all/pan layer/Spot/row/all/tilt. --group-kind adds a Group.',
    )
    .option("--group <group>", "the Preset Group to add into, id or name")
    .option("--from <address...>", "Look Layer rows to grow from and link")
    .option("--group-kind", "add a Group of Presets, not a Preset", false)
    .action(
      (
        name: string,
        elements: string[],
        options: { group?: string; from?: string[]; groupKind: boolean },
      ) =>
        cli.withDocument(async (client, summary) => {
          const { document } = await cli.replica(client, summary.id);
          const reply = await client.command<CommandResult>(
            summary.id,
            "preset.create",
            {
              name,
              ...(options.groupKind ? { kind: "group" } : {}),
              ...(options.group === undefined
                ? {}
                : { parentId: resolveId(document, "presets", options.group) }),
              ...(elements.length === 0
                ? {}
                : {
                    elements: elements.map((text) =>
                      resolveTargetRef(document, text),
                    ),
                  }),
              ...(options.from === undefined
                ? {}
                : {
                    addresses: options.from.map((address) =>
                      resolveAddressNames(document, address),
                    ),
                  }),
            },
          );
          const result = await cli.named(client, summary.id, reply);
          cli.print(result, () => formatCommandResult(result, "preset.create"));
        }),
    );

  presets
    .command("elements <preset> <action> <element...>")
    .description(
      "Add Elements to a Preset or remove them with their rows: presets elements Table add Left Right; presets elements Table add set:Movers (its members now); presets elements Table remove Right.",
    )
    .action((text: string, action: string, elements: string[]) =>
      cli.withDocument(async (client, summary) => {
        if (action !== "add" && action !== "remove")
          throw new Error(
            `presets elements takes "add" or "remove" after the Preset, not “${action}”.`,
          );
        const { document } = await cli.replica(client, summary.id);
        const command = `preset.elements.${action}`;
        const result = await client.command<CommandResult>(
          summary.id,
          command,
          {
            presetId: valuePreset(document, text).id,
            refs: elements.map((element) =>
              action === "add"
                ? resolveTargetRef(document, element)
                : resolveElementRef(document, element),
            ),
          },
        );
        cli.print(result, () => formatCommandResult(result, command));
      }),
    );

  presets
    .command("set <preset> <element> <attribute> <value>")
    .description(
      "Set a Preset row: presets set Warm all color '[1,0.8,0.6,1]', presets set Table Left gobo1 line. <element> \"all\" is the All Elements row every Element takes unless it has its own. Undoable.",
    )
    .action((text: string, element: string, attribute: string, value: string) =>
      cli.withDocument(async (client, summary) => {
        const { document } = await cli.replica(client, summary.id);
        const result = await client.command<CommandResult>(
          summary.id,
          "preset.row.set",
          {
            presetId: valuePreset(document, text).id,
            elements: [presetRef(document, element)],
            attribute,
            value: parseValue(value),
          },
        );
        cli.print(result, () => formatCommandResult(result, "preset.row.set"));
      }),
    );

  presets
    .command("release <preset> <element> <attribute>")
    .description(
      'Release a Preset row, so the Element takes the All Elements row or nothing: presets release Table Left gobo1. <element> "all" is the All Elements row.',
    )
    .action((text: string, element: string, attribute: string) =>
      cli.withDocument(async (client, summary) => {
        const { document } = await cli.replica(client, summary.id);
        const result = await client.command<CommandResult>(
          summary.id,
          "preset.row.release",
          {
            presetId: valuePreset(document, text).id,
            elements: [presetRef(document, element)],
            attribute,
          },
        );
        cli.print(result, () =>
          formatCommandResult(result, "preset.row.release"),
        );
      }),
    );

  presets
    .command("aim <preset> <element>")
    .description(
      'Read, set or nudge the Aim a Preset holds for one Element, or for "all": its pan and tilt rows in degrees, as one undo step, clamped to what the Element can reach. presets aim Table Left --pan 10 --tilt 20; presets aim Table Left --tilt 0.5 --by. Without options it prints the Aim.',
    )
    .option("--pan <degrees>", "pan to this, or by this with --by")
    .option("--tilt <degrees>", "tilt to this, or by this with --by")
    .option("--by", "nudge: move by the degrees given", false)
    .action((text: string, element: string, options: AimOptions) =>
      cli.withDocument((client, summary) =>
        runAim(
          cli,
          client,
          summary,
          (document) => ({
            preset: valuePreset(document, text),
            ref: presetRef(document, element),
          }),
          options,
        ),
      ),
    );

  presets
    .command("link <preset> <address...>")
    .description(
      'Link a Preset to Look Layer rows (layer/<id|name>/row/<target|all>/<attribute>), one undoable step; a row linked elsewhere moves. Each Element the row reaches takes its own value from the Preset, an Element the Preset has nothing for is released. For an Aim, "aim <layer> <target> --link <preset>" links both axes; "unlink <address...>" and "aim ... --unlink" let go.',
    )
    .action((text: string, addresses: string[]) =>
      cli.withDocument(async (client, summary) => {
        const { document } = await cli.replica(client, summary.id);
        const result = await client.command<CommandResult>(
          summary.id,
          "link.preset",
          {
            presetId: valuePreset(document, text).id,
            addresses: addresses.map((address) =>
              resolveAddressNames(document, address),
            ),
          },
        );
        cli.print(result, () => formatCommandResult(result, "link.preset"));
      }),
    );

  for (const [verb, command, purpose] of [
    ["rename <preset> <name>", "preset.rename", "Rename a Preset or a Group."],
    [
      "remove <preset>",
      "preset.remove",
      "Remove a Preset, or a Group with its contents. The Look Layer rows linked to it are released, and the reply names their Layers. Undoable.",
    ],
  ] as const)
    presets
      .command(verb)
      .description(purpose)
      .action((text: string, name: string | undefined) =>
        cli.withDocument(async (client, summary) => {
          const { document } = await cli.replica(client, summary.id);
          const result = await client.command<CommandResult>(
            summary.id,
            command,
            {
              presetId: resolveId(document, "presets", text),
              ...(command === "preset.rename" ? { name } : {}),
            },
          );
          cli.print(result, () => formatCommandResult(result, command));
        }),
      );
}
