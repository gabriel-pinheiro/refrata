import type { DocumentView } from "@refrata/client";
import type { Tester } from "@refrata/core";
import { Grid3x3, Lightbulb, SlidersHorizontal, Theater } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FixtureEditor } from "@/fixture-editor/fixture-editor";
import { useDocumentPath } from "@/lib/client";
import { RigView } from "@/rig-view/rig-view";
import { TesterView } from "@/tester/tester-view";
import { UniverseView } from "@/universe-view/universe-view";

import { isCenterTab, useCenterTab } from "./center-tab";

/**
 * The centre column's tabs: the Rig View, the DMX Tester, the Universe
 * View and the Fixture Editor, in a strip that scrolls when the column is
 * narrow. Leaving the tester tab keeps its range held, so the Rig View can
 * be watched while probing; the status strip says so. The Universe View
 * streams its frame only while open.
 */
export function Center({ view }: { readonly view: DocumentView }) {
  const { tab, show } = useCenterTab();
  const tester = useDocumentPath<Tester | null>(view, [
    "operational",
    "tester",
  ]);
  return (
    <Tabs
      value={tab}
      onValueChange={(next) => {
        if (isCenterTab(next)) show(next);
      }}
      className="h-full min-h-0 min-w-0 gap-0 overflow-hidden bg-background"
    >
      <TabsList
        variant="line"
        className="h-7 w-full shrink-0 justify-start overflow-x-auto overflow-y-hidden rounded-none border-b px-1 [scrollbar-width:none]"
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
        <TabsTrigger value="fixture-editor" className="flex-none">
          <Lightbulb /> Fixture Editor
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
      <TabsContent value="fixture-editor" className="min-h-0 flex-1">
        <FixtureEditor view={view} />
      </TabsContent>
    </Tabs>
  );
}
