import { z } from "zod";

import { resolveAddress } from "../address/address.ts";
import { effectiveValue, linkTarget } from "../address/links.ts";
import { valuePatch } from "../address/write.ts";
import { accepted, defineCommand, rejected } from "../command/command.ts";
import type { CommandContext } from "../command/command.ts";
import { isPresetLink, type Link } from "../document/document.ts";
import type { Patch } from "../document/patch.ts";

/**
 * Patches that end a Link: the target keeps what it was showing, so nothing
 * on the wall changes when a Controller lets go, then the Link is removed.
 * A row linked to a Preset showed one value per Element, which one row
 * cannot keep: it goes back to the value authored under the Link, or to
 * released when there is none. An Aim of a Region goes back to its typed
 * value, which stayed under the Link.
 */
export function releaseLink(
  { document }: Pick<CommandContext<unknown>, "document">,
  link: Link,
): Patch[] {
  const patches: Patch[] = [];
  const resolved = resolveAddress(document, link.address);
  if (resolved !== undefined && !isPresetLink(link))
    patches.push(
      valuePatch(document, resolved.path, effectiveValue(document, resolved)),
    );
  patches.push({ op: "remove", path: ["links", link.id] });
  return patches;
}

export const linkRemove = defineCommand({
  name: "link.remove",
  kind: "authoring",
  description:
    "Unlink an Address from its Controller, keeping its current value, or from its Preset, going back to the value authored under the Link.",
  payload: z.object({ linkId: z.string().min(1) }).strict(),
  label: ({ linkId }, { document }) => {
    const link = document.links[linkId];
    const label =
      link === undefined
        ? undefined
        : linkTarget(document, link.address)?.label;
    return label === undefined ? "Unlink" : `Unlink ${label}`;
  },
  apply(context) {
    const link = context.document.links[context.payload.linkId];
    if (link === undefined)
      return rejected(`Link “${context.payload.linkId}” does not exist.`);
    return accepted(releaseLink(context, link));
  },
});
