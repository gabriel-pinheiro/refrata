import { createContext, useContext, useMemo, type ReactNode } from "react";

import { useStoredState } from "@/lib/storage";

const TAB_KEY = "refrata.workspace.centerTab";
export const CENTER_TABS = [
  "rig",
  "tester",
  "universe",
  "fixture-editor",
] as const;
export type CenterTab = (typeof CENTER_TABS)[number];
export const isCenterTab = (candidate: unknown): candidate is CenterTab =>
  CENTER_TABS.includes(candidate as CenterTab);

interface CenterTabState {
  readonly tab: CenterTab;
  readonly show: (tab: CenterTab) => void;
}

const Context = createContext<CenterTabState | undefined>(undefined);

/**
 * Which centre tab is open, remembered per browser. Held above the columns
 * so the inspector can open one, as a Fixture's inspector opens its type in
 * the Fixture Editor.
 */
export function CenterTabProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [tab, show] = useStoredState<CenterTab>(TAB_KEY, "rig", isCenterTab);
  const state = useMemo(() => ({ tab, show }), [tab, show]);
  return <Context.Provider value={state}>{children}</Context.Provider>;
}

export function useCenterTab(): CenterTabState {
  const state = useContext(Context);
  if (state === undefined)
    throw new Error("useCenterTab needs a CenterTabProvider.");
  return state;
}
