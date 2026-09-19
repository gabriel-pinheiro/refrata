import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import type { Patch } from "../document/patch.ts";
import { PersonTagSchema } from "../document/rig.ts";
import { declaredTags, personTags, personTagsPath } from "../document/tags.ts";
import { locateElement, memberProblem } from "../document/targets.ts";

/**
 * Adds a person's Tags to any mix of Fixtures (their root Element) and
 * Elements, one undo step. A Tag the Element already carries, declared or
 * not, is skipped.
 */
export const fixtureTagsAdd = defineCommand({
  name: "fixture.tags.add",
  kind: "authoring",
  description:
    "Add Tags to Elements (refs <fixtureId>/<key>; <fixtureId>/root is the Fixture).",
  payload: z
    .object({
      refs: z.array(z.string().min(1)).min(1),
      tags: z.array(PersonTagSchema).min(1),
    })
    .strict(),
  label: ({ tags }) => (tags.length === 1 ? "Add Tag" : "Add Tags"),
  apply({ document, payload }) {
    const patches: Patch[] = [];
    for (const ref of new Set(payload.refs)) {
      const problem = memberProblem(document, ref);
      if (problem !== undefined) return rejected(problem);
      const located = locateElement(document, ref);
      if (located === undefined) continue;
      const { fixture, element } = located;
      const declared = new Set(declaredTags(fixture, element));
      const current = personTags(fixture, element.key);
      const next = [
        ...new Set([
          ...current,
          ...payload.tags.filter((tag) => !declared.has(tag)),
        ]),
      ];
      if (next.length === current.length) continue;
      patches.push({
        op: "set",
        path: personTagsPath(fixture, element.key),
        value: next,
      });
    }
    return accepted(patches);
  },
});
