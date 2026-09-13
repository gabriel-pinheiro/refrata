import type { Command } from "commander";

import type { Cli } from "../cli.ts";
import { formatLiveStatus, liveStatus } from "../live-status.ts";

export function registerStatus(program: Command, cli: Cli): void {
  program
    .command("health")
    .description(
      "Show the runtime, its open Installation (and whether it has unsaved changes) and the OSC door.",
    )
    .action(() =>
      cli.withClient(async (client) => {
        const sessionId = client.sessionId.get();
        const summary = client.document.get();
        if (summary === null) {
          cli.print(
            { sessionId, document: null, live: null },
            () =>
              `Connected as ${sessionId ?? "?"}\n  No Installation is open.`,
          );
          return;
        }
        const { view } = await cli.replica(client, summary.id);
        const live = liveStatus(view.liveState.get());
        cli.print({ sessionId, document: summary, live }, () =>
          [
            `Connected as ${sessionId ?? "?"}`,
            `  ${summary.name}  ${summary.id}  ${summary.path ?? "(unsaved)"}${summary.dirty ? "  unsaved changes" : ""}  revision ${String(summary.revision)}`,
            ...formatLiveStatus(live).map((line) => `  ${line}`),
          ].join("\n"),
        );
      }),
    );
}
