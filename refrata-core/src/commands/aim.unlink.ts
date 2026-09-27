import { z } from "zod";

import { linkAt } from "../address/links.ts";
import { accepted, defineCommand } from "../command/command.ts";
import { applyPatches, type Patch } from "../document/patch.ts";
import { releaseLink } from "./link.remove.ts";

/**
 * Unlinks an Aim: the Links on its `pan` and `tilt` Addresses, either or
 * both, as `link.remove` ends one, in one undo step. An axis that is not
 * linked is left as it is.
 */
export const aimUnlink = defineCommand({
  name: "aim.unlink",
  kind: "authoring",
  description:
    "Unlink an Aim as one undoable step: pan and tilt name its two Addresses, and the Link on each goes as link.remove ends it. An axis without a Link is left alone.",
  payload: z
    .object({ pan: z.string().min(1), tilt: z.string().min(1) })
    .strict(),
  label: () => "Unlink Aim",
  apply({ document, payload }) {
    let current = document;
    const patches: Patch[] = [];
    for (const address of [payload.pan, payload.tilt]) {
      const link = linkAt(current, address);
      if (link === undefined) continue;
      const released = releaseLink({ document: current }, link);
      patches.push(...released);
      current = applyPatches(current, released);
    }
    return accepted(patches);
  },
});
