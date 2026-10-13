import {
  canTakeLibrary,
  fixturesOfType,
  originOf,
  originText,
  type Fixture,
  type FixtureTypeStanding,
  type Table,
} from "@refrata/core";
import { Copy, FileDown, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Block, Field, FieldGrid } from "@/inspector/fields/form-block";
import { TextBox } from "@/inspector/fields/form-inputs";
import { useDocumentPath } from "@/lib/client";

import { NotesBox } from "./notes-box";
import type { Scope } from "./scope";
import { useTypeActions } from "./use-type-actions";

/** How a type from the library stands, from the live state; undefined for one from elsewhere. */
export function useStanding(
  scope: Pick<Scope, "view" | "typeKey">,
): FixtureTypeStanding | undefined {
  return useDocumentPath<FixtureTypeStanding>(scope.view, [
    "live",
    "fixtureTypes",
    scope.typeKey,
  ]);
}

/** The type's own facts, shared by all its Modes, and what can be done with the whole type. */
export function TypeEditor({
  scope,
  onRemove,
}: {
  readonly scope: Scope;
  readonly onRemove: () => void;
}) {
  const { type, stored } = scope;
  const standing = useStanding(scope);
  const actions = useTypeActions(scope.view);
  const fixtures =
    useDocumentPath<Table<Fixture>>(scope.view, ["fixtures"]) ?? {};
  const users = fixturesOfType(fixtures, scope.typeKey).length;
  const update = (change: object): void =>
    void scope.runType("type.update", change);
  return (
    <>
      <Block title="Fixture Type">
        <FieldGrid min="9rem">
          <Field label="Manufacturer">
            <TextBox
              label="Manufacturer"
              value={type.manufacturer}
              onChange={(manufacturer) => {
                if (manufacturer.trim() !== "")
                  update({ manufacturer: manufacturer.trim() });
              }}
            />
          </Field>
          <Field label="Model">
            <TextBox
              label="Model"
              value={type.model}
              onChange={(model) => {
                if (model.trim() !== "") update({ model: model.trim() });
              }}
            />
          </Field>
          <Field label="Key">
            <span className="flex h-6 items-center truncate font-mono text-xs text-muted-foreground">
              {type.key}
            </span>
          </Field>
          <Field label="Origin">
            <span className="flex h-6 items-center text-xs">
              {originText(originOf(stored), standing)}
            </span>
          </Field>
        </FieldGrid>
        <Field label="Notes">
          <NotesBox
            label="Type notes"
            value={type.notes ?? ""}
            onChange={(notes) => update({ notes })}
          />
        </Field>
        <p className="text-xs text-muted-foreground">
          {users === 0
            ? "No Fixture uses it."
            : `Used by ${String(users)} ${users === 1 ? "Fixture" : "Fixtures"}. An edit reaches ${users === 1 ? "it" : "them"} at once.`}
        </p>
      </Block>
      <Block title="This type">
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant="outline"
            size="xs"
            onClick={() => actions.exportType(type)}
          >
            <FileDown /> Export to a file
          </Button>
          <Button
            variant="outline"
            size="xs"
            onClick={() => actions.duplicate(scope.typeKey)}
          >
            <Copy /> Duplicate
          </Button>
          {canTakeLibrary(standing) && (
            <Button
              variant="outline"
              size="xs"
              onClick={() => actions.takeLibrary([scope.typeKey], type.model)}
            >
              <RefreshCw /> Take the library's definition
            </Button>
          )}
          <Button variant="outline" size="xs" onClick={onRemove}>
            <Trash2 /> Remove
          </Button>
        </div>
      </Block>
    </>
  );
}
