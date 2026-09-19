import type { DocumentView } from "@refrata/client";
import {
  elementsOf,
  parseElementRef,
  type Fixture,
  type StoredFixtureType,
} from "@refrata/core";
import { useEffect } from "react";

import { TargetActionsSection } from "@/entities/target/target-actions";
import { InspectorHeading } from "@/inspector/fields/inspector-heading";
import { InspectorSection } from "@/inspector/fields/inspector-section";
import { TagsField } from "@/inspector/fields/tags-field";
import { useDocumentPath } from "@/lib/client";
import { useSelection } from "@/selection/selection";

import { ParameterRows } from "./parameter-rows";

/**
 * One Element below a Fixture's root: its name, its Tags (the ones its Mode
 * declares locked, a person's own editable), its own Parameters with
 * resolved values, and what it can be used for as a Target. Nothing else
 * here is editable; the Fixture Type defines it.
 */
export function ElementInspector({
  view,
  id,
}: {
  readonly view: DocumentView;
  readonly id: string;
}) {
  const { select } = useSelection();
  const parsed = parseElementRef(id);
  const fixture = useDocumentPath<Fixture>(view, [
    "fixtures",
    parsed?.fixtureId ?? "",
  ]);
  const stored = useDocumentPath<StoredFixtureType>(view, [
    "fixtureTypes",
    fixture?.kind === "fixture" ? fixture.typeKey : "",
  ]);
  const mode =
    fixture?.kind === "fixture"
      ? stored?.type.modes[fixture.modeKey]
      : undefined;
  const element =
    mode === undefined
      ? undefined
      : elementsOf(mode).find((candidate) => candidate.key === parsed?.key);
  useEffect(() => {
    if (fixture === undefined || (mode !== undefined && element === undefined))
      select(
        fixture === undefined
          ? { kind: "installation" }
          : { kind: "fixture", id: fixture.id },
      );
  }, [fixture, mode, element, select]);
  if (fixture === undefined || element === undefined) return null;
  return (
    <>
      <InspectorHeading name={`${fixture.name} · ${element.name}`} id={id} />
      <InspectorSection storageKey="tags" label="Tags">
        <TagsField view={view} refs={[id]} />
      </InspectorSection>
      <ParameterRows view={view} elementId={id} element={element} />
      <TargetActionsSection view={view} refs={[id]} />
    </>
  );
}
