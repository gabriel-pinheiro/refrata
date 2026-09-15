import type { DocumentView } from "@refrata/client";
import { settings, type Tester } from "@refrata/core";
import { useEffect } from "react";

import { useClient, useDocumentPath } from "@/lib/client";

/**
 * While the DMX Tester holds a range, this Studio touches it every
 * `settings.tester.keepaliveMs` so the runtime keeps it; close the document
 * or the browser and the runtime releases it after its timeout. Mounted
 * with the workspace, not the tab, so switching to the Rig View keeps the
 * probe.
 */
export function TesterKeepalive({ view }: { readonly view: DocumentView }) {
  const client = useClient();
  const held =
    useDocumentPath<Tester | null>(view, ["operational", "tester"]) != null;
  useEffect(() => {
    if (!held) return;
    const touch = (): void => {
      void client
        .request("tester.touch", { documentId: view.documentId })
        .catch(() => undefined);
    };
    const timer = setInterval(touch, settings.tester.keepaliveMs);
    return () => clearInterval(timer);
  }, [client, view.documentId, held]);
  return null;
}
