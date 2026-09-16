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
  /** Pretend the widget was unplugged without the port noticing: every later write and break rejects, and no close is reported. */
  fail(error: Error): void;
  /** Pretend the widget stopped answering: every later write and break never settles. */
  hang(): void;
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
        let failure: Error | undefined;
        let hung = false;
        const never = new Promise<void>(() => undefined);
        const link: FakeLink = {
          path,
          options,
          log: [],
          get closed() {
            return closed;
          },
          write(bytes) {
            if (failure !== undefined) return Promise.reject(failure);
            if (hung) return never;
            link.log.push(Uint8Array.from(bytes));
            return Promise.resolve();
          },
          setBreak(on) {
            if (failure !== undefined) return Promise.reject(failure);
            if (hung) return never;
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
          fail(error) {
            failure = error;
          },
          hang() {
            hung = true;
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
