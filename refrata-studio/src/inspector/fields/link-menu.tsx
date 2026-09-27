import type { ResolvedAddress } from "@refrata/core";
import { Link2, Link2Off, Plus, SquareArrowOutUpRight } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { linkSource, type RowLinks } from "./link-row";

/** The row's Link menu: "Link to" a Controller or a Preset, or a new one named after the row; linked, what drives it and Unlink. */
export function LinkMenu({
  resolved,
  links,
}: {
  readonly resolved: ResolvedAddress;
  readonly links: RowLinks;
}) {
  const source = linkSource(links);
  if (source === undefined && !canLink(resolved, links))
    return <span className="size-5" />;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${resolved.label} link`}
        title={
          source === undefined
            ? linkTitle(resolved, links)
            : `Controlled by ${source.name}`
        }
        className={
          source === undefined
            ? "grid size-5 place-items-center rounded-sm text-muted-foreground/50 hover:bg-input/50 hover:text-foreground"
            : "grid size-5 place-items-center rounded-sm text-selection hover:bg-input/50"
        }
      >
        <Link2 className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {source === undefined ? (
          <LinkMenuItems resolved={resolved} links={links} />
        ) : (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Controlled by {source.name}</DropdownMenuLabel>
              <DropdownMenuItem onClick={source.open}>
                <SquareArrowOutUpRight /> Go to {source.name}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={links.onUnlink}>
              <Link2Off /> Unlink
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** What an unlinked row's Link button says it links to. */
export function linkTitle(resolved: ResolvedAddress, links: RowLinks): string {
  const controllers = takesController(resolved, links);
  return controllers && links.takesPreset
    ? "Link to a Controller or a Preset"
    : controllers
      ? "Link to a Controller"
      : "Link to a Preset";
}

/** Whether an Address of this type can take a Controller: numbers, colors and booleans. */
export function linkableType(resolved: ResolvedAddress): boolean {
  return resolved.type !== "choice" && resolved.type !== "trigger";
}

/** Whether a Controller may drive the row: by its type, unless the row takes none at all. */
function takesController(resolved: ResolvedAddress, links: RowLinks): boolean {
  return links.takesController !== false && linkableType(resolved);
}

/** Whether the row has anything to link to: a Controller by its type, or a Preset by being resolved per Element. */
export function canLink(resolved: ResolvedAddress, links: RowLinks): boolean {
  return takesController(resolved, links) || links.takesPreset;
}

/**
 * The items of one Address's part of a Link menu, for a menu of one row or
 * a section of a menu over several: "Go to" what drives it and Unlink when
 * linked, else "Link to" a Controller or a Preset, or a new one named
 * after the row.
 */
export function LinkMenuItems({
  resolved,
  links,
}: {
  readonly resolved: ResolvedAddress;
  readonly links: RowLinks;
}) {
  const { candidates, presets } = links;
  const source = linkSource(links);
  if (source !== undefined)
    return (
      <>
        <DropdownMenuItem onClick={source.open}>
          <SquareArrowOutUpRight /> Go to {source.name}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={links.onUnlink}>
          <Link2Off /> Unlink
        </DropdownMenuItem>
      </>
    );
  if (!canLink(resolved, links)) return null;
  const controllers = takesController(resolved, links);
  const kind = resolved.type === "color" ? "color" : "number";
  return (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger
          disabled={
            (controllers ? candidates.length : 0) + presets.length === 0
          }
        >
          <Link2 /> Link to
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          {presets.length > 0 && (
            <DropdownMenuGroup>
              <DropdownMenuLabel>Presets</DropdownMenuLabel>
              {presets.map((preset) => (
                <DropdownMenuItem
                  key={preset.id}
                  onClick={() => links.onLinkPreset(preset.id)}
                >
                  {preset.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          )}
          {controllers && candidates.length > 0 && (
            <DropdownMenuGroup>
              <DropdownMenuLabel>Controllers</DropdownMenuLabel>
              {candidates.map((candidate) => (
                <DropdownMenuItem
                  key={candidate.id}
                  onClick={() => links.onLink(candidate.id)}
                >
                  {candidate.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          )}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      {controllers && (
        <DropdownMenuItem onClick={() => links.onCreate(kind)}>
          <Plus /> New {kind === "color" ? "Color" : "Number"} Controller
        </DropdownMenuItem>
      )}
      {links.takesPreset && (
        <DropdownMenuItem onClick={links.onCreatePreset}>
          <Plus /> New Preset
        </DropdownMenuItem>
      )}
    </>
  );
}
