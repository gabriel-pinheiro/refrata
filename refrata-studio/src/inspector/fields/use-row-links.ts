import type { DocumentView } from "@refrata/client";
import {
  generateId,
  effectiveValue,
  flattenControllers,
  linkable,
  linkAt,
  type Controller,
  type Link,
  type ResolvedAddress,
  type Table,
} from "@refrata/core";

import { useCommand, useDocumentPath } from "@/lib/client";
import { useSelection } from "@/selection/selection";

import type { RowLinks } from "./link-row";

/**
 * How any inspector row takes part in Parameter Links: given a resolved
 * Address and a name for a Controller made on the spot, the Link it has,
 * the Controllers it could take, and the commands behind the row's menu.
 * The value shown while linked is the effective one, read from the
 * document as the show sees it.
 */
export function useRowLinks(
  view: DocumentView,
): (resolved: ResolvedAddress, newControllerName: string) => RowLinks {
  const command = useCommand(view);
  const { select } = useSelection();
  const links = useDocumentPath<Table<Link>>(view, ["links"]) ?? {};
  const controllers =
    useDocumentPath<Table<Controller>>(view, ["controllers"]) ?? {};
  const ordered = flattenControllers(controllers);
  return (resolved, newControllerName) => {
    const link = linkAt({ links }, resolved.address);
    const controller =
      link === undefined ? undefined : controllers[link.controllerId];
    const document = view.get();
    return {
      link,
      controller,
      effective:
        document === undefined
          ? (resolved.default ?? 0)
          : effectiveValue(document, resolved),
      candidates: ordered.filter(
        (candidate) =>
          candidate.kind !== "group" && linkable(resolved, candidate.kind),
      ),
      onLink: (controllerId) =>
        void command("link.create", {
          controllerId,
          addresses: [resolved.address],
        }),
      onCreate: (kind) => {
        const controllerId = generateId("controller");
        void command("controller.create", {
          id: controllerId,
          kind,
          name: newControllerName,
          addresses: [resolved.address],
        }).then(() => select({ kind: "controller", id: controllerId }));
      },
      onUnlink: () => {
        if (link !== undefined)
          void command("link.remove", { linkId: link.id });
      },
      onOpen: (controllerId) =>
        select({ kind: "controller", id: controllerId }),
    };
  };
}
