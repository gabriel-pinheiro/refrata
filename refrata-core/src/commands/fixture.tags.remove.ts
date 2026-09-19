import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import type { Patch } from "../document/patch.ts";
import { ROOT_ELEMENT_KEY } from "../rig/fixture-type.ts";
import { personTags, personTagsPath } from "../document/tags.ts";
import { locateElement, memberProblem } from "../document/targets.ts";

/**
 * Removes a person's Tags from any mix of Fixtures and Elements, one undo
 * step. Declared Tags are locked: asking to remove one is refused.
 */
export const fixtureTagsRemove = defineCommand({
  name: "fixture.tags.remove",
  kind: "authoring",
  description: "Remove a person's Tags from Elements (refs <fixtureId>/<key>).",
  payload: z
    .object({
      refs: z.array(z.string().min(1)).min(1),
      tags: z.array(z.string().min(1)).min(1),
    })
    .strict(),
  label: ({ tags }) => (tags.length === 1 ? "Remove Tag" : "Remove Tags"),
  apply({ document, payload }) {
    const going = new Set(payload.tags);
    const patches: Patch[] = [];
    let found = false;
    for (const ref of new Set(payload.refs)) {
      const problem = memberProblem(document, ref);
      if (problem !== undefined) return rejected(problem);
      const located = locateElement(document, ref);
      if (located === undefined) continue;
      const { fixture, element } = located;
      const current = personTags(fixture, element.key);
      const next = current.filter((tag) => !going.has(tag));
      if (next.length === current.length) continue;
      found = true;
      const path = personTagsPath(fixture, element.key);
      patches.push(
        next.length === 0 && element.key !== ROOT_ELEMENT_KEY
          ? { op: "remove", path }
          : { op: "set", path, value: next },
      );
    }
    if (!found)
      return rejected(
        `None of these carries ${payload.tags.map((tag) => `“${tag}”`).join(", ")} as a person's Tag; declared Tags are locked.`,
      );
    return accepted(patches);
  },
});
