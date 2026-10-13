import { channelText, footprintOf, type Tester } from "@refrata/core";
import { Play, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Block, Field, FieldGrid } from "@/inspector/fields/form-block";
import { Choice, NumberBox, TextBox } from "@/inspector/fields/form-inputs";
import { useCommand, useDocumentPath } from "@/lib/client";

import { useFixtureEditor } from "./editor-state";
import type { Scope } from "./scope";
import { holdsFixture, probeFixtures } from "./probe-range";

/**
 * One Action: its name, the Channel and byte it holds, and for how long.
 * It runs on the Fixture the probe is aimed at, through the Action's own
 * Address; while the probe holds that Fixture its bytes stay on top.
 */
export function ActionEditor({
  scope,
  actionKey,
  onRemove,
}: {
  readonly scope: Scope;
  readonly actionKey: string;
  readonly onRemove: () => void;
}) {
  const command = useCommand(scope.view);
  const { probeFixtureId } = useFixtureEditor();
  const fixtures =
    useDocumentPath<Parameters<typeof probeFixtures>[0]>(scope.view, [
      "fixtures",
    ]) ?? {};
  const tester = useDocumentPath<Tester | null>(scope.view, [
    "operational",
    "tester",
  ]);
  const running =
    useDocumentPath<boolean>(scope.view, [
      "operational",
      "actions",
      `${probeFixtureId ?? ""}/${actionKey}`,
    ]) === true;
  const action = scope.mode.actions[actionKey];
  if (action === undefined) return null;
  const aimed = probeFixtures(fixtures, scope.typeKey, scope.modeKey).find(
    (fixture) => fixture.id === probeFixtureId,
  );
  const update = (change: object): void =>
    void scope.run("type.action.update", { action: actionKey, ...change });
  return (
    <Block
      title="Action"
      actions={
        <>
          <Button
            variant="outline"
            size="xs"
            disabled={aimed === undefined || running}
            title={
              aimed === undefined
                ? "Pick a Fixture in the probe to run it there"
                : `Runs on ${aimed.name}`
            }
            onClick={() => {
              if (aimed !== undefined)
                void command("address.trigger", {
                  address: `fixture/${aimed.id}/action/${actionKey}`,
                });
            }}
          >
            <Play /> {running ? "Running" : "Run on the probe"}
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
            value={action.name}
            onChange={(name) => {
              if (name.trim() !== "") update({ name: name.trim() });
            }}
          />
        </Field>
        <Field label="Key">
          <span className="flex h-6 items-center font-mono text-xs text-muted-foreground">
            {actionKey}
          </span>
        </Field>
        <Field label="Channel">
          <Choice
            value={action.channel}
            options={scope.rows.map((row) => ({
              value: row.key,
              label: channelText(row),
            }))}
            onChange={(channel) => update({ channel })}
          />
        </Field>
        <Field label="Byte">
          <NumberBox
            label="Byte"
            value={action.byte}
            onChange={(byte) => update({ byte: Math.round(byte) })}
          />
        </Field>
        <Field label="Held for, seconds">
          <NumberBox
            label="Seconds"
            min={0.1}
            max={600}
            value={action.seconds}
            onChange={(seconds) => update({ seconds })}
          />
        </Field>
      </FieldGrid>
      {holdsFixture(tester, aimed, footprintOf(scope.mode)) && (
        <p className="text-[0.6875rem]/snug text-muted-foreground">
          The probe holds {aimed?.name ?? "the Fixture"}, and held bytes stay on
          top of an Action. Release to see this one.
        </p>
      )}
    </Block>
  );
}
