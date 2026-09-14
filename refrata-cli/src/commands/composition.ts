import type { CommandResult } from "@refrata/protocol";
import type { Command } from "commander";

import type { Cli } from "../cli.ts";
import { formatScenes, formatSets, formatStack } from "../composition-lines.ts";
import { parseValue } from "../connection.ts";
import { resolveId, resolveRowRef, resolveTargetRef } from "../names.ts";
import { formatCommandResult } from "../result.ts";

/** Scenes, Layers, Looks, Sets, Master and Blackout: composing a show from the shell. */
export function registerComposition(program: Command, cli: Cli): void {
  const scenes = program
    .command("scenes")
    .description("List the Scenes in order (the default), or add one.");

  scenes
    .command("list", { isDefault: true })
    .description(
      "List the Scenes with their Layer counts; the playing one is marked.",
    )
    .action(() =>
      cli.withDocument(async (client, summary) => {
        const { document } = await cli.replica(client, summary.id);
        cli.print(Object.values(document.scenes), () =>
          formatScenes(document).join("\n"),
        );
      }),
    );

  scenes
    .command("add <name>")
    .description(
      "Add an empty Scene; the first Scene of an Installation starts playing.",
    )
    .action((name: string) =>
      cli.withDocument(async (client, summary) => {
        const result = await client.command<CommandResult>(
          summary.id,
          "scene.create",
          { name },
        );
        cli.print(result, () => formatCommandResult(result, "scene.create"));
      }),
    );

  program
    .command("play <scene>")
    .description(
      "Play a Scene: the Outputs cut to it. Show control, never undone.",
    )
    .action((scene: string) =>
      cli.withDocument(async (client, summary) => {
        const { document } = await cli.replica(client, summary.id);
        const sceneId = resolveId(document, "scenes", scene);
        const address = `scene/${sceneId}/play`;
        const result = await client.command<CommandResult>(
          summary.id,
          "address.trigger",
          { address },
        );
        cli.print(
          { address, sceneId, ...result },
          () => `Playing “${document.scenes[sceneId]?.name ?? sceneId}”`,
        );
      }),
    );

  const layers = program
    .command("layers")
    .description(
      "List a Scene's Layers topmost first (the default), or add one.",
    );

  layers
    .command("list <scene>", { isDefault: true })
    .description(
      "List a Scene's stack: each Look Layer with its Targets and rows.",
    )
    .action((scene: string) =>
      cli.withDocument(async (client, summary) => {
        const { document } = await cli.replica(client, summary.id);
        const sceneId = resolveId(document, "scenes", scene);
        const own = Object.values(document.layers).filter(
          (layer) => layer.sceneId === sceneId,
        );
        cli.print(own, () => formatStack(document, sceneId).join("\n"));
      }),
    );

  layers
    .command("add <scene> <name>")
    .description(
      "Add a Look Layer at the top of a Scene, targeting what --target names (a Fixture, <fixture>/<key> or set:<set>).",
    )
    .option(
      "--target <ref>",
      "a Target; repeat for several",
      (value: string, previous: string[]) => [...previous, value],
      [] as string[],
    )
    .option("--group", "add a Group instead", false)
    .action(
      (
        scene: string,
        name: string,
        local: { target: string[]; group: boolean },
      ) =>
        cli.withDocument(async (client, summary) => {
          const { document } = await cli.replica(client, summary.id);
          const result = await client.command<CommandResult>(
            summary.id,
            "layer.create",
            {
              sceneId: resolveId(document, "scenes", scene),
              name,
              kind: local.group ? "group" : "look",
              ...(local.group
                ? {}
                : {
                    targets: local.target.map((text) =>
                      resolveTargetRef(document, text),
                    ),
                  }),
            },
          );
          cli.print(result, () => formatCommandResult(result, "layer.create"));
        }),
    );

  program
    .command("look <layer> <action> <target> <attribute> [value]")
    .description(
      "Set or release a Look Layer row: look Base set Par dimmer 0.4, look Base set Strobe/panel-3 color '[1,1,1,1]', look Base set all dimmer 0.2, look Base release Par dimmer. Undoable.",
    )
    .action(
      (
        layer: string,
        action: string,
        target: string,
        attribute: string,
        value: string | undefined,
      ) =>
        cli.withDocument(async (client, summary) => {
          if (action !== "set" && action !== "release")
            throw new Error(
              `look takes "set" or "release" after the Layer, not “${action}”.`,
            );
          const { document } = await cli.replica(client, summary.id);
          const layerId = resolveId(document, "layers", layer);
          const targets = [resolveRowRef(document, target)];
          if (action === "release") {
            const result = await client.command<CommandResult>(
              summary.id,
              "layer.row.release",
              { layerId, targets, attribute },
            );
            cli.print(result, () =>
              formatCommandResult(result, "layer.row.release"),
            );
            return;
          }
          if (value === undefined) throw new Error("look set needs a value.");
          const result = await client.command<CommandResult>(
            summary.id,
            "layer.row.set",
            { layerId, targets, attribute, value: parseValue(value) },
          );
          cli.print(result, () => formatCommandResult(result, "layer.row.set"));
        }),
    );

  const sets = program
    .command("sets")
    .description(
      "List the Fixture Sets in their Groups (the default), or add one.",
    );

  sets
    .command("list", { isDefault: true })
    .description("List the Fixture Sets with their members in order.")
    .action(() =>
      cli.withDocument(async (client, summary) => {
        const { document } = await cli.replica(client, summary.id);
        cli.print(Object.values(document.fixtureSets), () =>
          formatSets(document).join("\n"),
        );
      }),
    );

  sets
    .command("add <name> [ref...]")
    .description(
      "Add a Fixture Set holding the Elements given, in order: a Fixture (its root) or <fixture>/<key>.",
    )
    .action((name: string, refs: string[]) =>
      cli.withDocument(async (client, summary) => {
        const { document } = await cli.replica(client, summary.id);
        const members = refs.map((text) => {
          const ref = resolveTargetRef(document, text);
          if (ref.startsWith("set:"))
            throw new Error(
              `“${text}” is a Fixture Set; members are Elements.`,
            );
          return ref;
        });
        const result = await client.command<CommandResult>(
          summary.id,
          "set.create",
          { name, members },
        );
        cli.print(result, () => formatCommandResult(result, "set.create"));
      }),
    );

  program
    .command("master [value]")
    .description(
      "Read the grand master, or set it (0 to 1): scales every dimmer after Resolve. Undoable; linkable to a Controller.",
    )
    .action((value: string | undefined) =>
      cli.withDocument(async (client, summary) => {
        const address = "installation/master";
        if (value === undefined) {
          const { document } = await cli.replica(client, summary.id);
          const master = document.installation.master;
          cli.print(
            { address, value: master },
            () => `${address} = ${String(master)}`,
          );
          return;
        }
        const result = await client.command<CommandResult>(
          summary.id,
          "address.edit",
          { address, value: Number(value) },
        );
        cli.print({ address, ...result }, () =>
          result.changed
            ? `${address} = ${value} (revision ${String(result.revision)})`
            : "No change.",
        );
      }),
    );

  program
    .command("blackout <state>")
    .description(
      "Blackout on or off: every dimmer to 0 after Resolve, colours and positions kept. Never undone.",
    )
    .action((state: string) =>
      cli.withDocument(async (client, summary) => {
        if (state !== "on" && state !== "off")
          throw new Error("blackout takes “on” or “off”.");
        const address = "installation/blackout";
        const result = await client.command<CommandResult>(
          summary.id,
          "address.set",
          { address, value: state === "on" },
        );
        cli.print(
          { address, value: state === "on", ...result },
          () => `Blackout ${state}`,
        );
      }),
    );
}
