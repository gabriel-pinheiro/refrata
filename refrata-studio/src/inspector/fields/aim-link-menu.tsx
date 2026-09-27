import type { ResolvedAddress, ValuePreset } from "@refrata/core";
import { Link2, Link2Off, Plus, SquareArrowOutUpRight } from "lucide-react";
import { Fragment } from "react";

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
import { cn } from "@/lib/utils";

import { LinkMenuItems } from "./link-menu";
import { linkSource, type RowLinks } from "./link-row";

/** One part of an Aim's Link menu: a caption and the Address it links. */
export interface AimLinkSection {
  readonly key: string;
  readonly title: string;
  readonly resolved: ResolvedAddress;
  readonly links: RowLinks;
}

/** How an Aim links both axes to one Preset, each gesture one undo step. */
export interface AimPairLinks {
  /** The Preset both axes are linked to, when they share one. */
  readonly preset: ValuePreset | undefined;
  /** Presets the Aim could take, in navigator order. */
  readonly presets: readonly ValuePreset[];
  /** Whether either axis is linked to anything. */
  readonly linked: boolean;
  readonly onLink: (presetId: string) => void;
  /** Makes a new Preset holding what both axes show, and links them. */
  readonly onCreate: () => void;
  readonly onUnlink: () => void;
  readonly onOpen: (presetId: string) => void;
}

/**
 * The one link button of an Aim row. Its menu opens with Aim, which links
 * both axes to a Preset, then has a section per axis, each offering what a
 * row's own Link menu offers for that axis's Address; the button shows
 * linked while any part is, and says which in its title.
 */
export function AimLinkMenu({
  label,
  pair,
  sections,
}: {
  readonly label: string;
  /** Absent for an Aim whose rows take no Preset. */
  readonly pair?: AimPairLinks | undefined;
  readonly sections: readonly AimLinkSection[];
}) {
  const driven = sections.flatMap((section) => {
    const source = linkSource(section.links);
    return source === undefined
      ? []
      : [`${section.title} controlled by ${source.name}`];
  });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${label} link`}
        title={
          driven.length === 0
            ? "Link to a Controller or a Preset"
            : driven.join(". ")
        }
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-sm hover:bg-input/50",
          driven.length === 0
            ? "text-muted-foreground/50 hover:text-foreground"
            : "text-selection",
        )}
      >
        <Link2 className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {pair !== undefined && (
          <>
            <PairItems label={label} pair={pair} />
            <DropdownMenuSeparator />
          </>
        )}
        {sections.map((section, index) => {
          const source = linkSource(section.links);
          return (
            <Fragment key={section.key}>
              {index > 0 && <DropdownMenuSeparator />}
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  {source === undefined
                    ? section.title
                    : `${section.title}: ${source.name}`}
                </DropdownMenuLabel>
                <LinkMenuItems
                  resolved={section.resolved}
                  links={section.links}
                />
              </DropdownMenuGroup>
            </Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The Aim part of the menu: both axes to one Preset, or the Preset they share and Unlink for both. */
function PairItems({
  label,
  pair,
}: {
  readonly label: string;
  readonly pair: AimPairLinks;
}) {
  const { preset } = pair;
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>
        {preset === undefined ? label : `${label}: ${preset.name}`}
      </DropdownMenuLabel>
      {preset !== undefined && (
        <DropdownMenuItem onClick={() => pair.onOpen(preset.id)}>
          <SquareArrowOutUpRight /> Go to {preset.name}
        </DropdownMenuItem>
      )}
      <DropdownMenuSub>
        <DropdownMenuSubTrigger disabled={pair.presets.length === 0}>
          <Link2 /> Link both to
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuGroup>
            <DropdownMenuLabel>Presets</DropdownMenuLabel>
            {pair.presets.map((candidate) => (
              <DropdownMenuItem
                key={candidate.id}
                disabled={candidate.id === preset?.id}
                onClick={() => pair.onLink(candidate.id)}
              >
                {candidate.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuItem onClick={pair.onCreate}>
        <Plus /> New Preset
      </DropdownMenuItem>
      {pair.linked && (
        <DropdownMenuItem onClick={pair.onUnlink}>
          <Link2Off /> Unlink both
        </DropdownMenuItem>
      )}
    </DropdownMenuGroup>
  );
}
