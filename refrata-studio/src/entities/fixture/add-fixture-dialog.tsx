import type { DocumentView } from "@refrata/client";
import {
  footprintOf,
  generateId,
  type StoredFixtureType,
  type Table,
} from "@refrata/core";
import type { LibraryEntry } from "@refrata/protocol";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/inspector/fields/select-field";
import { useClient, useCommand, useDocumentPath } from "@/lib/client";
import { useSelection } from "@/selection/selection";

import { fetchFixtureType, useLibrary } from "./use-library";

/** One type the picker offers: the Installation's when it holds the key, else the library's. */
interface Offered extends LibraryEntry {
  readonly held: boolean;
}

/** The Installation's types and the library's, one row per key, the Installation's winning. */
function offeredTypes(
  held: Table<StoredFixtureType>,
  library: readonly LibraryEntry[],
): readonly Offered[] {
  const rows = new Map<string, Offered>();
  for (const entry of library) rows.set(entry.key, { ...entry, held: false });
  for (const { type } of Object.values(held))
    rows.set(type.key, {
      key: type.key,
      manufacturer: type.manufacturer,
      model: type.model,
      modes: Object.entries(type.modes).map(([key, mode]) => ({
        key,
        name: mode.name,
        footprint: footprintOf(mode),
      })),
      held: true,
    });
  return [...rows.values()].sort((a, b) =>
    `${a.manufacturer} ${a.model}`.localeCompare(
      `${b.manufacturer} ${b.model}`,
    ),
  );
}

/** A type's manufacturer and model, with its key when another offered type is called the same. */
function typeLabel(offered: readonly Offered[], entry: Offered): string {
  const name = `${entry.manufacturer} ${entry.model}`;
  const shared = offered.some(
    (other) =>
      other.key !== entry.key &&
      `${other.manufacturer} ${other.model}` === name,
  );
  return shared ? `${name} (${entry.key})` : name;
}

/**
 * Picks a Fixture Type and Mode and names the Fixture. It lists the
 * Installation's types and the library's together; picking a library type
 * the Installation lacks brings it in with the Fixture.
 */
export function AddFixtureDialog({
  view,
  parentId,
  onClose,
}: {
  readonly view: DocumentView;
  readonly parentId: string | null;
  readonly onClose: () => void;
}) {
  const client = useClient();
  const command = useCommand(view);
  const { select } = useSelection();
  const { entries: library, error } = useLibrary();
  const held =
    useDocumentPath<Table<StoredFixtureType>>(view, ["fixtureTypes"]) ?? {};
  const entries =
    library === undefined && error === undefined
      ? undefined
      : offeredTypes(held, library ?? []);
  const [typeKey, setTypeKey] = useState<string | null>(null);
  const [modeKey, setModeKey] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const chosen = entries?.find((entry) => entry.key === typeKey);
  const mode =
    chosen?.modes.find((candidate) => candidate.key === modeKey) ??
    chosen?.modes[0];

  async function submit(): Promise<void> {
    if (chosen === undefined || mode === undefined) return;
    setBusy(true);
    try {
      const fixtureType = chosen.held
        ? undefined
        : await fetchFixtureType(client, chosen.key);
      const id = generateId("fixture");
      await command("fixture.create", {
        id,
        parentId,
        typeKey: chosen.key,
        modeKey: mode.key,
        ...(fixtureType === undefined ? {} : { fixtureType }),
        ...(name.trim() === "" ? {} : { name: name.trim() }),
      });
      select({ kind: "fixture", id });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>New Fixture</DialogTitle>
            <DialogDescription>
              Pick a Fixture Type and Mode. One from the library comes into the
              Installation with the Fixture.
            </DialogDescription>
          </DialogHeader>
          {error !== undefined && (
            <p className="text-xs text-destructive">{error}</p>
          )}
          <SelectField
            label="Fixture Type"
            value={typeKey}
            noneLabel={entries === undefined ? "Loading…" : "Choose a type"}
            options={(entries ?? []).map((entry) => ({
              value: entry.key,
              label: `${typeLabel(entries ?? [], entry)}${entry.held ? "" : ", from the library"}`,
            }))}
            onValueChange={(next) => {
              setTypeKey(next);
              setModeKey(null);
            }}
          />
          <SelectField
            label="Mode"
            value={mode?.key ?? null}
            options={(chosen?.modes ?? []).map((candidate) => ({
              value: candidate.key,
              label: `${candidate.name} (${String(candidate.footprint)} channels)`,
            }))}
            onValueChange={setModeKey}
          />
          <Label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Name</span>
            <Input
              value={name}
              placeholder={chosen?.model ?? "Fixture"}
              onChange={(event) => setName(event.currentTarget.value)}
            />
          </Label>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={chosen === undefined || busy}>
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
