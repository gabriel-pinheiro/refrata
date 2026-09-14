import type { DocumentView } from "@refrata/client";
import {
  OUTPUT_LABELS,
  patchedIn,
  type Output,
  type Table,
  type Universe,
} from "@refrata/core";
import type { LiveState } from "@refrata/protocol";
import { useEffect } from "react";

import { InspectorHeading } from "@/inspector/fields/inspector-heading";
import { InspectorSection } from "@/inspector/fields/inspector-section";
import { NameField } from "@/inspector/fields/name-field";
import { useCommand, useDocumentPath, useSignal } from "@/lib/client";
import { useSelection } from "@/selection/selection";

import { describeStatus } from "./output-inspector";

/** A Universe's name, its Outputs with their status, and what is patched in it. */
export function UniverseInspector({
  view,
  id,
}: {
  readonly view: DocumentView;
  readonly id: string;
}) {
  const command = useCommand(view);
  const { select } = useSelection();
  const universe = useDocumentPath<Universe>(view, ["universes", id]);
  const outputs = useDocumentPath<Table<Output>>(view, ["outputs"]) ?? {};
  const statuses =
    useDocumentPath<LiveState["outputs"]>(view, ["live", "outputs"]) ?? {};
  const document = useSignal(view.document);
  useEffect(() => {
    if (universe === undefined) select({ kind: "installation" });
  }, [universe, select]);
  if (universe === undefined || document === undefined) return null;
  const own = Object.values(outputs).filter(
    (output) => output.universeId === id,
  );
  const patched = patchedIn(document, id);
  return (
    <>
      <InspectorHeading name={universe.name} id={universe.id} />
      <div className="grid gap-3 p-3">
        <NameField
          label="Name"
          value={universe.name}
          onCommit={(name) =>
            void command("universe.rename", { universeId: id, name })
          }
        />
      </div>
      <InspectorSection storageKey="outputs" label="Outputs">
        {own.length === 0 ? (
          <p className="text-[0.6875rem]/relaxed text-muted-foreground">
            No Output: this Universe is programmable and visible, but silent.
            Add one from the navigator row's +.
          </p>
        ) : (
          <ul className="grid gap-1 text-xs">
            {own.map((output) => (
              <li key={output.id}>
                <button
                  type="button"
                  className="text-left hover:underline"
                  onClick={() => select({ kind: "output", id: output.id })}
                >
                  {OUTPUT_LABELS[output.kind]} · {output.device}
                </button>
                <span className="text-muted-foreground">
                  {" "}
                  — {describeStatus(statuses[output.id])}
                </span>
              </li>
            ))}
          </ul>
        )}
      </InspectorSection>
      <InspectorSection storageKey="patched" label="Patched">
        {patched.length === 0 ? (
          <p className="text-[0.6875rem]/relaxed text-muted-foreground">
            Nothing is patched here yet.
          </p>
        ) : (
          <ul className="grid gap-1 text-xs">
            {patched.map((fixture) => (
              <li key={fixture.id} className="flex justify-between gap-2">
                <button
                  type="button"
                  className="truncate text-left hover:underline"
                  onClick={() => select({ kind: "fixture", id: fixture.id })}
                >
                  {fixture.name}
                </button>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  @ {String(fixture.patch?.address ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </InspectorSection>
    </>
  );
}
