import { parseElementRef } from "@refrata/core";

import type { RowParent } from "@/navigator/ancestor-rows";

/** An Element's row is under its Fixture, which its ref `<fixtureId>/<key>` names. */
export const elementParent: RowParent = (document, id) => {
  const fixtureId = parseElementRef(id)?.fixtureId;
  return fixtureId === undefined || document.fixtures[fixtureId] === undefined
    ? undefined
    : { kind: "fixture", id: fixtureId };
};
