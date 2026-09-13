import type { DocumentView } from "@refrata/client";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Inspector } from "@/inspector/inspector";
import { readStored, writeStored } from "@/lib/storage";
import { Navigator } from "@/navigator/navigator";
import { ExpansionProvider } from "@/navigator/expansion";
import { SelectionProvider } from "@/selection/selection";
import { SelectionKeys } from "@/selection/selection-keys";

const LAYOUT_KEY = "refrata.workspace.layout";

const isLayout = (candidate: unknown): candidate is Record<string, number> =>
  typeof candidate === "object" &&
  candidate !== null &&
  Object.values(candidate).every((value) => typeof value === "number");

/**
 * Navigator, an empty centre and inspector as three resizable columns.
 * Column sizes are remembered per browser; selection and which rows are open
 * reset with the document. The centre waits for the Rig.
 */
export function Workspace({ view }: { readonly view: DocumentView }) {
  return (
    <SelectionProvider key={view.documentId}>
      <ExpansionProvider>
        <SelectionKeys />
        <Columns view={view} />
      </ExpansionProvider>
    </SelectionProvider>
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
        <main className="grid h-full place-items-center text-muted-foreground" />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel id="inspector" defaultSize={288} minSize={256}>
        <Inspector view={view} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
