import type { DocumentView } from "@refrata/client";
import {
  generateId,
  childSets,
  type FixtureSet,
  type Table,
} from "@refrata/core";
import { useState } from "react";

import { NameDialog, type NameRequest } from "@/components/name-dialog";
import { useCommand, useDocumentPath } from "@/lib/client";
import { useExpansion } from "@/navigator/expansion";
import type { CreateItem } from "@/navigator/navigator-row";
import { NavigatorSection } from "@/navigator/navigator-section";
import { useSelection } from "@/selection/selection";

import { ruleSetIcon, setIcons } from "./set-icons";
import { SetRows } from "./set-rows";

/**
 * Navigator section listing the Fixture Sets as a tree of Groups. A Set is
 * an ordered list of Elements a Layer can Target as one thing, written by
 * list or by rule; a Set from the current selection is made from the
 * selection's own inspector.
 */
export function SetsSection({ view }: { readonly view: DocumentView }) {
  const command = useCommand(view);
  const { select } = useSelection();
  const { setExpanded } = useExpansion();
  const table = useDocumentPath<Table<FixtureSet>>(view, ["fixtureSets"]);
  const sets = table ?? {};
  const [naming, setNaming] = useState<NameRequest | undefined>(undefined);
  const roots = childSets(sets, null);
  if (table === undefined) return null;

  function request(
    kind: "set" | "group",
    parentId: string | null,
    byRule = false,
  ): void {
    const siblings = childSets(sets, parentId);
    const noun = kind === "set" ? "Set" : "Group";
    setNaming({
      title: `New ${kind === "set" ? (byRule ? "Fixture Set by rule" : "Fixture Set") : "Group"}`,
      label: "Name",
      initial: `${noun} ${String(siblings.length + 1)}`,
      submitLabel: "Create",
      onSubmit: (name) => {
        const id = generateId("fixtureSet");
        void command("set.create", {
          id,
          kind,
          parentId,
          name,
          ...(byRule ? { rules: [] } : {}),
        }).then(() => {
          if (parentId !== null) setExpanded("set", parentId, true);
          select({ kind: "set", id });
        });
      },
    });
  }

  const createItems = (parentId: string | null): readonly CreateItem[] => [
    {
      label: "Fixture Set",
      icon: setIcons.set,
      onSelect: () => request("set", parentId),
    },
    {
      label: "Set by rule",
      icon: ruleSetIcon,
      onSelect: () => request("set", parentId, true),
    },
    {
      label: "Group",
      icon: setIcons.group,
      onSelect: () => request("group", parentId),
    },
  ];

  return (
    <>
      <NavigatorSection
        storageKey="set"
        holds={["set"]}
        label="Sets"
        empty={roots.length === 0 ? "No Fixture Sets yet." : undefined}
        createItems={createItems(null)}
      >
        <SetRows
          view={view}
          parentId={null}
          depth={1}
          createItems={createItems}
        />
      </NavigatorSection>
      <NameDialog request={naming} onClose={() => setNaming(undefined)} />
    </>
  );
}
