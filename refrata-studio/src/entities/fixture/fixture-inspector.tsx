import type { DocumentView } from "@refrata/client";
import {
  elementRef,
  elementsOf,
  orderedEntries,
  type Fixture,
  type StoredFixtureType,
  type Universe,
  type Table,
} from "@refrata/core";
import { useEffect } from "react";

import { InspectorHeading } from "@/inspector/fields/inspector-heading";
import { InspectorSection } from "@/inspector/fields/inspector-section";
import { NameField } from "@/inspector/fields/name-field";
import { NumberField } from "@/inspector/fields/number-field";
import { SelectField } from "@/inspector/fields/select-field";
import { useCommand, useDocumentPath } from "@/lib/client";
import { useSelection } from "@/selection/selection";

import { ParameterRows } from "./parameter-rows";

/**
 * A Fixture's name, Mode, Patch and Position, then the root Element's
 * Parameters with their resolved values. A Group shows only its name.
 */
export function FixtureInspector({
  view,
  id,
}: {
  readonly view: DocumentView;
  readonly id: string;
}) {
  const command = useCommand(view);
  const { select } = useSelection();
  const fixture = useDocumentPath<Fixture>(view, ["fixtures", id]);
  useEffect(() => {
    if (fixture === undefined) select({ kind: "installation" });
  }, [fixture, select]);
  if (fixture === undefined) return null;
  return (
    <>
      <InspectorHeading name={fixture.name} id={fixture.id} />
      <div className="grid gap-3 p-3">
        <NameField
          label="Name"
          value={fixture.name}
          onCommit={(name) =>
            void command("fixture.rename", { fixtureId: id, name })
          }
        />
      </div>
      {fixture.kind === "fixture" && (
        <PatchedFixtureBody view={view} fixture={fixture} />
      )}
    </>
  );
}

function PatchedFixtureBody({
  view,
  fixture,
}: {
  readonly view: DocumentView;
  readonly fixture: Extract<Fixture, { kind: "fixture" }>;
}) {
  const command = useCommand(view);
  const stored = useDocumentPath<StoredFixtureType>(view, [
    "fixtureTypes",
    fixture.typeKey,
  ]);
  const universes = useDocumentPath<Table<Universe>>(view, ["universes"]) ?? {};
  const type = stored?.type;
  const mode = type?.modes[fixture.modeKey];
  const root = mode === undefined ? undefined : elementsOf(mode)[0];
  const patch = fixture.patch;
  const position = fixture.position;
  const place = (axis: keyof typeof position, value: number): void =>
    void command("fixture.place", {
      fixtureId: fixture.id,
      position: { [axis]: value },
    });
  return (
    <>
      <InspectorSection storageKey="fixture-type" label="Type">
        <p className="text-xs">
          {type === undefined
            ? `${fixture.typeKey} (missing)`
            : `${type.manufacturer} ${type.model}`}
        </p>
        <SelectField
          label="Mode"
          value={fixture.modeKey}
          options={Object.entries(type?.modes ?? {}).map(
            ([key, candidate]) => ({
              value: key,
              label: candidate.name,
            }),
          )}
          onValueChange={(modeKey) => {
            if (modeKey !== null && modeKey !== fixture.modeKey)
              void command("fixture.update", {
                fixtureId: fixture.id,
                modeKey,
              });
          }}
        />
      </InspectorSection>
      <InspectorSection storageKey="patch" label="Patch">
        <SelectField
          label="Universe"
          value={patch?.universeId ?? null}
          noneLabel="Unpatched"
          options={orderedEntries(universes).map((universe) => ({
            value: universe.id,
            label: universe.name,
          }))}
          onValueChange={(universeId) =>
            void command("fixture.patch", {
              fixtureId: fixture.id,
              patch:
                universeId === null
                  ? null
                  : { universeId, address: patch?.address ?? 1 },
            })
          }
        />
        {patch !== null && (
          <NumberField
            label="Address"
            value={patch.address}
            decimals={0}
            step={1}
            onCommit={(address) =>
              void command("fixture.patch", {
                fixtureId: fixture.id,
                patch: { universeId: patch.universeId, address },
              })
            }
          />
        )}
      </InspectorSection>
      <InspectorSection storageKey="position" label="Position">
        <div className="grid grid-cols-3 gap-2">
          {(["x", "y", "z"] as const).map((axis) => (
            <NumberField
              key={axis}
              label={axis.toUpperCase()}
              value={position[axis]}
              step={0.05}
              unit="m"
              onCommit={(value) => place(axis, value)}
            />
          ))}
          {(["rx", "ry", "rz"] as const).map((axis) => (
            <NumberField
              key={axis}
              label={axis.toUpperCase()}
              value={position[axis]}
              decimals={0}
              step={1}
              unit="°"
              onCommit={(value) => place(axis, value)}
            />
          ))}
        </div>
      </InspectorSection>
      {root !== undefined && (
        <ParameterRows
          view={view}
          elementId={elementRef(fixture.id, root.key)}
          element={root}
        />
      )}
    </>
  );
}
