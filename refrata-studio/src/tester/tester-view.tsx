import type { DocumentView } from "@refrata/client";
import {
  orderedEntries,
  settings,
  type Tester,
  type Universe,
  type Table,
} from "@refrata/core";
import { Eraser, Play, Square } from "lucide-react";
import { useState } from "react";

import { PanelHeader } from "@/components/panel-header";
import { Button } from "@/components/ui/button";
import { NumberField } from "@/inspector/fields/number-field";
import { SelectField } from "@/inspector/fields/select-field";
import { useCommand, useDocumentPath, useSignal } from "@/lib/client";

import { TesterFader } from "./tester-fader";
import { testerChannels } from "./tester-channels";

/**
 * The DMX Tester: raw channels of one Universe held at bytes you set, over
 * whatever the show outputs, to learn what a device does before it has a
 * Fixture Type. Pick a Universe, a start address and a count, hold: every
 * channel starts at 0. One fader per channel, named after the Fixture
 * patched over it when there is one; a channel can be released alone so
 * the show shows through it. Blackout kills the whole frame, held channels
 * included. The range
 * lives while this Studio holds it and never reaches the file.
 */
export function TesterView({ view }: { readonly view: DocumentView }) {
  const command = useCommand(view);
  const tester = useDocumentPath<Tester | null>(view, [
    "operational",
    "tester",
  ]);
  const universes = useDocumentPath<Table<Universe>>(view, ["universes"]) ?? {};
  const blackout =
    useDocumentPath<boolean>(view, ["operational", "blackout"]) ?? false;
  const document = useSignal(view.document);
  const ordered = orderedEntries(universes);
  const [draft, setDraft] = useState<{
    universeId: string | null;
    address: number;
    count: number;
  }>({ universeId: null, address: 1, count: 8 });
  const universeId =
    draft.universeId ?? tester?.universeId ?? ordered[0]?.id ?? null;
  const held = tester != null;
  const hold = (): void => {
    if (universeId === null) return;
    void command("tester.hold", {
      universeId,
      address: draft.address,
      count: draft.count,
    });
  };
  return (
    <section className="flex h-full min-h-0 flex-col">
      <PanelHeader>DMX Tester</PanelHeader>
      <div className="flex flex-wrap items-end gap-3 border-b p-3">
        <div className="w-40">
          <SelectField
            label="Universe"
            value={universeId}
            options={ordered.map((universe) => ({
              value: universe.id,
              label: universe.name,
            }))}
            onValueChange={(next) => setDraft({ ...draft, universeId: next })}
          />
        </div>
        <div className="w-24">
          <NumberField
            label="Address"
            value={draft.address}
            decimals={0}
            step={1}
            onCommit={(value) =>
              setDraft({
                ...draft,
                address: Math.min(512, Math.max(1, Math.round(value))),
              })
            }
          />
        </div>
        <div className="w-24">
          <NumberField
            label="Channels"
            value={draft.count}
            decimals={0}
            step={1}
            onCommit={(value) =>
              setDraft({
                ...draft,
                count: Math.min(
                  settings.tester.maxChannels,
                  Math.max(1, Math.round(value)),
                ),
              })
            }
          />
        </div>
        <Button size="sm" disabled={universeId === null} onClick={hold}>
          <Play /> Hold
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!held}
          onClick={() => void command("tester.zero", {})}
        >
          <Eraser /> Zero all
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!held}
          onClick={() => void command("tester.release", {})}
        >
          <Square /> Release all
        </Button>
      </div>
      {tester == null || document === undefined ? (
        <p className="p-3 text-xs text-muted-foreground">
          Nothing held. Pick a Universe, a start address and how many channels,
          then Hold: every channel starts at 0 and a fader appears for each.
          What you set here goes straight to the Output over the show, is never
          saved, and is released when this Studio goes away.
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-3">
          {blackout && (
            <p className="mb-2 text-xs text-destructive">
              Blackout: every address is sending 0, held channels included. The
              faders keep their values for when it lifts.
            </p>
          )}
          <p className="mb-2 text-xs text-muted-foreground">
            Holding channels {String(tester.address)} to{" "}
            {String(tester.address + tester.values.length - 1)} of{" "}
            {universes[tester.universeId]?.name ?? tester.universeId}. A
            released channel shows the show underneath.
          </p>
          <div className="flex flex-wrap gap-2">
            {testerChannels(document, tester).map((entry) => (
              <TesterFader
                key={entry.channel}
                entry={entry}
                onChange={(value) =>
                  void command("tester.set", {
                    values: { [String(entry.channel)]: value },
                  })
                }
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
