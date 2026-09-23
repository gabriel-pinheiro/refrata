import type { DocumentView } from "@refrata/client";
import { useEffect, useSyncExternalStore } from "react";

import { useClient } from "@/lib/client";

/**
 * Keeps the runtime streaming one Universe's DMX Frame while the caller is
 * mounted, and stops it on unmount or when the Universe changes. The bytes
 * land in the view; cells read them one address at a time.
 */
export function useFrameStream(view: DocumentView, universeId: string): void {
  const client = useClient();
  useEffect(() => {
    client.frames(view.documentId, [universeId]);
    return () => client.frames(view.documentId, []);
  }, [client, view, universeId]);
}

/** Re-renders only when this address's byte changes; undefined until the first frame lands. */
export function useFrameByte(
  view: DocumentView,
  universeId: string,
  address: number,
): number | undefined {
  return useSyncExternalStore(
    (listener) => view.subscribeFrame(universeId, listener),
    () => view.frameOf(universeId)?.[address - 1],
  );
}
