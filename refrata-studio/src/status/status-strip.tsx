import type { ConnectionPhase, DocumentView } from "@refrata/client";
import type {
  Layer,
  Output,
  Scene,
  Table,
  Tester,
  Universe,
} from "@refrata/core";
import {
  outputStatusLine,
  type DocumentSummary,
  type LiveState,
} from "@refrata/protocol";

import { useDocumentCommands } from "@/documents/document-commands";
import {
  runtimeHost,
  useClient,
  useDocumentPath,
  useSignal,
} from "@/lib/client";
import { cn } from "@/lib/utils";
import { BlackoutToggle } from "@/menu/blackout-toggle";
import { useInPageBar } from "@/menu/use-in-page-bar";
import { useSelectionIfAny } from "@/selection/selection";

/** Bottom strip: runtime connection, save state, which Scene is edited versus playing, Master, the OSC door, the DMX Tester's hold and blackout at a glance. */
export function StatusStrip() {
  const client = useClient();
  const phase = useSignal(client.phase);
  const { selected, view, revert } = useDocumentCommands();
  const connected = phase === "connected";
  // Blackout lives in the in-page bar; where Refrata Desktop's native menu
  // stands in for that bar, it stays in reach from here.
  const inPageBar = useInPageBar();

  return (
    <footer className="flex h-6 shrink-0 items-center gap-3 border-t bg-sidebar px-2 text-[0.6875rem] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span
          className={cn(
            "size-1.5 rounded-full",
            connected ? "bg-emerald-400" : "bg-amber-400",
          )}
        />
        {connectionText(phase)}
      </span>
      <span className="min-w-0 flex-1 truncate">
        {selected?.recovered === true ? (
          <span className="text-amber-400">
            Recovered unsaved changes from an autosave. Save keeps them, or{" "}
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={revert}
            >
              revert to the file as saved
            </button>
            .
          </span>
        ) : selected === undefined ? null : (
          saveText(selected)
        )}
      </span>
      {view !== undefined && <EditingWarning view={view} />}
      {view !== undefined && <DocumentStatus view={view} />}
      {view !== undefined && !inPageBar && (
        <BlackoutToggle view={view} className="py-0 text-[0.6875rem]" />
      )}
    </footer>
  );
}

function connectionText(phase: ConnectionPhase): string {
  switch (phase) {
    case "connected":
      return `Connected to ${runtimeHost()}`;
    case "connecting":
      return `Connecting to ${runtimeHost()}…`;
    case "reconnecting":
      return "Reconnecting to the runtime…";
    case "closed":
      return "Runtime closed";
  }
}

/** A never-saved Installation has no file to be in step with, dirty or not. */
function saveText(document: DocumentSummary): string {
  if (document.path === null) return "Not saved yet";
  return document.dirty ? "Unsaved changes" : "Saved";
}

/** Amber when the Scene being edited is not the one playing, so a show is never changed by clicking around. */
function EditingWarning({ view }: { readonly view: DocumentView }) {
  const selected = useSelectionIfAny()?.selected ?? [];
  // The first Scene or Layer selected says which Scene is being edited.
  const selection = selected.find(
    (item) => item.kind === "scene" || item.kind === "layer",
  );
  const scenes = useDocumentPath<Table<Scene>>(view, ["scenes"]) ?? {};
  const layer = useDocumentPath<Layer>(view, [
    "layers",
    selection?.kind === "layer" ? selection.id : "",
  ]);
  const activeScene = useDocumentPath<string | null>(view, [
    "installation",
    "activeScene",
  ]);
  const editedId = selection?.kind === "scene" ? selection.id : layer?.sceneId;
  if (editedId === undefined || editedId === activeScene) return null;
  const edited = scenes[editedId];
  if (edited === undefined) return null;
  const playing =
    activeScene === null || activeScene === undefined
      ? undefined
      : scenes[activeScene];
  return (
    <span
      className="truncate text-amber-400"
      title="The Rig View shows the playing Scene, not this one"
    >
      Editing “{edited.name}”,{" "}
      {playing === undefined ? "nothing playing" : `playing “${playing.name}”`}
    </span>
  );
}

function DocumentStatus({ view }: { readonly view: DocumentView }) {
  const osc = useDocumentPath<LiveState["osc"]>(view, ["live", "osc"]);
  const dmx = useDocumentPath<LiveState["dmx"]>(view, ["live", "dmx"]);
  const outputs =
    useDocumentPath<LiveState["outputs"]>(view, ["live", "outputs"]) ?? {};
  const blackout =
    useDocumentPath<boolean>(view, ["operational", "blackout"]) ?? false;
  const master = useDocumentPath<number>(view, ["installation", "master"]) ?? 1;
  const tester = useDocumentPath<Tester | null>(view, [
    "operational",
    "tester",
  ]);
  const universes = useDocumentPath<Table<Universe>>(view, ["universes"]) ?? {};
  const outputTable = useDocumentPath<Table<Output>>(view, ["outputs"]) ?? {};
  const statuses = Object.values(outputs);
  const delivering = statuses.filter(
    (status) => status.state === "delivering",
  ).length;
  const source = { universes, outputs: outputTable };
  return (
    <>
      {dmx !== undefined && (
        <span
          title="Frames resolved per second, out of the output loop rate"
          className="tabular-nums"
        >
          DMX {String(dmx.fps)}/{String(dmx.rateHz)} fps
        </span>
      )}
      {statuses.length > 0 && (
        <span
          title={Object.entries(outputs)
            .map(([id, status]) => outputStatusLine(source, id, status))
            .join("\n")}
          className={cn(
            delivering < statuses.length && "text-amber-400",
            "tabular-nums",
          )}
        >
          {String(delivering)}/{String(statuses.length)}{" "}
          {statuses.length === 1 ? "output" : "outputs"} delivering
        </span>
      )}
      {osc?.port != null && (
        <span title="OSC and OSCQuery port, and the OSCQuery clients connected">
          OSC {String(osc.port)} · {String(osc.listeners)}{" "}
          {osc.listeners === 1 ? "listener" : "listeners"}
        </span>
      )}
      {master < 1 && (
        <span className="text-amber-400 tabular-nums" title="Grand master">
          Master {String(Math.round(master * 100))}%
        </span>
      )}
      {tester != null && (
        <span
          className="rounded-sm bg-amber-400 px-1.5 font-semibold text-black"
          title="The DMX Tester is forcing these channels over the show; release it from its tab"
        >
          DMX Tester holding {String(tester.values.length)}{" "}
          {tester.values.length === 1 ? "channel" : "channels"} on{" "}
          {universes[tester.universeId]?.name ?? tester.universeId}
        </span>
      )}
      {blackout && (
        <span className="rounded-sm bg-destructive px-1.5 font-semibold tracking-wider text-white uppercase">
          Blackout
        </span>
      )}
    </>
  );
}
