import type { RowParent } from "@/navigator/ancestor-rows";

/** An Output's row is under its Universe. */
export const outputParent: RowParent = (document, id) => {
  const output = document.outputs[id];
  return output === undefined
    ? undefined
    : { kind: "universe", id: output.universeId };
};
