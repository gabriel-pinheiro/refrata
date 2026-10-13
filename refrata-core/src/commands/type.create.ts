import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { storedFixtureType } from "../document/fixture-types.ts";
import { blankType, typeKeyFor } from "../rig/edits/modes.ts";
import { settings } from "../settings.ts";

/**
 * Makes a Fixture Type from nothing: one Mode named for its Channel count,
 * that many one-byte Channels on the root Element. Its key comes from the
 * manufacturer and model, made unique, and never changes afterwards.
 */
export const typeCreate = defineCommand({
  name: "type.create",
  kind: "authoring",
  description:
    "Make a blank Fixture Type: a manufacturer, a model and how many one-byte Channels its first Mode has.",
  payload: z
    .object({
      manufacturer: z.string().trim().min(1).max(120),
      model: z.string().trim().min(1).max(120),
      channels: z
        .number()
        .int()
        .min(1)
        .max(settings.fixtureTypes.maxNewChannels)
        .default(1),
    })
    .strict(),
  label: () => "New Fixture Type",
  apply({ document, payload }) {
    const key = typeKeyFor(
      Object.keys(document.fixtureTypes),
      payload.manufacturer,
      payload.model,
    );
    if (key === undefined)
      return rejected(
        "Give the manufacturer and the model each a name with a letter or a digit.",
      );
    return accepted([
      {
        op: "set",
        path: ["fixtureTypes", key],
        value: storedFixtureType(
          blankType(key, payload.manufacturer, payload.model, payload.channels),
          { from: "installation" },
        ),
      },
    ]);
  },
});
