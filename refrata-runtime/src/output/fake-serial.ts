import type {
  SerialLink,
  SerialOptions,
  SerialPortFactory,
  SerialPortInfo,
} from "./serial-link.ts";

/**
 * A serial port factory for tests: the ports it lists are given, and every
 * link records what a driver did to it (breaks and writes, in order).
 */
export interface FakeLink extends SerialLink {
  readonly options: SerialOptions;
  /** `break on`, `break off`, or the bytes written, in order. */
  readonly log: (string | Uint8Array)[];
  /** Pretend the widget was unplugged. */
  vanish(error?: Error): void;
  readonly closed: boolean;
}

export interface FakeSerial {
  readonly factory: SerialPortFactory;
  readonly links: FakeLink[];
  ports: SerialPortInfo[];
}

export function fakeSerialFactory(ports: SerialPortInfo[]): FakeSerial {
  const links: FakeLink[] = [];
  const fake: FakeSerial = {
    ports,
    links,
    factory: {
      list: () => Promise.resolve(fake.ports),
      open(path, options) {
        const closeListeners: ((error: Error | undefined) => void)[] = [];
        let closed = false;
        const link: FakeLink = {
          path,
          options,
          log: [],
          get closed() {
            return closed;
          },
          write(bytes) {
            link.log.push(Uint8Array.from(bytes));
            return Promise.resolve();
          },
          setBreak(on) {
            link.log.push(on ? "break on" : "break off");
            return Promise.resolve();
          },
          close() {
            closed = true;
            return Promise.resolve();
          },
          onClose(listener) {
            closeListeners.push(listener);
          },
          vanish(error) {
            closed = true;
            for (const listener of closeListeners) listener(error);
          },
        };
        links.push(link);
        return Promise.resolve(link);
      },
    },
  };
  return fake;
}

export const FTDI_PORT: SerialPortInfo = {
  path: "/dev/ttyUSB0",
  serialNumber: "A1B2C3",
  vendorId: "0403",
  productId: "6001",
  manufacturer: "FTDI",
};
