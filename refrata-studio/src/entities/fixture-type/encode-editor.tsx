import {
  attributeInfo,
  channelText,
  ruleOf,
  ruleProblem,
  RULES,
  rulesFor,
  topByte,
} from "@refrata/core";

import { Field, FieldGrid } from "@/inspector/fields/form-block";
import { Choice } from "@/inspector/fields/form-inputs";

import { ChannelToggles, type EncodeProps } from "./encode-parts";
import { RangeFields, WheelFields } from "./encode-ranges";
import { SpreadFields } from "./encode-spread";
import { RangesTable } from "./ranges-table";
import type { Scope } from "./scope";
import type { Probe } from "./use-probe";

const MIX = ["Red", "Green", "Blue", "White"] as const;

function SimpleFields({ parameter, channels, current, encode }: EncodeProps) {
  const rule = parameter.encode;
  if ("scale" in rule)
    return (
      <Field label="Channel">
        <Choice
          value={rule.scale}
          options={channels}
          onChange={(channel) => encode({ channel })}
        />
      </Field>
    );
  if ("color" in rule)
    return (
      <FieldGrid>
        {MIX.map((name, index) => (
          <Field key={name} label={`${name} Channel`}>
            <Choice
              value={rule.color[index] ?? "none"}
              placeholder="None"
              options={[
                ...(index === 3 ? [{ value: "none", label: "None" }] : []),
                ...channels,
              ]}
              onChange={(key) => {
                const next = [...rule.color];
                if (key === "none") next.length = 3;
                else next[index] = key;
                encode({ channels: next });
              }}
            />
          </Field>
        ))}
      </FieldGrid>
    );
  if ("multiply" in rule && !("wheel" in rule))
    return (
      <Field label="Scales these Channels">
        <ChannelToggles
          options={channels}
          values={rule.multiply}
          onChange={(keys) => encode({ channels: keys })}
        />
      </Field>
    );
  if ("switch" in rule)
    return (
      <>
        <Field label="Channel">
          <Choice
            value={rule.switch}
            options={channels}
            onChange={(channel) => encode({ channel })}
          />
        </Field>
        <RangesTable
          title="State"
          current={current(rule.switch)}
          rows={[
            { label: "Off", bytes: rule.off },
            { label: "On", bytes: rule.on },
          ]}
          onBytes={(index, bytes) =>
            encode(index === 0 ? { off: bytes } : { on: bytes })
          }
        />
      </>
    );
  return null;
}

/**
 * A Parameter's Encoding: the rule, offered among those that read the
 * Attribute's kind, a line on what it does, and the rule's own fields. A
 * rule the Element cannot take is listed but not offered, and says why.
 */
export function EncodeEditor({
  scope,
  probe,
  element,
  attribute,
}: {
  readonly scope: Scope;
  readonly probe: Probe | null;
  readonly element: string;
  readonly attribute: string;
}) {
  const parameter = scope.mode.elements[element]?.parameters[attribute];
  if (parameter === undefined) return null;
  const rule = ruleOf(parameter.encode);
  const offered = rulesFor(attributeInfo(attribute).kind).map((each) => ({
    rule: each,
    problem:
      each === rule
        ? undefined
        : ruleProblem(scope.mode, element, attribute, each),
  }));
  const props: EncodeProps = {
    scope,
    element,
    attribute,
    parameter,
    channels: scope.rows
      .filter((row) => row.element === element)
      .map((row) => ({ value: row.key, label: channelText(row) })),
    current: (channelKey) => {
      const row = scope.rows.find((each) => each.key === channelKey);
      return probe === null || row === undefined
        ? undefined
        : topByte(row.bytes, probe.values[channelKey] ?? 0);
    },
    encode: (change) =>
      void scope.run("type.encoding.set", { element, attribute, ...change }),
    run: (name, payload = {}) =>
      void scope.run(name, { element, attribute, ...payload }),
  };
  return (
    <div className="grid max-w-xl min-w-0 gap-2.5">
      <Field label="Rule" hint={RULES[rule].summary}>
        <Choice
          value={rule}
          options={offered.map((each) => ({
            value: each.rule,
            label: RULES[each.rule].label,
            disabled: each.problem !== undefined,
          }))}
          onChange={(next) => props.encode({ rule: next })}
        />
      </Field>
      {offered.map(
        (each) =>
          each.problem !== undefined && (
            <p
              key={each.rule}
              className="text-[0.625rem]/snug text-muted-foreground/80"
            >
              {each.problem}
            </p>
          ),
      )}
      <SimpleFields {...props} />
      <WheelFields {...props} />
      <RangeFields {...props} />
      <SpreadFields {...props} />
    </div>
  );
}
