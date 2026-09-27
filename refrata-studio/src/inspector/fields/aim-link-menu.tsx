import type { ResolvedAddress } from "@refrata/core";
import { Link2 } from "lucide-react";
import { Fragment } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { LinkMenuItems, type RowLinks } from "./link-row";

/** One part of an Aim's Link menu: a caption and the Address it links. */
export interface AimLinkSection {
  readonly key: string;
  readonly title: string;
  readonly resolved: ResolvedAddress;
  readonly links: RowLinks;
}

/**
 * The one link button of an Aim row. Its menu has a section per part, each
 * offering what a row's own Link menu offers for that part's Address; the
 * button shows linked while any part is, and says which in its title.
 */
export function AimLinkMenu({
  label,
  sections,
}: {
  readonly label: string;
  readonly sections: readonly AimLinkSection[];
}) {
  const driven = sections.flatMap((section) =>
    section.links.controller === undefined || section.links.link === undefined
      ? []
      : [`${section.title} controlled by ${section.links.controller.name}`],
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${label} link`}
        title={driven.length === 0 ? "Link to a Controller" : driven.join(". ")}
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
        {sections.map((section, index) => (
          <Fragment key={section.key}>
            {index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                {section.links.controller === undefined
                  ? section.title
                  : `${section.title}: ${section.links.controller.name}`}
              </DropdownMenuLabel>
              <LinkMenuItems
                resolved={section.resolved}
                links={section.links}
              />
            </DropdownMenuGroup>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
