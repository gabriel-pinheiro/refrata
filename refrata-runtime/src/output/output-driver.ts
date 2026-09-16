/**
 * What every Output kind provides, whatever carries its frames (a serial
 * widget, a USB device, later a network socket): finding and opening the
 * device an Output names, and a link that takes DMX Frames. Opening,
 * status, retries and the send timeout are the Output Manager's, shared by
 * every kind.
 */
export interface OutputDriver {
  /** Opens the device `device` names; rejects with DeviceMissingError when there is none. */
  open(device: string): Promise<OutputLink>;
}

export interface OutputLink {
  /** Where the frames go, as Output Status shows it: a serial path, a USB port location. */
  readonly location: string;
  /** Delivers one frame of 512 slots; resolves once the device has it. */
  send(frame: Uint8Array): Promise<void>;
  close(): Promise<void>;
  /** Called when the device goes away under us, if the transport can tell. */
  onClose(listener: (error: Error | undefined) => void): void;
}

/** No device matches what the Output names: reported as `device-missing`, not as an error. */
export class DeviceMissingError extends Error {
  override readonly name = "DeviceMissingError";
}
