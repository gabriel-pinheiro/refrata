import type { DocumentView } from "@refrata/client";
import { allFixtures, type Fixture, type Table } from "@refrata/core";
import { useEffect } from "react";

import { useClient, useDocumentPath } from "@/lib/client";

/**
 * Keeps the Resolved Stream pointed at every Fixture in the Installation,
 * so the Rig View and the inspectors read one subscription. Re-sent when a
 * Fixture comes or goes; the client re-sends it by itself after a reconnect.
 */
export function RigStream({ view }: { readonly view: DocumentView }) {
  const client = useClient();
  const fixtures = useDocumentPath<Table<Fixture>>(view, ["fixtures"]);
  const ids =
    fixtures === undefined
      ? ""
      : allFixtures(fixtures)
          .map((fixture) => fixture.id)
          .join(" ");
  useEffect(() => {
    client.stream(view.documentId, ids === "" ? [] : ids.split(" "));
    return () => client.stream(view.documentId, []);
  }, [client, view.documentId, ids]);
  return null;
}
