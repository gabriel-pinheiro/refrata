import type { DocumentView } from "@refrata/client";
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
import { useClient, useCommand } from "@/lib/client";
import { useExpansion } from "@/navigator/expansion";
import { useSelection } from "@/selection/selection";

import { fetchFixtureType, useLibrary } from "./use-library";

function generateFixtureId(): string {
  return `fixture_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

/**
 * Picks a Fixture Type and Mode from the library and names the Fixture. The
 * type file travels with the command, so the Installation holds its own
 * copy from the first Fixture on.
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
  const { setExpanded } = useExpansion();
  const { entries, error } = useLibrary();
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
      const fixtureType = await fetchFixtureType(client, chosen.key);
      const id = generateFixtureId();
      await command("fixture.create", {
        id,
        parentId,
        typeKey: chosen.key,
        modeKey: mode.key,
        fixtureType,
        ...(name.trim() === "" ? {} : { name: name.trim() }),
      });
      if (parentId !== null) setExpanded("fixture", parentId, true);
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
              Pick a Fixture Type and Mode from the library.
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
              label: `${entry.manufacturer} ${entry.model}`,
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
