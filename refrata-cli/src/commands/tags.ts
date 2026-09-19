import { tagsInUse } from "@refrata/core";
import type { CommandResult } from "@refrata/protocol";
import type { Command } from "commander";

import type { Cli } from "../cli.ts";
import { resolveElementRef } from "../names.ts";
import { formatCommandResult } from "../result.ts";
import { formatTags, normaliseTags } from "../tag-lines.ts";

/** Tags: listing them, putting a person's on Fixtures and Elements, renaming. */
export function registerTags(program: Command, cli: Cli): void {
  const tags = program
    .command("tags")
    .description(
      "List every Tag in the Rig with how many Elements carry it (the default), or rename one.",
    );

  tags
    .command("list", { isDefault: true })
    .description(
      "List the Tags: declared ones (an Element's key, its Mode's Tags, the Fixture Type key on a root) are locked; a person's come from \"tag\".",
    )
    .action(() =>
      cli.withDocument(async (client, summary) => {
        const { document } = await cli.replica(client, summary.id);
        cli.print(tagsInUse(document), () => {
          const lines = formatTags(document);
          return lines.length === 0
            ? "No Tags: the Rig is empty."
            : lines.join("\n");
        });
      }),
    );

  tags
    .command("rename <old> <new>")
    .description(
      "Rename a person's Tag on every Fixture and Element and in every Rule, one undo step; onto an existing Tag it merges. Declared Tags stay.",
    )
    .action((from: string, to: string) =>
      cli.withDocument(async (client, summary) => {
        const renamed = normaliseTags([to]);
        const result = await client.command<CommandResult>(
          summary.id,
          "tag.rename",
          { from, to: renamed.tags[0] },
        );
        cli.print(result, () =>
          [...renamed.notes, formatCommandResult(result, "tag.rename")].join(
            "\n",
          ),
        );
      }),
    );

  const edit = (name: "tag" | "untag", command: string, description: string) =>
    program
      .command(`${name} <target> <tag...>`)
      .description(description)
      .action((target: string, texts: string[]) =>
        cli.withDocument(async (client, summary) => {
          const { document } = await cli.replica(client, summary.id);
          const normalised = normaliseTags(texts);
          const result = await client.command<CommandResult>(
            summary.id,
            command,
            {
              refs: [resolveElementRef(document, target)],
              tags: normalised.tags,
            },
          );
          cli.print(result, () =>
            [...normalised.notes, formatCommandResult(result, command)].join(
              "\n",
            ),
          );
        }),
      );

  edit(
    "tag",
    "fixture.tags.add",
    'Add a person\'s Tags to a Fixture (its root) or to <fixture>/<key>: tag "Strobe 1" truss-left. Tags are lowercase with dashes; "Truss Left" is written truss-left. Rule Sets follow at once.',
  );
  edit(
    "untag",
    "fixture.tags.remove",
    "Remove a person's Tags from a Fixture or <fixture>/<key>. Declared Tags are locked.",
  );
}
