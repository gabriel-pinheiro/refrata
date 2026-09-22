import { z } from "zod";

import { accepted, defineCommand } from "../command/command.ts";

/**
 * Ending a running Action before its time, or when its time is up: the
 * Runtime sends this when the Action's seconds have passed, and a client
 * may send it to stop one early. Ending what is not running changes
 * nothing. Firing is `address.trigger` on `fixture/<id>/action/<key>`.
 */
export const fixtureActionEnd = defineCommand({
  name: "fixture.action.end",
  kind: "performance",
  description:
    "Stop a running Action of a Fixture, such as a reset, before its seconds are up.",
  payload: z
    .object({ fixtureId: z.string().min(1), key: z.string().min(1) })
    .strict(),
  apply({ document, payload }) {
    const ref = `${payload.fixtureId}/${payload.key}`;
    if (document.operational.actions[ref] !== true) return accepted([]);
    return accepted([{ op: "remove", path: ["operational", "actions", ref] }]);
  },
});
