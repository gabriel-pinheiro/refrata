import type { FixtureType } from "@refrata/core";
import type { LibraryEntry } from "@refrata/protocol";
import { useEffect, useState } from "react";

import { useClient } from "@/lib/client";

/** The Fixture Library as the runtime lists it, fetched once per mount. */
export function useLibrary(): {
  readonly entries: readonly LibraryEntry[] | undefined;
  readonly error: string | undefined;
} {
  const client = useClient();
  const [entries, setEntries] = useState<readonly LibraryEntry[] | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    client.request<{ types: LibraryEntry[] }>("library.list", {}).then(
      (result) => {
        if (!cancelled) setEntries(result.types);
      },
      (failure: unknown) => {
        if (!cancelled)
          setError(
            failure instanceof Error ? failure.message : String(failure),
          );
      },
    );
    return () => {
      cancelled = true;
    };
  }, [client]);
  return { entries, error };
}

/** One Fixture Type, the whole file, for a `fixture.create` payload. */
export async function fetchFixtureType(
  client: ReturnType<typeof useClient>,
  key: string,
): Promise<FixtureType> {
  const { type } = await client.request<{ type: FixtureType }>("library.get", {
    key,
  });
  return type;
}
