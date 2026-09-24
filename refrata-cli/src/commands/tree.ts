import { flattenTree, qualifiedName } from "@refrata/core";
import type { CommandResult } from "@refrata/protocol";
import type { Command } from "commander";

import type { Cli } from "../cli.ts";
import { liveStatus } from "../live-status.ts";
import { resolveAddressNames, resolveId } from "../names.ts";
import { formatCommandResult } from "../result.ts";
import {
  describeController,
  describeMacro,
  formatTreeNodes,
  treeNodes,
} from "../tree-nodes.ts";

export function registerTree(program: Command, cli: Cli): void {
  program
    .command("controllers")
    .description("List the Controllers in their Groups, with their values.")
    .action(() =>
      cli.withDocument(async (client, summary) => {
        const { document } = await cli.replica(client, summary.id);
        const nodes = treeNodes(document.controllers);
        cli.print(nodes, () =>
          formatTreeNodes(nodes, describeController).join("\n"),
        );
      }),
    );

  program
    .command("osc")
    .description(
      "List the OSC tree a hub such as Chataigne binds to: one leaf per Controller (float 0–1 or RGBA colour) and per Macro (impulse), each described by its name with its Group. Nothing else is on the tree: a fader reaches a value through a Controller linked to it, a button reaches anything else through a Macro.",
    )
    .action(() =>
      cli.withDocument(async (client, summary) => {
        const { document, view } = await cli.replica(client, summary.id);
        const live = liveStatus(view.liveState.get());
        const leaves = [
          ...flattenTree(document.controllers).flatMap((controller) =>
            controller.kind === "group"
              ? []
              : [
                  {
                    path: `/controller/${controller.id}`,
                    type: controller.kind === "number" ? "f" : "r",
                    description: qualifiedName(
                      document.controllers,
                      controller,
                    ),
                    value: controller.value,
                  },
                ],
          ),
          ...flattenTree(document.macros).flatMap((macro) =>
            macro.kind === "group"
              ? []
              : [
                  {
                    path: `/macro/${macro.id}`,
                    type: "I",
                    description: qualifiedName(document.macros, macro),
                  },
                ],
          ),
        ];
        cli.print({ osc: live.osc, leaves }, () =>
          [
            live.osc.port === null
              ? "OSC is off"
              : `OSC and OSCQuery on port ${String(live.osc.port)}`,
            ...leaves.map(
              (leaf) =>
                `${leaf.path.padEnd(48)} ${leaf.type}  ${leaf.description}${"value" in leaf ? `  ${JSON.stringify(leaf.value)}` : ""}`,
            ),
          ].join("\n"),
        );
      }),
    );

  const macros = program
    .command("macros")
    .description("List the Macros in their Groups (the default), or add one.");

  macros
    .command("list", { isDefault: true })
    .description(
      "List the Macros in their Groups, with their action counts and, when not All, their Run Mode.",
    )

    .action(() =>
      cli.withDocument(async (client, summary) => {
        const { document } = await cli.replica(client, summary.id);
        const nodes = treeNodes(document.macros);
        cli.print(nodes, () =>
          formatTreeNodes(nodes, describeMacro).join("\n"),
        );
      }),
    );

  macros
    .command("add <name>")
    .description(
      "Add a Macro, with a trigger action per --trigger: what a hub's button needs to play a Scene (scene/Chorus/play) or fire a Cue (layer/Chase/cue/step). Other actions go in with run macro.actions.add.",
    )
    .option(
      "--trigger <address...>",
      "a trigger Address the Macro fires, ids or names",
    )
    .option("--group <group>", "the Macro Group to add into, id or name")
    .action((name: string, options: { trigger?: string[]; group?: string }) =>
      cli.withDocument(async (client, summary) => {
        const { document } = await cli.replica(client, summary.id);
        const reply = await client.command<CommandResult>(
          summary.id,
          "macro.create",
          {
            name,
            ...(options.group === undefined
              ? {}
              : { parentId: resolveId(document, "macros", options.group) }),
            actions: (options.trigger ?? []).map((address) => ({
              kind: "trigger",
              address: resolveAddressNames(document, address),
            })),
          },
        );
        const result = await cli.named(client, summary.id, reply);
        cli.print(result, () => formatCommandResult(result, "macro.create"));
      }),
    );
}
