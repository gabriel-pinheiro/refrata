import { flattenTree, qualifiedName } from "@refrata/core";
import type { Command } from "commander";

import type { Cli } from "../cli.ts";
import { liveStatus } from "../live-status.ts";
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
      "List the OSC tree a hub such as Chataigne binds to: one leaf per Controller (float 0–1 or RGBA colour) and per Macro (impulse), each described as Group · Name.",
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
                `${leaf.path.padEnd(36)} ${leaf.type}  ${leaf.description}${"value" in leaf ? `  ${JSON.stringify(leaf.value)}` : ""}`,
            ),
          ].join("\n"),
        );
      }),
    );

  program
    .command("macros")
    .description("List the Macros in their Groups, with their action counts.")
    .action(() =>
      cli.withDocument(async (client, summary) => {
        const { document } = await cli.replica(client, summary.id);
        const nodes = treeNodes(document.macros);
        cli.print(nodes, () =>
          formatTreeNodes(nodes, describeMacro).join("\n"),
        );
      }),
    );
}
