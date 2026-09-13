import type { DocumentView } from "@refrata/client";
import type { LiveState } from "@refrata/protocol";

import { useDocumentCommands } from "@/documents/document-commands";
import { useClient, useDocumentPath, useSignal } from "@/lib/client";
import { cn } from "@/lib/utils";

/** Bottom strip: runtime connection, save state, the OSC door and blackout at a glance. */
export function StatusStrip() {
  const client = useClient();
  const phase = useSignal(client.phase);
  const { selected, view, revert } = useDocumentCommands();
  const connected = phase === "connected";

  return (
    <footer className="flex h-6 shrink-0 items-center gap-3 border-t bg-sidebar px-2 text-[0.6875rem] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span
          className={cn(
            "size-1.5 rounded-full",
            connected ? "bg-emerald-400" : "bg-amber-400",
          )}
        />
        {connected ? `Connected to ${location.host}` : `Runtime ${phase}`}
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
        ) : selected === undefined ? null : selected.dirty ? (
          "Unsaved changes"
        ) : (
          "Saved"
        )}
      </span>
      {view !== undefined && <DocumentStatus view={view} />}
    </footer>
  );
}

function DocumentStatus({ view }: { readonly view: DocumentView }) {
  const osc = useDocumentPath<LiveState["osc"]>(view, ["live", "osc"]);
  const blackout =
    useDocumentPath<boolean>(view, ["operational", "blackout"]) ?? false;
  return (
    <>
      {osc?.port != null && (
        <span title="OSC and OSCQuery port, and the OSCQuery clients connected">
          OSC {String(osc.port)} · {String(osc.listeners)}{" "}
          {osc.listeners === 1 ? "listener" : "listeners"}
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
