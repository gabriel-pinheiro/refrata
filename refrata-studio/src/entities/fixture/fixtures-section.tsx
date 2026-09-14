import type { DocumentView } from "@refrata/client";
import { childFixtures, type Fixture, type Table } from "@refrata/core";
import { useState } from "react";

import { NameDialog, type NameRequest } from "@/components/name-dialog";
import { useCommand, useDocumentPath } from "@/lib/client";
import { useExpansion } from "@/navigator/expansion";
import type { CreateItem } from "@/navigator/navigator-row";
import { NavigatorSection } from "@/navigator/navigator-section";
import { useSelection } from "@/selection/selection";

import { AddFixtureDialog } from "./add-fixture-dialog";
import { fixtureIcons } from "./fixture-icons";
import { FixtureRows } from "./fixture-rows";

function generateGroupId(): string {
  return `fixture_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

/**
 * Navigator section listing the Fixtures as a tree of Groups, each Fixture
 * opening to its Elements. Adding a Fixture picks a type and Mode from the
 * library; adding a Group asks for a name.
 */
export function FixturesSection({ view }: { readonly view: DocumentView }) {
  const command = useCommand(view);
  const { select } = useSelection();
  const { setExpanded } = useExpansion();
  const table = useDocumentPath<Table<Fixture>>(view, ["fixtures"]);
  const fixtures = table ?? {};
  const [naming, setNaming] = useState<NameRequest | undefined>(undefined);
  const [adding, setAdding] = useState<{ parentId: string | null } | undefined>(
    undefined,
  );
  const roots = childFixtures(fixtures, null);
  if (table === undefined) return null;

  function requestGroup(parentId: string | null): void {
    const siblings = childFixtures(fixtures, parentId);
    setNaming({
      title: "New Group",
      label: "Name",
      initial: `Group ${String(siblings.length + 1)}`,
      submitLabel: "Create",
      onSubmit: (name) => {
        const id = generateGroupId();
        void command("fixture.create", {
          id,
          kind: "group",
          parentId,
          name,
        }).then(() => {
          if (parentId !== null) setExpanded("fixture", parentId, true);
          select({ kind: "fixture", id });
        });
      },
    });
  }

  const createItems = (parentId: string | null): readonly CreateItem[] => [
    {
      label: "Fixture",
      icon: fixtureIcons.fixture,
      onSelect: () => setAdding({ parentId }),
    },
    {
      label: "Group",
      icon: fixtureIcons.group,
      onSelect: () => requestGroup(parentId),
    },
  ];

  return (
    <>
      <NavigatorSection
        storageKey="fixture"
        label="Fixtures"
        empty={
          roots.length === 0 ? "No Fixtures. Press + to add one." : undefined
        }
        createItems={createItems(null)}
      >
        <FixtureRows
          view={view}
          parentId={null}
          depth={1}
          createItems={createItems}
        />
      </NavigatorSection>
      <NameDialog request={naming} onClose={() => setNaming(undefined)} />
      {adding !== undefined && (
        <AddFixtureDialog
          view={view}
          parentId={adding.parentId}
          onClose={() => setAdding(undefined)}
        />
      )}
    </>
  );
}
