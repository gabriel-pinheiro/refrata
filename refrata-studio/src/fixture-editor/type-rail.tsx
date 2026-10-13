import type { DocumentView } from "@refrata/client";
import {
  fixturesOfType,
  type Fixture,
  type StoredFixtureType,
  type Table,
} from "@refrata/core";
import { Download, Plus, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTypeActions } from "@/entities/fixture-type/use-type-actions";
import { useDocumentPath } from "@/lib/client";
import { cn } from "@/lib/utils";

import { BringInItems, type BringIn } from "./bring-in";
import { originDot, type Standings } from "./type-chrome";

const HEADING =
  "flex h-6 items-center px-2 text-[0.625rem] font-medium tracking-wider text-muted-foreground/80 uppercase";

/**
 * The types as a column, shown while the centre is wide enough to spare
 * it: the Installation's, each with how many Fixtures use it, then the
 * library's that the Installation lacks, to import. When the library is
 * newer for types nobody edited here, one button takes them all.
 */
export function TypeRail({
  view,
  types,
  standings,
  bringIn,
  openKey,
  onOpen,
}: {
  readonly view: DocumentView;
  readonly types: readonly StoredFixtureType[];
  readonly standings: Standings;
  readonly bringIn: BringIn;
  readonly openKey: string | undefined;
  readonly onOpen: (typeKey: string) => void;
}) {
  const actions = useTypeActions(view);
  const fixtures = useDocumentPath<Table<Fixture>>(view, ["fixtures"]) ?? {};
  const behind = types
    .map((held) => held.type.key)
    .filter((key) => standings[key] === "newer");
  return (
    <aside className="hidden w-52 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground @3xl/editor:flex">
      <div className="flex h-9 shrink-0 items-center border-b px-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-6 items-center gap-1 rounded-md border border-input bg-input/30 px-2 text-xs">
            <Plus className="size-3" /> Add a Fixture Type
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <BringInItems bringIn={bringIn} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-1">
        <p className={HEADING}>In this Installation</p>
        {types.length === 0 && (
          <p className="px-2 py-1 text-xs text-muted-foreground/70">None yet</p>
        )}
        {types.map((held) => (
          <button
            key={held.type.key}
            type="button"
            title={`${held.type.manufacturer} ${held.type.model}, ${held.type.key}`}
            className={cn(
              "flex min-h-6 w-full items-center gap-1.5 rounded-sm px-2 py-0.5 text-left text-xs text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              held.type.key === openKey &&
                "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-selection ring-inset",
            )}
            onClick={() => onOpen(held.type.key)}
          >
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                originDot(held, standings[held.type.key]),
              )}
            />
            <span className="min-w-0 flex-1 truncate">{held.type.model}</span>
            <span className="tabular-nums opacity-60">
              {String(fixturesOfType(fixtures, held.type.key).length)}
            </span>
          </button>
        ))}
        {behind.length > 0 && (
          <Button
            size="xs"
            variant="outline"
            className="mx-2 mt-1.5"
            title="Takes the library's definition of every type where the library is newer and nothing was edited here"
            onClick={() =>
              actions.takeLibrary(
                behind,
                `${String(behind.length)} ${behind.length === 1 ? "type" : "types"}`,
              )
            }
          >
            <RefreshCw /> Update {String(behind.length)} from the library
          </Button>
        )}
        {bringIn.library.length > 0 && (
          <p className={cn(HEADING, "mt-2")}>Refrata's library</p>
        )}
        {bringIn.library.map((entry) => (
          <div
            key={entry.key}
            title={`${entry.manufacturer} ${entry.model}`}
            className="group flex min-h-6 items-center gap-1.5 rounded-sm px-2 text-xs text-muted-foreground/70 hover:bg-sidebar-accent/60"
          >
            <span className="min-w-0 flex-1 truncate">{entry.model}</span>
            <Button
              size="xs"
              variant="ghost"
              className="invisible group-focus-within:visible group-hover:visible"
              onClick={() => bringIn.importLibrary(entry.key)}
            >
              <Download /> Import
            </Button>
          </div>
        ))}
      </div>
    </aside>
  );
}
