import { Command } from "commander";

import { Cli, type GlobalOptions } from "./cli.ts";
import { registerAddress } from "./commands/address.ts";
import { registerDocuments } from "./commands/documents.ts";
import { registerRead } from "./commands/read.ts";
import { registerRig } from "./commands/rig.ts";
import { registerRun } from "./commands/run.ts";
import { registerStatus } from "./commands/status.ts";
import { registerTree } from "./commands/tree.ts";
import { DEFAULT_URL } from "./connection.ts";
import { SHELL_GUIDE } from "./help.ts";
import { errorReport } from "./result.ts";

/**
 * The `refrata` command. Everything an agent or a shell needs: list and
 * describe commands straight from the registry, run any of them, read the
 * document, write Addresses, undo. `--json` makes every
 * output machine readable. Anything a person can do in Studio is reachable
 * here: Studio's gestures are commands and requests, and this runs any of
 * them. Each group of subcommands lives in `commands/`.
 */
const program = new Command("refrata")
  .description(
    "Control a Refrata runtime from the shell. Everything Studio does is a command or a request, so all of it is reachable here.",
  )
  .option(
    "--url <url>",
    "runtime URL: ws://host:port/live, http://host:port or host:port",
    process.env.REFRATA_URL ?? DEFAULT_URL,
  )
  .option(
    "--json",
    "machine-readable output; errors become one JSON object on stderr",
    false,
  )
  .addHelpText("after", SHELL_GUIDE);

const cli = new Cli(program);
registerStatus(program, cli);
registerRig(program, cli);
registerTree(program, cli);
registerRead(program, cli);
registerRun(program, cli);
registerAddress(program, cli);
registerDocuments(program, cli);

try {
  await program.parseAsync();
} catch (error) {
  const report = errorReport(error);
  console.error(
    program.opts<GlobalOptions>().json ? JSON.stringify(report) : report.error,
  );
  process.exitCode = 1;
}
