import type { DocumentView } from "@refrata/client";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { FixtureEditorProvider } from "@/entities/fixture-type/editor-state";
import { Inspector } from "@/inspector/inspector";
import { NavigatorKeys } from "@/keyboard/navigator-keys";
import { readStored, writeStored } from "@/lib/storage";
import { Navigator } from "@/navigator/navigator";
import { ExpansionProvider } from "@/navigator/expansion";
import { RigStream } from "@/rig-view/rig-stream";
import { SelectionKeys } from "@/selection/selection-keys";
import { TesterKeepalive } from "@/tester/tester-keepalive";

import { Center } from "./center";
import { CenterTabProvider } from "./center-tab";

const LAYOUT_KEY = "refrata.workspace.layout";

const isLayout = (candidate: unknown): candidate is Record<string, number> =>
  typeof candidate === "object" &&
  candidate !== null &&
  Object.values(candidate).every((value) => typeof value === "number");

/**
 * Navigator, the centre tabs and inspector as three resizable columns.
 * Column sizes are remembered per browser; which rows are open, and where
 * the Fixture Editor stands, reset with the document, as the selection
 * (held in `App`) does. The Resolved Stream follows every Fixture while the
 * workspace is open, and the DMX Tester's range is kept alive from here.
 */
export function Workspace({ view }: { readonly view: DocumentView }) {
  return (
    <ExpansionProvider key={view.documentId}>
      <SelectionKeys />
      <NavigatorKeys />
      <RigStream view={view} />
      <TesterKeepalive view={view} />
      <CenterTabProvider>
        <FixtureEditorProvider>
          <Columns view={view} />
        </FixtureEditorProvider>
      </CenterTabProvider>
    </ExpansionProvider>
  );
}

function Columns({ view }: { readonly view: DocumentView }) {
  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="min-h-0 flex-1"
      defaultLayout={readStored(LAYOUT_KEY, undefined, isLayout)}
      onLayoutChanged={(layout) => writeStored(LAYOUT_KEY, layout)}
    >
      <ResizablePanel id="navigator" defaultSize={256} minSize={208}>
        <Navigator view={view} />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel id="center" minSize={320}>
        <Center view={view} />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel id="inspector" defaultSize={288} minSize={256}>
        <Inspector view={view} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
