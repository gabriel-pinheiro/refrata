import type { DocumentView } from "@refrata/client";
import type { Tester } from "@refrata/core";
import { Grid3x3, SlidersHorizontal, Theater } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDocumentPath } from "@/lib/client";
import { useStoredState } from "@/lib/storage";
import { RigView } from "@/rig-view/rig-view";
import { TesterView } from "@/tester/tester-view";
import { UniverseView } from "@/universe-view/universe-view";

const TAB_KEY = "refrata.workspace.centerTab";
const TABS = ["rig", "tester", "universe"] as const;
type CenterTab = (typeof TABS)[number];
const isTab = (candidate: unknown): candidate is CenterTab =>
  TABS.includes(candidate as CenterTab);

/**
 * The centre column's tabs: the Rig View, the DMX Tester and the Universe
 * View. The open tab is remembered per browser. Leaving the tester tab
 * keeps its range held, so the Rig View can be watched while probing; the
 * status strip says so. The Universe View streams its frame only while
 * open.
 */
export function Center({ view }: { readonly view: DocumentView }) {
  const [tab, setTab] = useStoredState<CenterTab>(TAB_KEY, "rig", isTab);
  const tester = useDocumentPath<Tester | null>(view, [
    "operational",
    "tester",
  ]);
  return (
    <Tabs
      value={tab}
      onValueChange={(next) => {
        if (isTab(next)) setTab(next);
      }}
      className="h-full min-h-0 gap-0 bg-background"
    >
      <TabsList
        variant="line"
        className="h-7 w-full shrink-0 justify-start rounded-none border-b px-1"
      >
        <TabsTrigger value="rig" className="flex-none">
          <Theater /> Rig View
        </TabsTrigger>
        <TabsTrigger value="tester" className="flex-none">
          <SlidersHorizontal /> DMX Tester
          {tester != null && (
            <span
              className="size-1.5 rounded-full bg-amber-400"
              title="Holding channels"
            />
          )}
        </TabsTrigger>
        <TabsTrigger value="universe" className="flex-none">
          <Grid3x3 /> Universe View
        </TabsTrigger>
      </TabsList>
      <TabsContent value="rig" className="min-h-0 flex-1">
        <RigView view={view} />
      </TabsContent>
      <TabsContent value="tester" className="min-h-0 flex-1">
        <TesterView view={view} />
      </TabsContent>
      <TabsContent value="universe" className="min-h-0 flex-1">
        <UniverseView view={view} />
      </TabsContent>
    </Tabs>
  );
}
