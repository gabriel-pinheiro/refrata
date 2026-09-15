import {
  fixtureModeOf,
  patchedIn,
  type Document,
  type Tester,
} from "@refrata/core";

/** One channel of a held range as the tab draws it. */
export interface TesterChannel {
  /** Absolute channel number, 1 to 512. */
  readonly channel: number;
  /** The byte held, or null when released. */
  readonly value: number | null;
  /** What a Fixture patched over this channel calls it, "Par · red", to compare against a guessed Fixture Type. */
  readonly name: string | undefined;
}

/** The held channels with the names of whatever is patched over them. */
export function testerChannels(
  document: Document,
  tester: Tester,
): readonly TesterChannel[] {
  const names = new Map<number, string>();
  for (const fixture of patchedIn(document, tester.universeId)) {
    const mode = fixtureModeOf(document, fixture);
    if (mode === undefined || fixture.patch === null) continue;
    let channel = fixture.patch.address;
    for (const declared of mode.channels) {
      for (let byte = 0; byte < declared.bytes; byte += 1) {
        names.set(
          channel,
          `${fixture.name} · ${declared.key}${declared.bytes > 1 ? ` ${String(byte + 1)}` : ""}`,
        );
        channel += 1;
      }
    }
  }
  return tester.values.map((value, index) => {
    const channel = tester.address + index;
    return { channel, value, name: names.get(channel) };
  });
}
