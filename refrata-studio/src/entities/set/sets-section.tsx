import type { DocumentView } from "@refrata/client";
import { childSets, type FixtureSet, type Table } from "@refrata/core";
import { MousePointerClick } from "lucide-react";
import { useState } from "react";

import { NameDialog, type NameRequest } from "@/components/name-dialog";
import { useCommand, useDocumentPath } from "@/lib/client";
import { useExpansion } from "@/navigator/expansion";
import type { CreateItem } from "@/navigator/navigator-row";
import { NavigatorSection } from "@/navigator/navigator-section";
import { useSelection } from "@/selection/selection";

import { setIcons } from "./set-icons";
import { SetRows } from "./set-rows";

function generateSetId(): string {
  return `fixtureSet_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

/**
 * Navigator section listing the Fixture Sets as a tree of Groups. A Set is
 * an ordered list of Elements a Layer can Target as one thing; "Set from
 * selection" takes the Elements picked in the Rig View or the navigator.
 */
export function SetsSection({ view }: { readonly view: DocumentView }) {
  const command = useCommand(view);
  const { select, picked, pick } = useSelection();
  const { setExpanded } = useExpansion();
  const table = useDocumentPath<Table<FixtureSet>>(view, ["fixtureSets"]);
  const sets = table ?? {};
  const [naming, setNaming] = useState<NameRequest | undefined>(undefined);
  const roots = childSets(sets, null);
  if (table === undefined) return null;

  function request(
    kind: "set" | "group",
    parentId: string | null,
    members: readonly string[] | undefined,
  ): void {
    const siblings = childSets(sets, parentId);
    const noun = kind === "set" ? "Set" : "Group";
    setNaming({
      title: `New ${kind === "set" ? "Fixture Set" : "Group"}`,
      label: "Name",
      initial: `${noun} ${String(siblings.length + 1)}`,
      submitLabel: "Create",
      onSubmit: (name) => {
        const id = generateSetId();
        void command("set.create", {
          id,
          kind,
          parentId,
          name,
          ...(members === undefined ? {} : { members }),
        }).then(() => {
          if (parentId !== null) setExpanded("set", parentId, true);
          if (members !== undefined) pick(members, "replace");
          select({ kind: "set", id });
        });
      },
    });
  }

  const createItems = (parentId: string | null): readonly CreateItem[] => [
    {
      label: "Fixture Set",
      icon: setIcons.set,
      onSelect: () => request("set", parentId, undefined),
    },
    ...(picked.length === 0
      ? []
      : [
          {
            label: `Set from selection (${String(picked.length)})`,
            icon: MousePointerClick,
            onSelect: () => request("set", parentId, picked),
          },
        ]),
    {
      label: "Group",
      icon: setIcons.group,
      onSelect: () => request("group", parentId, undefined),
    },
  ];

  return (
    <>
      <NavigatorSection
        storageKey="set"
        label="Sets"
        empty={
          roots.length === 0
            ? "No Fixture Sets. Press + to add one."
            : undefined
        }
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
