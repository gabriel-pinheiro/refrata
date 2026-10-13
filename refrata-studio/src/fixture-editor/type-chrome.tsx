import {
  canTakeLibrary,
  fixturesOfType,
  modeKeyFor,
  originOf,
  originText,
  type Fixture,
  type FixtureTypeStanding,
  type StoredFixtureType,
  type Table,
} from "@refrata/core";
import {
  ChevronsUpDown,
  Copy,
  Ellipsis,
  FileDown,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { useNameDialog } from "@/components/name-dialog";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFixtureEditor } from "@/entities/fixture-type/editor-state";
import type { Scope } from "@/entities/fixture-type/scope";
import { useTypeActions } from "@/entities/fixture-type/use-type-actions";
import { Pills } from "@/inspector/fields/form-inputs";
import { useDocumentPath } from "@/lib/client";
import { cn } from "@/lib/utils";
import { useRemoveEntities } from "@/selection/remove-selection";

import { BringInItems, type BringIn } from "./bring-in";

export type Standings = Readonly<Record<string, FixtureTypeStanding>>;

/** The Installation's types by manufacturer and model, as the rail and the menu list them. */
export function sortedTypes(
  types: Table<StoredFixtureType>,
): readonly StoredFixtureType[] {
  return Object.values(types).sort((a, b) =>
    `${a.type.manufacturer} ${a.type.model}`.localeCompare(
      `${b.type.manufacturer} ${b.type.model}`,
    ),
  );
}

/** The dot beside a type: green when it matches the library, amber when the two disagree, blue for a type from a file or made here. */
export function originDot(
  stored: StoredFixtureType,
  standing: FixtureTypeStanding | undefined,
): string {
  if (originOf(stored).from !== "library") return "bg-sky-400";
  return standing === undefined || standing === "matches"
    ? "bg-emerald-400/70"
    : "bg-amber-400";
}

/** Where a type came from and, for one from the library, how it stands; amber when the two disagree. */
export function OriginBadge({
  stored,
  standing,
}: {
  readonly stored: StoredFixtureType;
  readonly standing: FixtureTypeStanding | undefined;
}) {
  const differs = standing !== undefined && standing !== "matches";
  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0",
        differs && "border-amber-500/60 text-amber-300",
      )}
    >
      {originText(originOf(stored), standing)}
    </Badge>
  );
}

/** The type being edited as a menu of every type the Installation holds, with the ways to bring another in. */
export function TypeMenu({
  scope,
  types,
  standings,
  bringIn,
  className,
}: {
  readonly scope: Scope;
  readonly types: readonly StoredFixtureType[];
  readonly standings: Standings;
  readonly bringIn: BringIn;
  readonly className?: string;
}) {
  const { openType } = useFixtureEditor();
  const fixtures =
    useDocumentPath<Table<Fixture>>(scope.view, ["fixtures"]) ?? {};
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex h-7 min-w-0 items-center gap-2 rounded-md border border-input bg-input/30 px-2 text-left text-xs",
          className,
        )}
      >
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            originDot(scope.stored, standings[scope.typeKey]),
          )}
        />
        <span className="min-w-0 flex-1 truncate font-medium">
          {scope.type.manufacturer} {scope.type.model}
        </span>
        <ChevronsUpDown className="size-3 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>In this Installation</DropdownMenuLabel>
          {types.map((held) => (
            <DropdownMenuItem
              key={held.type.key}
              onClick={() => openType(held.type.key)}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  originDot(held, standings[held.type.key]),
                )}
              />
              <span className="min-w-0 flex-1 truncate">
                {held.type.manufacturer} {held.type.model}
              </span>
              <span className="text-muted-foreground tabular-nums">
                {String(fixturesOfType(fixtures, held.type.key).length)}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <BringInItems bringIn={bringIn} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** What can be done with the whole type, behind one button so it costs no width. */
export function TypeActions({
  scope,
  standing,
}: {
  readonly scope: Scope;
  readonly standing: FixtureTypeStanding | undefined;
}) {
  const actions = useTypeActions(scope.view);
  const removeEntities = useRemoveEntities();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Fixture Type actions"
        className="grid size-7 shrink-0 place-items-center rounded-md border border-input bg-input/30 text-muted-foreground hover:text-foreground"
      >
        <Ellipsis className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => scope.open({ kind: "type" })}>
          Type details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => scope.open({ kind: "mode" })}>
          Mode details and Shape
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => actions.exportType(scope.type)}>
          <FileDown /> Export to a file
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => actions.duplicate(scope.typeKey)}>
          <Copy /> Duplicate
        </DropdownMenuItem>
        {canTakeLibrary(standing) && (
          <DropdownMenuItem
            onClick={() =>
              actions.takeLibrary([scope.typeKey], scope.type.model)
            }
          >
            <RefreshCw /> Take the library's definition
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          variant="destructive"
          onClick={() =>
            removeEntities([{ kind: "fixtureType", id: scope.typeKey }])
          }
        >
          <Trash2 /> Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The type's Modes as pills, with a plus that asks for a name and copies the open Mode into a new one. */
export function ModePills({ scope }: { readonly scope: Scope }) {
  const { openMode } = useFixtureEditor();
  const [ask, dialog] = useNameDialog();
  const modes = Object.entries(scope.type.modes);
  return (
    <>
      <Pills
        value={scope.modeKey}
        options={modes.map(([key, mode]) => ({ value: key, label: mode.name }))}
        onChange={openMode}
        trailing={
          <button
            type="button"
            aria-label="Add a Mode"
            title="Add a Mode, starting from this one"
            className="grid size-5 shrink-0 place-items-center text-muted-foreground hover:text-foreground"
            onClick={() =>
              ask({
                title: "New Mode",
                label: `Name. Its key is made from it and stays. It starts as a copy of ${scope.mode.name}.`,
                initial: "",
                submitLabel: "Add",
                onSubmit: (name) => {
                  const key = modeKeyFor(scope.type, name);
                  void scope
                    .runType("type.mode.add", { name, from: scope.modeKey })
                    .then((result) => {
                      if (result !== undefined && key !== undefined)
                        openMode(key);
                    });
                },
              })
            }
          >
            <Plus className="size-3" />
          </button>
        }
      />
      {dialog}
    </>
  );
}
