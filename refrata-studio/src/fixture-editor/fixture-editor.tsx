import type { DocumentView } from "@refrata/client";
import {
  actionKeyFor,
  footprintOf,
  nextChannelKey,
  type StoredFixtureType,
  type Table,
} from "@refrata/core";
import { Plus } from "lucide-react";

import { useNameDialog } from "@/components/name-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useFixtureEditor,
  type EditorSection,
} from "@/entities/fixture-type/editor-state";
import { useAddElement } from "@/entities/fixture-type/element-editor";
import { useScope, type Scope } from "@/entities/fixture-type/scope";
import { Pills } from "@/inspector/fields/form-inputs";
import { useDocumentPath } from "@/lib/client";
import { useSelection } from "@/selection/selection";

import { ChannelList } from "./channel-list";
import { ProbeBar } from "./probe-bar";
import { ActionList, ElementList, ParameterList } from "./section-lists";
import { BringInItems, useBringIn, type BringIn } from "./bring-in";
import {
  ModePills,
  OriginBadge,
  sortedTypes,
  TypeActions,
  TypeMenu,
  type Standings,
} from "./type-chrome";
import { TypeRail } from "./type-rail";

/**
 * The Fixture Editor: the Installation's Fixture Types as a column at the
 * left, and for the open one its Modes, the probe, and a Mode's Channels,
 * Elements, Parameters and Actions each as a list. Whatever is picked in a
 * list is selected, so the inspector edits it. Everything it shows is read
 * from the document and every change is a command.
 */
export function FixtureEditor({ view }: { readonly view: DocumentView }) {
  const editor = useFixtureEditor();
  const { select } = useSelection();
  const held =
    useDocumentPath<Table<StoredFixtureType>>(view, ["fixtureTypes"]) ?? {};
  const standings =
    useDocumentPath<Standings>(view, ["live", "fixtureTypes"]) ?? {};
  const types = sortedTypes(held);
  const [bringIn, dialogs] = useBringIn(
    view,
    types.map((stored) => stored.type.key),
  );
  const open =
    (editor.typeKey === undefined ? undefined : held[editor.typeKey]) ??
    types[0];
  const modeKey =
    open === undefined
      ? undefined
      : editor.modeKey !== undefined && editor.modeKey in open.type.modes
        ? editor.modeKey
        : Object.keys(open.type.modes)[0];
  return (
    <div className="@container/editor flex h-full min-h-0">
      <TypeRail
        view={view}
        types={types}
        standings={standings}
        bringIn={bringIn}
        openKey={open?.type.key}
        onOpen={(typeKey) => {
          editor.openType(typeKey);
          select({ kind: "fixtureType", id: typeKey });
        }}
      />
      {open === undefined || modeKey === undefined ? (
        <NoType bringIn={bringIn} />
      ) : (
        <ModePane
          view={view}
          typeKey={open.type.key}
          modeKey={modeKey}
          types={types}
          standings={standings}
          bringIn={bringIn}
        />
      )}
      {dialogs}
    </div>
  );
}

/** What the centre says while the Installation has no Fixture Type. */
function NoType({ bringIn }: { readonly bringIn: BringIn }) {
  return (
    <section className="grid min-w-0 flex-1 place-content-center justify-items-center gap-3 p-6 text-center">
      <p className="max-w-sm text-xs text-muted-foreground">
        The Installation has no Fixture Type. Make one, or import one from
        Refrata's library or from a .refrata-fixture file.
      </p>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-7 items-center gap-1 rounded-md border border-input bg-input/30 px-2 text-xs">
          <Plus className="size-3" /> Add a Fixture Type
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-72">
          <BringInItems bringIn={bringIn} />
        </DropdownMenuContent>
      </DropdownMenu>
    </section>
  );
}

/** What the Add button of a list makes, or undefined for a list that has none. */
function useAdd(
  scope: Scope,
  section: EditorSection,
): readonly [
  add: { readonly label: string; readonly run: () => void } | undefined,
  dialogs: React.ReactNode,
] {
  const [addElement, elementDialog] = useAddElement(scope);
  const [ask, actionDialog] = useNameDialog();
  const dialogs = (
    <>
      {elementDialog}
      {actionDialog}
    </>
  );
  if (section === "channels")
    return [
      {
        label: "Channel",
        run: () => {
          const key = nextChannelKey(scope.mode);
          void scope.run("type.channel.add").then((result) => {
            if (result !== undefined) scope.open({ kind: "channel", key });
          });
        },
      },
      dialogs,
    ];
  if (section === "elements")
    return [
      {
        label: "Element",
        run: () =>
          addElement(scope.pick?.kind === "element" ? scope.pick.key : "root"),
      },
      dialogs,
    ];
  if (section === "actions")
    return [
      {
        label: "Action",
        run: () =>
          ask({
            title: "New Action",
            label: "Name. Its key is made from it and stays.",
            initial: "",
            submitLabel: "Add",
            onSubmit: (name) => {
              const key = actionKeyFor(scope.mode, name);
              void scope.run("type.action.add", { name }).then((result) => {
                if (result !== undefined && key !== undefined)
                  scope.open({ kind: "action", key });
              });
            },
          }),
      },
      dialogs,
    ];
  return [undefined, dialogs];
}

function ModePane({
  view,
  typeKey,
  modeKey,
  types,
  standings,
  bringIn,
}: {
  readonly view: DocumentView;
  readonly typeKey: string;
  readonly modeKey: string;
  readonly types: readonly StoredFixtureType[];
  readonly standings: Standings;
  readonly bringIn: BringIn;
}) {
  const scope = useScope(view, typeKey, modeKey);
  if (scope === undefined) return null;
  return (
    <ModeLists
      scope={scope}
      types={types}
      standings={standings}
      bringIn={bringIn}
    />
  );
}

function ModeLists({
  scope,
  types,
  standings,
  bringIn,
}: {
  readonly scope: Scope;
  readonly types: readonly StoredFixtureType[];
  readonly standings: Standings;
  readonly bringIn: BringIn;
}) {
  const { section, openSection } = useFixtureEditor();
  const [adding, dialogs] = useAdd(scope, section);
  const { type, mode, rows } = scope;
  const parameters = Object.values(mode.elements).reduce(
    (total, element) => total + Object.keys(element.parameters).length,
    0,
  );
  const standing = standings[scope.typeKey];
  return (
    <section className="@container flex min-w-0 flex-1 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2">
        <TypeMenu
          scope={scope}
          types={types}
          standings={standings}
          bringIn={bringIn}
          className="w-56 max-w-full @3xl/editor:hidden"
        />
        <h2 className="hidden min-w-0 truncate text-sm font-semibold @3xl/editor:block">
          {type.model}
        </h2>
        <ModePills scope={scope} />
        <span className="hidden text-xs text-muted-foreground @xl:inline">
          Footprint {String(footprintOf(mode))}
        </span>
        <span className="flex-1" />
        <span className="hidden @lg:contents">
          <OriginBadge stored={scope.stored} standing={standing} />
        </span>
        <TypeActions scope={scope} standing={standing} />
      </header>
      <ProbeBar scope={scope} />
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-1.5">
        <Pills
          value={section}
          options={[
            { value: "channels", label: `Channels ${String(rows.length)}` },
            {
              value: "elements",
              label: `Elements ${String(Object.keys(mode.elements).length)}`,
            },
            { value: "parameters", label: `Parameters ${String(parameters)}` },
            {
              value: "actions",
              label: `Actions ${String(Object.keys(mode.actions).length)}`,
            },
          ]}
          onChange={openSection}
        />
        <span className="flex-1" />
        {adding !== undefined && (
          <Button size="sm" variant="outline" onClick={adding.run}>
            <Plus /> {adding.label}
          </Button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {section === "channels" && <ChannelList scope={scope} />}
        {section === "elements" && <ElementList scope={scope} />}
        {section === "parameters" && <ParameterList scope={scope} />}
        {section === "actions" && <ActionList scope={scope} />}
      </div>
      {dialogs}
    </section>
  );
}
