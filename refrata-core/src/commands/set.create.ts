import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import {
  FIXTURE_SET_KINDS,
  FIXTURE_SET_LABELS,
  RuleSchema,
  type FixtureSet,
} from "../document/composition.ts";
import { childSets } from "../document/fixture-sets.ts";
import { uniqueName } from "../document/names.ts";
import { memberProblem } from "../document/targets.ts";
import { orderKeyForNew } from "../document/tree.ts";
import { generateId, id } from "../ids.ts";
import { cleanRule, sameRule } from "./set-rules.ts";

/**
 * A new Fixture Set lands first at the root or in the Group it was added
 * to, or right after the sibling `after` names, holding the members given
 * in their order: "New Set from selection" is this command with the
 * Selection as members. Given `rules` it is a Set by rule instead and holds
 * no members of its own. A Group only arranges Sets in the navigator.
 */
export const setCreate = defineCommand({
  name: "set.create",
  kind: "authoring",
  description:
    "Add a Fixture Set by list (members: Element refs) or by rule (rules: lists of Tags), or a Group.",
  payload: z
    .object({
      id: z.string().min(1).optional(),
      kind: z.enum(FIXTURE_SET_KINDS).default("set"),
      /** Group to add into; null for the root. */
      parentId: z.string().min(1).nullable().default(null),
      name: z.string().trim().min(1).max(120).optional(),
      /** Element refs (<fixtureId>/<key>), in the Set's order. */
      members: z.array(z.string().min(1)).optional(),
      /** Makes it a Set by rule: each Rule is all of its Tags, none for every Fixture. */
      rules: z.array(RuleSchema).optional(),
      /** Sibling to land after; null or absent for first. */
      after: z.string().min(1).nullable().optional(),
    })
    .strict(),
  label: ({ kind }) => `Add ${FIXTURE_SET_LABELS[kind]}`,
  apply({ document, payload }) {
    const setId =
      payload.id === undefined
        ? generateId("fixtureSet")
        : id("fixtureSet", payload.id);
    if (setId in document.fixtureSets)
      return rejected(`Fixture Set “${setId}” already exists.`);
    if (payload.parentId !== null) {
      const parent = document.fixtureSets[payload.parentId];
      if (parent?.kind !== "group")
        return rejected(`“${payload.parentId}” is not a Fixture Set Group.`);
    }
    const siblings = childSets(document.fixtureSets, payload.parentId);
    const order = orderKeyForNew(
      siblings,
      payload.after ?? null,
      "Fixture Set",
    );
    if (typeof order !== "string") return rejected(order.error);
    const base = {
      id: setId,
      name: uniqueName(
        siblings.map((sibling) => sibling.name),
        payload.name ?? (payload.kind === "set" ? "Set" : "Group"),
      ),
      parentId: payload.parentId,
      order,
    };
    if (payload.kind === "group") {
      const group: FixtureSet = { ...base, kind: "group" };
      return accepted([
        { op: "set", path: ["fixtureSets", setId], value: group },
      ]);
    }
    if (payload.rules !== undefined) {
      if ((payload.members ?? []).length > 0)
        return rejected("A Fixture Set is by rule or by list, never both.");
      const rules = payload.rules
        .map(cleanRule)
        .filter(
          (rule, index, all) =>
            all.findIndex((other) => sameRule(other, rule)) === index,
        );
      const set: FixtureSet = { ...base, kind: "set", members: [], rules };
      return accepted([
        { op: "set", path: ["fixtureSets", setId], value: set },
      ]);
    }
    const members = [...new Set(payload.members ?? [])];
    for (const ref of members) {
      const problem = memberProblem(document, ref);
      if (problem !== undefined) return rejected(problem);
    }
    const set: FixtureSet = { ...base, kind: "set", members };
    return accepted([{ op: "set", path: ["fixtureSets", setId], value: set }]);
  },
});
