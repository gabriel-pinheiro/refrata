import type { DocumentView } from "@refrata/client";
import {
  orderedEntries,
  OUTPUT_LABELS,
  UNIVERSE_SIZE,
  universeRuns,
  type Document,
  type Output,
  type Table,
  type Tester,
  type Universe,
} from "@refrata/core";
import type { LiveState } from "@refrata/protocol";
import { useMemo } from "react";

import { PanelHeader } from "@/components/panel-header";
import { describeStatus } from "@/entities/universe/output-inspector";
import { SelectField } from "@/inspector/fields/select-field";
import { useDocumentPath } from "@/lib/client";
import { useStoredState } from "@/lib/storage";
import { cn } from "@/lib/utils";

import { UniverseGrid, type Rig } from "./universe-grid";
import { freeSummary } from "./universe-layout";
import { useFrameStream } from "./use-frame";

const UNIVERSE_KEY = "refrata.workspace.universeView.universe";
const isUniverseChoice = (candidate: unknown): candidate is string | null =>
  candidate === null || typeof candidate === "string";

/**
 * The Universe View: one Universe's 512 DMX Addresses as a grid, each with
 * the Fixture and Channel patched over it and the byte going out right
 * now, so a gap for a new device and a Channel that is not moving are both
 * found by looking. The Universe shown is remembered per browser; its
 * Outputs and their status sit beside the picker, and a note says when
 * Blackout or the Master explains a page of zeros. The frame streams only
 * while this tab is open.
 */
export function UniverseView({ view }: { readonly view: DocumentView }) {
  const universes = useDocumentPath<Table<Universe>>(view, ["universes"]) ?? {};
  const [stored, setStored] = useStoredState<string | null>(
    UNIVERSE_KEY,
    null,
    isUniverseChoice,
  );
  const ordered = orderedEntries(universes);
  const universeId =
    stored !== null && stored in universes ? stored : (ordered[0]?.id ?? null);
  return (
    <section className="flex h-full min-h-0 flex-col">
      <PanelHeader>Universe View</PanelHeader>
      {universeId === null ? (
        <p className="p-3 text-xs text-muted-foreground">
          No Universe yet. Add one from the navigator and its addresses show
          here.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3 border-b p-3">
            <div className="w-40">
              <SelectField
                label="Universe"
                value={universeId}
                options={ordered.map((universe) => ({
                  value: universe.id,
                  label: universe.name,
                }))}
                onValueChange={(next) => setStored(next)}
              />
            </div>
            <OutputPills view={view} universeId={universeId} />
            <Notes view={view} />
          </div>
          <Body view={view} universeId={universeId} />
        </>
      )}
    </section>
  );
}

function Body({
  view,
  universeId,
}: {
  readonly view: DocumentView;
  readonly universeId: string;
}) {
  useFrameStream(view, universeId);
  const fixtures = useDocumentPath<Document["fixtures"]>(view, ["fixtures"]);
  const fixtureTypes = useDocumentPath<Document["fixtureTypes"]>(view, [
    "fixtureTypes",
  ]);
  const tester = useDocumentPath<Tester | null>(view, [
    "operational",
    "tester",
  ]);
  // One object per change of either table, so the grid's memos hold across unrelated deltas.
  const rig = useMemo<Rig | undefined>(
    () =>
      fixtures === undefined || fixtureTypes === undefined
        ? undefined
        : { fixtures, fixtureTypes },
    [fixtures, fixtureTypes],
  );
  if (rig === undefined) return null;
  const summary = freeSummary(universeRuns(rig, universeId));
  return (
    <>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <UniverseGrid
          view={view}
          rig={rig}
          universeId={universeId}
          tester={tester ?? null}
        />
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t px-3 py-1.5 text-[0.6875rem] text-muted-foreground tabular-nums">
        <span>
          {String(summary.free)} of {String(UNIVERSE_SIZE)} addresses free
          {summary.longestAt === undefined
            ? ""
            : `, longest run ${String(summary.longest)} from ${String(summary.longestAt)}`}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-xs border border-sky-500/40 bg-sky-500/15" />
          patched
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-xs border border-dashed border-border/60" />
          free
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 border-t-[5px] border-l-[5px] border-t-amber-400 border-l-transparent" />
          DMX Tester
        </span>
      </div>
    </>
  );
}

/** One pill per Output of the Universe, its dot green while delivering. */
function OutputPills({
  view,
  universeId,
}: {
  readonly view: DocumentView;
  readonly universeId: string;
}) {
  const outputs = useDocumentPath<Table<Output>>(view, ["outputs"]) ?? {};
  const statuses =
    useDocumentPath<LiveState["outputs"]>(view, ["live", "outputs"]) ?? {};
  const own = Object.values(outputs).filter(
    (output) => output.universeId === universeId,
  );
  if (own.length === 0)
    return (
      <span className="pb-1.5 text-xs text-muted-foreground">
        No Output, silent
      </span>
    );
  return (
    <div className="flex flex-wrap gap-1.5 pb-1.5">
      {own.map((output) => {
        const status = statuses[output.id];
        return (
          <span
            key={output.id}
            className="inline-flex h-5 items-center gap-1.5 rounded-full border px-2 text-[0.625rem]"
            title={describeStatus(status)}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                status?.state === "delivering"
                  ? "bg-emerald-400"
                  : status === undefined
                    ? "bg-muted-foreground"
                    : "bg-amber-400",
              )}
            />
            {OUTPUT_LABELS[output.kind]}
          </span>
        );
      })}
    </div>
  );
}

/** Why the bytes may read 0: Blackout, or a Master below full. */
function Notes({ view }: { readonly view: DocumentView }) {
  const blackout =
    useDocumentPath<boolean>(view, ["operational", "blackout"]) ?? false;
  const master = useDocumentPath<number>(view, ["installation", "master"]) ?? 1;
  if (!blackout && master >= 1) return null;
  return (
    <span
      className={cn(
        "pb-1.5 text-xs tabular-nums",
        blackout ? "text-destructive" : "text-amber-400",
      )}
    >
      {blackout
        ? "Blackout, every address sends 0"
        : `Master at ${String(Math.round(master * 100))}%`}
    </span>
  );
}
