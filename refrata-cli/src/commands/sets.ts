import { setMembers, type Document } from "@refrata/core";
import type { CommandResult } from "@refrata/protocol";
import type { Command } from "commander";

import type { Cli } from "../cli.ts";
import { formatSets } from "../composition-lines.ts";
import { resolveElementRef, resolveId } from "../names.ts";
import { formatCommandResult } from "../result.ts";
import { parseRule, ruleIndex } from "../tag-lines.ts";

/** A reply with the normalisation notes above it, so a person sees what was stored. */
const withNotes = (notes: readonly string[], text: string): string =>
  [...notes, text].join("\n");

/** Every row, a Set by rule carrying the members its Rules give now. */
function setsWithMembers(document: Document): unknown[] {
  return Object.values(document.fixtureSets).map((set) =>
    set.kind === "set" ? { ...set, members: setMembers(document, set) } : set,
  );
}

/** Fixture Sets by list and by rule. */
export function registerSets(program: Command, cli: Cli): void {
  const sets = program
    .command("sets")
    .description(
      "List the Fixture Sets in their Groups (the default), add one by list or by rule, edit Rules, or convert a rule Set to a list.",
    );

  sets
    .command("list", { isDefault: true })
    .description(
      "List the Fixture Sets: a Set by rule with its numbered Rules, every Set with its members in order.",
    )
    .action(() =>
      cli.withDocument(async (client, summary) => {
        const { document } = await cli.replica(client, summary.id);
        cli.print(setsWithMembers(document), () =>
          formatSets(document).join("\n"),
        );
      }),
    );

  sets
    .command("add <name> [ref...]")
    .description(
      'Add a Fixture Set. By list: the Elements given, in order (a Fixture is its root, or <fixture>/<key>). By rule: --rule panel,odd --rule wall; each Rule is all of its Tags, the Set is their union Rule by Rule, and --rule "" is every Fixture.',
    )
    .option(
      "--rule <tags>",
      "a Rule as a comma list of Tags; repeat for several",
      (value: string, previous: string[]) => [...previous, value],
      [] as string[],
    )
    .action((name: string, refs: string[], local: { rule: string[] }) =>
      cli.withDocument(async (client, summary) => {
        const { document } = await cli.replica(client, summary.id);
        if (local.rule.length > 0 && refs.length > 0)
          throw new Error(
            "A Fixture Set is by rule or by list: give --rule or Elements, not both.",
          );
        const parsed = local.rule.map(parseRule);
        const payload =
          parsed.length > 0
            ? { name, rules: parsed.map((rule) => rule.tags) }
            : {
                name,
                members: refs.map((text) => resolveElementRef(document, text)),
              };
        const reply = await client.command<CommandResult>(
          summary.id,
          "set.create",
          payload,
        );
        const result = await cli.named(client, summary.id, reply);
        cli.print(result, () =>
          withNotes(
            parsed.flatMap((rule) => rule.notes),
            formatCommandResult(result, "set.create"),
          ),
        );
      }),
    );

  sets
    .command("rules <set> <action> [args...]")
    .description(
      'Edit a rule Set\'s Rules, numbered from 1 as "sets" prints them: rules Mixed add panel,odd · rules Mixed set 2 wall,floor · rules Mixed move 2 1 · rules Mixed remove 1. add "" is every Fixture.',
    )
    .action((set: string, action: string, args: string[]) =>
      cli.withDocument(async (client, summary) => {
        const { document } = await cli.replica(client, summary.id);
        const setId = resolveId(document, "fixtureSets", set);
        const [first, second] = args;
        let notes: readonly string[] = [];
        let command: string;
        let payload: Record<string, unknown>;
        if (action === "add") {
          const rule = parseRule(first ?? "");
          notes = rule.notes;
          command = "set.rules.add";
          payload = { setId, tags: rule.tags };
        } else if (action === "set") {
          if (first === undefined)
            throw new Error("rules set needs a Rule number and its Tags.");
          const rule = parseRule(second ?? "");
          notes = rule.notes;
          command = "set.rules.update";
          payload = { setId, index: ruleIndex(first), tags: rule.tags };
        } else if (action === "move") {
          if (first === undefined || second === undefined)
            throw new Error("rules move needs the Rule number and where to.");
          command = "set.rules.move";
          payload = { setId, index: ruleIndex(first), to: ruleIndex(second) };
        } else if (action === "remove") {
          if (first === undefined)
            throw new Error("rules remove needs a Rule number.");
          command = "set.rules.remove";
          payload = { setId, index: ruleIndex(first) };
        } else
          throw new Error(
            `rules takes add, set, move or remove after the Set, not “${action}”.`,
          );
        const result = await client.command<CommandResult>(
          summary.id,
          command,
          payload,
        );
        cli.print(result, () =>
          withNotes(notes, formatCommandResult(result, command)),
        );
      }),
    );

  sets
    .command("convert <set>")
    .description(
      "Turn a Set by rule into a list of the members it has now. One way: Fixtures tagged later no longer join.",
    )
    .action((set: string) =>
      cli.withDocument(async (client, summary) => {
        const { document } = await cli.replica(client, summary.id);
        const result = await client.command<CommandResult>(
          summary.id,
          "set.convert",
          { setId: resolveId(document, "fixtureSets", set) },
        );
        cli.print(result, () => formatCommandResult(result, "set.convert"));
      }),
    );
}
