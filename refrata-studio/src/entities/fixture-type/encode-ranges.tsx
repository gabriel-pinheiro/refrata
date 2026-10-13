import { nextRange } from "@refrata/core";

import { useNameDialog } from "@/components/name-dialog";
import { Switch } from "@/components/ui/switch";
import { Field, FieldGrid } from "@/inspector/fields/form-block";
import { Choice, NumberBox } from "@/inspector/fields/form-inputs";

import { ChannelToggles, type EncodeProps } from "./encode-parts";
import { fromHex, RangesTable, toHex } from "./ranges-table";

/** The Settle time a wheel starts with when it is switched on. */
const FIRST_SETTLE = { base: 0.08, perSlot: 0.05 };

/** A colour wheel: the Channel that turns it, its swatches in wheel order, what its brightness dims, and its Settle time. */
export function WheelFields({
  parameter,
  channels,
  current,
  encode,
  run,
}: EncodeProps) {
  if (!("wheel" in parameter.encode)) return null;
  const rule = parameter.encode;
  const swatches = parameter.swatches ?? [];
  const next = nextRange(swatches.map((swatch) => swatch.bytes));
  const settle = parameter.settle;
  return (
    <>
      <FieldGrid min="9rem">
        <Field label="Channel">
          <Choice
            value={rule.wheel}
            options={channels}
            onChange={(channel) => encode({ channel })}
          />
        </Field>
        <Field
          label="Brightness dims"
          hint="A wheel has no dark slot, so the colour's brightness scales these Channels."
        >
          <ChannelToggles
            options={channels.filter((option) => option.value !== rule.wheel)}
            values={rule.multiply ?? []}
            onChange={(dims) => encode({ dims })}
          />
        </Field>
      </FieldGrid>
      <RangesTable
        title="Swatch"
        current={current(rule.wheel)}
        rows={swatches.map((swatch) => ({
          label: swatch.label,
          bytes: swatch.bytes,
          color: toHex(swatch.color),
        }))}
        onBytes={(index, bytes) => run("type.swatch.update", { index, bytes })}
        onLabel={(index, label) => {
          if (label.trim() !== "")
            run("type.swatch.update", { index, label: label.trim() });
        }}
        onColor={(index, hex) =>
          run("type.swatch.update", { index, color: fromHex(hex) })
        }
        addLabel="Swatch"
        onAdd={next === undefined ? undefined : () => run("type.swatch.add")}
        onRemove={
          swatches.length > 1
            ? (index) => run("type.swatch.remove", { index })
            : undefined
        }
      />
      <div className="grid gap-1.5">
        <label className="flex items-center gap-2 text-xs">
          <Switch
            checked={settle !== undefined}
            onCheckedChange={(on) =>
              run("type.parameter.update", {
                settle: on ? FIRST_SETTLE : null,
              })
            }
          />
          Settle: dark while the wheel travels
        </label>
        {settle !== undefined && (
          <FieldGrid>
            <Field label="Base, seconds">
              <NumberBox
                label="Settle base"
                max={10}
                value={settle.base}
                onChange={(base) =>
                  run("type.parameter.update", { settle: { ...settle, base } })
                }
              />
            </Field>
            <Field label="Per slot, seconds">
              <NumberBox
                label="Settle per slot"
                max={10}
                value={settle.perSlot}
                onChange={(perSlot) =>
                  run("type.parameter.update", {
                    settle: { ...settle, perSlot },
                  })
                }
              />
            </Field>
          </FieldGrid>
        )}
      </div>
    </>
  );
}

/** An open choice: the Channel and a byte range per option. An option's value is made from the name it is added with and stays; its label can change. */
export function RangeFields({
  parameter,
  channels,
  current,
  encode,
  run,
}: EncodeProps) {
  const [ask, dialog] = useNameDialog();
  if (!("range" in parameter.encode)) return null;
  const rule = parameter.encode;
  const options = parameter.options ?? [];
  const next = nextRange(options.map((option) => option.bytes));
  return (
    <>
      <Field label="Channel">
        <Choice
          value={rule.range}
          options={channels}
          onChange={(channel) => encode({ channel })}
        />
      </Field>
      <RangesTable
        title="Option"
        current={current(rule.range)}
        rows={options.map((option) => ({
          label: option.label,
          bytes: option.bytes,
          fixed: option.value,
        }))}
        onBytes={(index, bytes) => {
          const option = options[index]?.value;
          if (option !== undefined)
            run("type.option.update", { option, bytes });
        }}
        onLabel={(index, label) => {
          const option = options[index]?.value;
          if (option !== undefined && label.trim() !== "")
            run("type.option.update", { option, label: label.trim() });
        }}
        addLabel="Option"
        onAdd={
          next === undefined
            ? undefined
            : () =>
                ask({
                  title: "New option",
                  label: "Name. Its value is made from it and stays.",
                  initial: "",
                  submitLabel: "Add",
                  onSubmit: (label) => run("type.option.add", { label }),
                })
        }
        onRemove={
          options.length > 1
            ? (index) => {
                const option = options[index]?.value;
                if (option !== undefined) run("type.option.remove", { option });
              }
            : undefined
        }
      />
      {dialog}
    </>
  );
}
