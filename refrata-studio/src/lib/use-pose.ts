import type { DocumentView } from "@refrata/client";
import type { PoseValues } from "@refrata/protocol";
import { useEffect, useSyncExternalStore } from "react";

import { useClient } from "@/lib/client";

/**
 * Keeps the runtime streaming the poses of these Layers' Geometry Visuals
 * while the caller is mounted, and stops it on unmount. `layerIds` is
 * joined so a new array of the same ids re-sends nothing.
 */
export function usePoseStream(
  view: DocumentView,
  layerIds: readonly string[],
): void {
  const client = useClient();
  const joined = layerIds.join(" ");
  useEffect(() => {
    client.poses(view.documentId, joined === "" ? [] : joined.split(" "));
    return () => client.poses(view.documentId, []);
  }, [client, view, joined]);
}

/** A Layer's latest pose: null while its Scene is not playing, undefined until the stream answers. */
export function usePose(
  view: DocumentView,
  layerId: string,
): PoseValues | null | undefined {
  return useSyncExternalStore(
    (listener) => view.subscribePose(layerId, listener),
    () => view.poseOf(layerId),
  );
}
