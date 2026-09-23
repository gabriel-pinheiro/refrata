import {
  channelLabel,
  universeMap,
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
  const map = universeMap(document, tester.universeId);
  return tester.values.map((value, index) => {
    const channel = tester.address + index;
    const occupied = map.get(channel);
    return {
      channel,
      value,
      name:
        occupied === undefined
          ? undefined
          : `${occupied.fixture.name} · ${channelLabel(occupied)}`,
    };
  });
}
