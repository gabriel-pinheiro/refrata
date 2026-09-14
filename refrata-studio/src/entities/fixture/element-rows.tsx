import type { DocumentView } from "@refrata/client";
import {
  elementRef,
  elementsOf,
  type PatchedFixture,
  type StoredFixtureType,
} from "@refrata/core";

import { useDocumentPath } from "@/lib/client";
import { NavigatorEmptyRow, NavigatorRow } from "@/navigator/navigator-row";
import { isSelected, pickModeOf, useSelection } from "@/selection/selection";

import { elementIcon } from "./fixture-icons";

/**
 * A Fixture's Elements as rows under it, derived from its Mode: selectable
 * to inspect and highlight, never dragged, renamed or removed, since the
 * Fixture Type defines them.
 */
export function ElementRows({
  view,
  fixture,
  depth,
}: {
  readonly view: DocumentView;
  readonly fixture: PatchedFixture;
  readonly depth: number;
}) {
  const { selection, select, pick } = useSelection();
  const stored = useDocumentPath<StoredFixtureType>(view, [
    "fixtureTypes",
    fixture.typeKey,
  ]);
  const mode = stored?.type.modes[fixture.modeKey];
  if (mode === undefined)
    return (
      <NavigatorEmptyRow depth={depth}>Fixture Type missing</NavigatorEmptyRow>
    );
  const elements = elementsOf(mode).filter(
    (element) => element.parentKey !== null,
  );
  if (elements.length === 0)
    return <NavigatorEmptyRow depth={depth}>One Element</NavigatorEmptyRow>;
  return (
    <>
      {elements.map((element) => {
        const ref = elementRef(fixture.id, element.key);
        return (
          <NavigatorRow
            key={ref}
            icon={elementIcon}
            label={element.name}
            depth={depth + element.depth - 1}
            selected={isSelected(selection, "element", ref)}
            onSelect={(event) => {
              pick([ref], pickModeOf(event));
              select({ kind: "element", id: ref });
            }}
          />
        );
      })}
    </>
  );
}
