import { addressText, channelKeyFor, topByte, writerText } from "@refrata/core";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Block, Field, FieldGrid } from "@/inspector/fields/form-block";
import {
  Choice,
  NumberBox,
  Pills,
  TextBox,
} from "@/inspector/fields/form-inputs";

import { ByteBar } from "./byte-bar";
import { ProbeFader } from "./probe-fader";
import type { Scope } from "./scope";
import { useProbe } from "./use-probe";

/**
 * One Channel: its name, how many bytes wide it is, the Element it belongs
 * to and the byte it rests at while no Parameter writes it; then its 256
 * bytes with every range on them, the probe fader, and the Parameters that
 * write it.
 */
export function ChannelEditor({
  scope,
  channelKey,
  onRemove,
}: {
  readonly scope: Scope;
  readonly channelKey: string;
  readonly onRemove: () => void;
}) {
  const probe = useProbe(scope);
  const place = scope.rows.findIndex((each) => each.key === channelKey);
  const row = scope.rows[place];
  if (row === undefined) return null;
  const update = (change: object): void =>
    void scope.run("type.channel.update", { channel: channelKey, ...change });
  const move = (after: string | null | undefined): void => {
    if (after !== undefined)
      void scope.run("type.channel.move", { channel: channelKey, after });
  };
  return (
    <div className="min-w-0">
      <Block
        title={`Channel ${addressText(row)}`}
        actions={
          <>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Move earlier"
              title="Move earlier on the wire"
              disabled={place === 0}
              onClick={() => move(scope.rows[place - 2]?.key ?? null)}
            >
              <ArrowUp />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Move later"
              title="Move later on the wire"
              disabled={place === scope.rows.length - 1}
              onClick={() => move(scope.rows[place + 1]?.key)}
            >
              <ArrowDown />
            </Button>
            <Button variant="ghost" size="xs" onClick={onRemove}>
              <Trash2 /> Remove
            </Button>
          </>
        }
      >
        <FieldGrid min="8rem">
          <Field label="Name">
            <TextBox
              label="Name"
              value={row.name}
              onChange={(name) => {
                const key = channelKeyFor(scope.mode, name, channelKey);
                void scope
                  .run("type.channel.update", { channel: channelKey, name })
                  .then((result) => {
                    if (result !== undefined && key !== undefined)
                      scope.open({ kind: "channel", key });
                  });
              }}
            />
          </Field>
          <Field label="Element">
            <Choice
              value={row.element}
              options={Object.entries(scope.mode.elements).map(
                ([key, element]) => ({ value: key, label: element.name }),
              )}
              onChange={(element) => {
                if (element !== row.element) update({ element });
              }}
            />
          </Field>
          <Field
            label="Bytes"
            hint={
              row.bytes > 1
                ? "One Channel over consecutive addresses, most significant first."
                : undefined
            }
          >
            <Pills
              value={String(row.bytes)}
              options={["1", "2", "3"].map((value) => ({
                value,
                label: value,
              }))}
              onChange={(bytes) => update({ bytes: Number(bytes) })}
            />
          </Field>
          <Field
            label="Rest byte"
            hint="Sent while no Parameter writes the Channel."
          >
            <NumberBox
              label="Rest byte"
              className="w-16"
              value={row.rest}
              onChange={(rest) => update({ rest: Math.round(rest) })}
            />
          </Field>
        </FieldGrid>
      </Block>
      <Block title="On the wire">
        <ByteBar
          segments={row.segments}
          value={
            probe === null
              ? undefined
              : topByte(row.bytes, probe.values[row.key] ?? 0)
          }
        />
        {probe !== null && (
          <ProbeFader
            row={row}
            value={probe.values[row.key] ?? 0}
            onChange={probe.set}
          />
        )}
      </Block>
      <Block title="Written by">
        {row.writers.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No Parameter yet. Add one on {row.elementName} and point its
            Encoding here.
          </p>
        )}
        {row.writers.map((writer) => (
          <button
            key={`${writer.element}:${writer.attribute}`}
            type="button"
            className="flex min-h-7 w-full items-center rounded-sm px-2 py-1 text-left text-xs hover:bg-muted/50"
            onClick={() =>
              scope.open({
                kind: "parameter",
                element: writer.element,
                attribute: writer.attribute,
              })
            }
          >
            {writerText(writer)}
          </button>
        ))}
        <Button
          variant="outline"
          size="xs"
          className="w-fit"
          onClick={() => scope.open({ kind: "element", key: row.element })}
        >
          Open {row.elementName}
        </Button>
      </Block>
    </div>
  );
}
