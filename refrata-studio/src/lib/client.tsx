import {
  RefrataClient,
  type DocumentView,
  type ReadonlySignal,
} from "@refrata/client";
import { generateId, type PatchPath } from "@refrata/core";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { toast } from "sonner";

const ClientContext = createContext<RefrataClient | undefined>(undefined);

function liveUrl(): string {
  const params = new URLSearchParams(location.search);
  const configured = params.get("runtime");
  if (configured !== null) return configured;
  return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/live`;
}

/** One undo owner per browser, so Ctrl+Z ownership survives reloads. */
function studioActor(): string {
  const key = "refrata.actor";
  try {
    const stored = localStorage.getItem(key);
    if (stored !== null) return stored;
    const created = generateId("studio");
    localStorage.setItem(key, created);
    return created;
  } catch {
    return generateId("studio");
  }
}

export function ClientProvider({ children }: { readonly children: ReactNode }) {
  const client = useMemo(
    () =>
      new RefrataClient({
        url: liveUrl(),
        kind: "studio",
        actor: studioActor(),
      }),
    [],
  );
  return (
    <ClientContext.Provider value={client}>{children}</ClientContext.Provider>
  );
}

export function useClient(): RefrataClient {
  const client = useContext(ClientContext);
  if (client === undefined)
    throw new Error("useClient needs a ClientProvider.");
  return client;
}

/** Re-renders only when the signal's value changes. */
export function useSignal<TValue>(signal: ReadonlySignal<TValue>): TValue {
  return useSyncExternalStore(
    (listener) => signal.subscribe(() => listener()),
    () => signal.get(),
  );
}

const PATH_SEPARATOR = "\u0000";

/** Re-renders only when a delta touches `path`. */
export function useDocumentPath<TValue>(
  view: DocumentView,
  path: PatchPath,
): TValue | undefined {
  // `key` stands in for `path` so a fresh array literal does not resubscribe;
  // the separator is one no segment can contain (a Fixture Type key has "/").
  const key = path.join(PATH_SEPARATOR);
  const signal = useMemo(
    () => view.at<TValue>(key === "" ? [] : key.split(PATH_SEPARATOR)),
    [view, key],
  );
  return useSignal(signal);
}

/** Sends a command against `view`'s document; a rejection surfaces as a toast, never throws. */
export function useCommand(
  view: DocumentView,
): (name: string, payload: unknown) => Promise<void> {
  const client = useClient();
  const { documentId } = view;
  return useCallback(
    (name, payload) =>
      client.command(documentId, name, payload).then(
        () => undefined,
        (failure: unknown) => {
          toast.error(
            failure instanceof Error ? failure.message : String(failure),
          );
        },
      ),
    [client, documentId],
  );
}
