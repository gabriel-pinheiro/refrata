import {
  addressText,
  topByte,
  writerText,
  type ChannelRow,
} from "@refrata/core";
import { memo } from "react";

import { ByteBar } from "@/entities/fixture-type/byte-bar";
import { ProbeFader } from "@/entities/fixture-type/probe-fader";
import type { Scope } from "@/entities/fixture-type/scope";
import { useProbe, type Probe } from "@/entities/fixture-type/use-probe";
import { cn } from "@/lib/utils";

import { LIST_HEAD, listRow } from "./rows";

/** One Channel's line; it draws again only when its own row, its pick or its probe value changes. */
const ChannelLine = memo(function ChannelLine({
  row,
  selected,
  value,
  onOpen,
  onProbe,
}: {
  readonly row: ChannelRow;
  readonly selected: boolean;
  /** The probe's value of the Channel, undefined while nothing is held. */
  readonly value: number | undefined;
  readonly onOpen: Scope["open"];
  readonly onProbe: Probe["set"] | undefined;
}) {
  const writers = row.writers.map(writerText).join("; ");
  return (
    <div
      className={listRow(selected)}
      onClick={(event) => onOpen({ kind: "channel", key: row.key }, event)}
    >
      <span className="w-10 shrink-0 text-muted-foreground tabular-nums">
        {addressText(row)}
      </span>
      <span className="w-32 shrink-0 truncate font-medium">
        {row.name}
        {row.bytes > 1 && (
          <span className="ml-1.5 font-normal text-muted-foreground">
            {String(row.bytes * 8)} bit
          </span>
        )}
      </span>
      <span className="hidden w-32 shrink-0 truncate text-muted-foreground @2xl:block">
        {row.elementName}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate",
          row.writers.length === 0 && "text-muted-foreground/60 italic",
        )}
        title={writers}
      >
        {row.writers.length === 0 ? "Not mapped" : writers}
      </span>
      <ByteBar
        className="hidden w-40 shrink-0 @xl:block"
        segments={row.segments}
        value={value === undefined ? undefined : topByte(row.bytes, value)}
      />
      {value !== undefined && onProbe !== undefined && (
        <div
          className="basis-full pl-13 @4xl:basis-64 @4xl:pl-0"
          onClick={(event) => event.stopPropagation()}
        >
          <ProbeFader row={row} value={value} onChange={onProbe} />
        </div>
      )}
    </div>
  );
});

/** The Channel Layout in wire order; while the probe holds a Fixture, each row carries its fader. */
export function ChannelList({ scope }: { readonly scope: Scope }) {
  const probe = useProbe(scope);
  const picked = scope.pick?.kind === "channel" ? scope.pick.key : undefined;
  return (
    <>
      <div className={LIST_HEAD}>
        <span className="w-10 shrink-0">Ch</span>
        <span className="w-32 shrink-0">Name</span>
        <span className="hidden w-32 shrink-0 @2xl:block">Element</span>
        <span className="min-w-0 flex-1">Written by</span>
        <span className="hidden w-40 shrink-0 @xl:block">Bytes 0 to 255</span>
        {probe !== null && (
          <span className="hidden w-64 shrink-0 @4xl:block">Probe</span>
        )}
      </div>
      {scope.rows.map((row) => (
        <ChannelLine
          key={row.key}
          row={row}
          selected={picked === row.key}
          value={probe === null ? undefined : (probe.values[row.key] ?? 0)}
          onOpen={scope.open}
          onProbe={probe?.set}
        />
      ))}
    </>
  );
}
