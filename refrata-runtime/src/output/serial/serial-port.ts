/**
 * The slice of a serial port a serial Output driver needs, so drivers are
 * tested against a fake and the real `serialport` module is loaded only when
 * a widget is opened.
 */
export interface SerialPortInfo {
  readonly path: string;
  readonly serialNumber: string | undefined;
  readonly vendorId: string | undefined;
  readonly productId: string | undefined;
  readonly manufacturer: string | undefined;
}

export interface SerialOptions {
  readonly baudRate: number;
  readonly dataBits: 8;
  readonly stopBits: 1 | 2;
  readonly parity: "none";
}

export interface SerialLink {
  readonly path: string;
  write(bytes: Uint8Array): Promise<void>;
  /** Holds or releases the break condition on the line. */
  setBreak(on: boolean): Promise<void>;
  close(): Promise<void>;
  /** Called once when the port goes away under us. */
  onClose(listener: (error: Error | undefined) => void): void;
}

export interface SerialPortFactory {
  list(): Promise<readonly SerialPortInfo[]>;
  open(path: string, options: SerialOptions): Promise<SerialLink>;
}

/** FTDI's USB vendor id, which every Enttec widget and clone carries. */
export const FTDI_VENDOR_ID = "0403";

/**
 * The port for an Output's `device`: the widget with that serial number (or
 * at that path), or for `any` the first FTDI port. A built-in serial port
 * is never picked by `any`: it is not a DMX widget and refuses 250 kbaud.
 */
export function pickPort(
  ports: readonly SerialPortInfo[],
  device: string,
): SerialPortInfo | undefined {
  if (device !== "any")
    return ports.find(
      (port) => port.serialNumber === device || port.path === device,
    );
  return ports.find((port) => port.vendorId?.toLowerCase() === FTDI_VENDOR_ID);
}

/** The real thing, loaded on first use so a runtime without the native module still starts. */
export async function nodeSerialFactory(): Promise<SerialPortFactory> {
  const { SerialPort } = await import("serialport");
  return {
    async list() {
      const ports = await SerialPort.list();
      return ports.map((port) => ({
        path: port.path,
        serialNumber: port.serialNumber,
        vendorId: port.vendorId,
        productId: port.productId,
        manufacturer: port.manufacturer,
      }));
    },
    open(path, options) {
      return new Promise<SerialLink>((resolve, reject) => {
        const port = new SerialPort(
          { path, ...options, autoOpen: false },
          (error) => {
            if (error) reject(error);
          },
        );
        const closeListeners: ((error: Error | undefined) => void)[] = [];
        port.on("close", (error?: Error) => {
          for (const listener of closeListeners) listener(error);
        });
        port.open((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve({
            path,
            write: (bytes) =>
              new Promise((done, fail) => {
                port.write(Buffer.from(bytes), (writeError) => {
                  if (writeError) fail(writeError);
                  else
                    port.drain((drainError) =>
                      drainError ? fail(drainError) : done(),
                    );
                });
              }),
            setBreak: (on) =>
              new Promise((done, fail) => {
                port.set({ brk: on }, (setError) =>
                  setError ? fail(setError) : done(),
                );
              }),
            close: () =>
              new Promise((done) => {
                if (!port.isOpen) {
                  done();
                  return;
                }
                port.close(() => done());
              }),
            onClose: (listener) => {
              closeListeners.push(listener);
            },
          });
        });
      });
    },
  };
}
