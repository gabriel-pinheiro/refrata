import type { DocumentView } from "@refrata/client";
import {
  OUTPUT_KINDS,
  OUTPUT_LABELS,
  orderedEntries,
  type Output,
  type Table,
  type Universe,
} from "@refrata/core";
import {
  formatOutputStatus,
  type LiveState,
  type OutputStatus,
} from "@refrata/protocol";
import { Trash2 } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { InspectorHeading } from "@/inspector/fields/inspector-heading";
import { InspectorSection } from "@/inspector/fields/inspector-section";
import { NameField } from "@/inspector/fields/name-field";
import { SelectField } from "@/inspector/fields/select-field";
import { useCommand, useDocumentPath } from "@/lib/client";
import { useSelection } from "@/selection/selection";

/** An Output's status in the CLI's words, or "not running" before the runtime reports one. */
export function describeStatus(status: OutputStatus | undefined): string {
  return status === undefined ? "not running" : formatOutputStatus(status);
}

/** An Output's Universe, widget kind, device (serial number or `any`) and live status. */
export function OutputInspector({
  view,
  id,
}: {
  readonly view: DocumentView;
  readonly id: string;
}) {
  const command = useCommand(view);
  const { select } = useSelection();
  const output = useDocumentPath<Output>(view, ["outputs", id]);
  const universes = useDocumentPath<Table<Universe>>(view, ["universes"]) ?? {};
  const status = useDocumentPath<OutputStatus>(view, ["live", "outputs", id]);
  const dmx = useDocumentPath<LiveState["dmx"]>(view, ["live", "dmx"]);
  useEffect(() => {
    if (output === undefined) select({ kind: "installation" });
  }, [output, select]);
  if (output === undefined) return null;
  const update = (patch: Record<string, unknown>): void =>
    void command("output.update", { outputId: id, ...patch });
  return (
    <>
      <InspectorHeading name={OUTPUT_LABELS[output.kind]} id={output.id} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 p-3">
        <SelectField
          label="Universe"
          value={output.universeId}
          options={orderedEntries(universes).map((universe) => ({
            value: universe.id,
            label: universe.name,
          }))}
          onValueChange={(universeId) => {
            if (universeId !== null) update({ universeId });
          }}
        />
        <SelectField
          label="Widget"
          value={output.kind}
          options={OUTPUT_KINDS.map((kind) => ({
            value: kind,
            label: OUTPUT_LABELS[kind],
          }))}
          onValueChange={(kind) => {
            if (kind !== null) update({ kind });
          }}
        />
        <NameField
          label="Device (serial number, path, USB port, or any)"
          value={output.device}
          onCommit={(device) => update({ device })}
        />
      </div>
      <InspectorSection storageKey="output-status" label="Status">
        <p className="text-xs">{describeStatus(status)}</p>
        {dmx !== undefined && (
          <p className="text-[0.6875rem] text-muted-foreground">
            Loop at {String(dmx.rateHz)} Hz, {String(dmx.fps)} fps
          </p>
        )}
        <Button
          variant="ghost"
          size="xs"
          className="justify-self-start text-destructive"
          onClick={() => void command("output.remove", { outputId: id })}
        >
          <Trash2 /> Remove Output
        </Button>
      </InspectorSection>
    </>
  );
}
