import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { allSets, isRuleSet } from "../document/fixture-sets.ts";
import { allFixtures } from "../document/fixtures.ts";
import type { Patch } from "../document/patch.ts";
import { PersonTagSchema } from "../document/rig.ts";
import { tagsInUse } from "../document/tags.ts";

const renamed = (tags: readonly string[], from: string, to: string) => [
  ...new Set(tags.map((tag) => (tag === from ? to : tag))),
];

/**
 * Renames a person's Tag on every Fixture and Element and in every Rule,
 * one undo step. Renaming onto an existing Tag merges the two. Declared
 * Tags are locked and stay; a warning says so when one has the old text.
 */
export const tagRename = defineCommand({
  name: "tag.rename",
  kind: "authoring",
  description: "Rename a person's Tag everywhere it is used, Rules included.",
  payload: z.object({ from: z.string().min(1), to: PersonTagSchema }).strict(),
  label: () => "Rename Tag",
  apply({ document, payload }) {
    const { from, to } = payload;
    if (from === to) return accepted([]);
    const use = tagsInUse(document).find((entry) => entry.tag === from);
    const inRules = allSets(document.fixtureSets).some(
      (set) => isRuleSet(set) && set.rules.some((rule) => rule.includes(from)),
    );
    if (use?.person !== true && !inRules)
      return rejected(
        use?.declared === true
          ? `“${from}” is a declared Tag; declared Tags are locked.`
          : `No Fixture, Element or Rule has the Tag “${from}”.`,
      );
    const patches: Patch[] = [];
    for (const fixture of allFixtures(document.fixtures)) {
      if (fixture.tags.includes(from))
        patches.push({
          op: "set",
          path: ["fixtures", fixture.id, "tags"],
          value: renamed(fixture.tags, from, to),
        });
      for (const [key, tags] of Object.entries(fixture.elementTags))
        if (tags.includes(from))
          patches.push({
            op: "set",
            path: ["fixtures", fixture.id, "elementTags", key],
            value: renamed(tags, from, to),
          });
    }
    for (const set of allSets(document.fixtureSets)) {
      if (!isRuleSet(set)) continue;
      if (!set.rules.some((rule) => rule.includes(from))) continue;
      patches.push({
        op: "set",
        path: ["fixtureSets", set.id, "rules"],
        value: set.rules.map((rule) => renamed(rule, from, to)),
      });
    }
    const warnings =
      use?.declared === true
        ? [
            `“${from}” is also a declared Tag; Elements that declare it keep it.`,
          ]
        : [];
    return accepted(patches, undefined, warnings);
  },
});
