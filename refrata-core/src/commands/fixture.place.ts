import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { PositionSchema } from "../document/rig.ts";

/** Moves a Fixture in stage space (what a drag in the Rig View sends); a drag undoes as one step. */
export const fixturePlace = defineCommand({
  name: "fixture.place",
  kind: "authoring",
  description:
    "Set a Fixture's Position: x, y, z in metres and rx, ry, rz in degrees; fields left out keep their value.",
  payload: z
    .object({
      fixtureId: z.string().min(1),
      position: PositionSchema.partial(),
    })
    .strict(),
  label: () => "Place Fixture",
  coalesceKey: ({ fixtureId }) => `fixture.place:${fixtureId}`,
  apply({ document, payload }) {
    const fixture = document.fixtures[payload.fixtureId];
    if (fixture?.kind !== "fixture")
      return rejected(`Fixture “${payload.fixtureId}” does not exist.`);
    const position = { ...fixture.position };
    for (const [axis, value] of Object.entries(payload.position)) {
      if (typeof value !== "number" || !Number.isFinite(value))
        return rejected(`Position ${axis} must be a finite number.`);
      position[axis as keyof typeof position] = value;
    }
    if (
      Object.entries(position).every(
        ([axis, value]) =>
          fixture.position[axis as keyof typeof position] === value,
      )
    )
      return accepted([]);
    return accepted([
      {
        op: "set",
        path: ["fixtures", fixture.id, "position"],
        value: position,
      },
    ]);
  },
});
