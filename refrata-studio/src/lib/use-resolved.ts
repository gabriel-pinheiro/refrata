import type { DocumentView } from "@refrata/client";
import type { ParameterValues } from "@refrata/core";
import { useMemo } from "react";

import { useSignal } from "./client";

/** The resolved values of one Element from the Resolved Stream; re-renders only when they change. */
export function useResolved(
  view: DocumentView,
  ref: string,
): ParameterValues | undefined {
  const signal = useMemo(() => view.resolved(ref), [view, ref]);
  return useSignal(signal);
}
