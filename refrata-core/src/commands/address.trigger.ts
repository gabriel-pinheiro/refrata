import { z } from "zod";

import { fireAddress } from "../address/fire.ts";
import { accepted, defineCommand, rejected } from "../command/command.ts";

/**
 * Firing a trigger Address. A Macro's run performs the actions its Run Mode
 * picks and their Chance lets through; any other trigger is an event the
 * runtime announces to every session subscribed to the document. All of it
 * is show input: never undone, and events are never replayed to a session
 * that connects later.
 */
export const addressTrigger = defineCommand({
  name: "address.trigger",
  kind: "performance",
  description: "Fire a trigger Address such as macro/<id>/run.",
  payload: z.object({ address: z.string().min(1) }).strict(),
  apply({ document, payload, random }) {
    const fired = fireAddress(document, payload.address, random);
    if (!fired.ok) return rejected(fired.error);
    return accepted(fired.patches, fired.events, fired.warnings, fired.run);
  },
});
