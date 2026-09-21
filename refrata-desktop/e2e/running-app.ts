import { RefrataClient } from "@refrata/client";
import type { OutputState } from "@refrata/protocol";

import { app, env, eventually } from "./harness.ts";

/**
 * Questions to the Desktop a test launched, and to its runtime, for the tests
 * of Desktop running as an appliance (`appliance.test.ts`).
 */

/** Whether the runtime Desktop started answers. */
export async function health(): Promise<boolean> {
  return fetch(`http://127.0.0.1:${env.REFRATA_PORT ?? ""}/health`).then(
    (response) => response.ok,
    () => false,
  );
}

/** How many windows Desktop has open, asked of its main process. */
export async function windowCount(): Promise<number | undefined> {
  return app?.evaluate(
    ({ BrowserWindow }) => BrowserWindow.getAllWindows().length,
  );
}

/**
 * The PID of the runtime child of the Desktop this test launched, from that
 * Desktop's own process list, so a test that kills a runtime can only ever
 * kill its own.
 */
export async function runtimeChildPid(): Promise<number | undefined> {
  return app?.evaluate(
    ({ app: electronApp }) =>
      electronApp
        .getAppMetrics()
        .find(
          (metric) =>
            metric.type === "Utility" &&
            (metric.serviceName === "Refrata Runtime" ||
              metric.name === "Refrata Runtime"),
        )?.pid,
  );
}

/**
 * Answers every native message box of main's with `response` from now on (a
 * native dialog cannot be clicked from here) and collects what each asked.
 */
export async function answerDialogs(response: number): Promise<void> {
  await app?.evaluate(({ dialog }, answer) => {
    const asked = ((globalThis as { asked?: string[] }).asked ??= []);
    dialog.showMessageBox = (...args: unknown[]) => {
      const options = (args.length > 1 ? args[1] : args[0]) as {
        message: string;
        detail?: string;
        buttons: string[];
      };
      asked.push(
        `${options.message} ${options.detail ?? ""} ${options.buttons.join("/")}`,
      );
      return Promise.resolve({ response: answer, checkboxChecked: false });
    };
  }, response);
}

export async function askedDialogs(): Promise<string[]> {
  const asked = await app?.evaluate(
    () => (globalThis as { asked?: string[] }).asked ?? [],
  );
  return asked ?? [];
}

/** A client of the runtime's own, as the CLI would be one, closed again after `use`. */
async function asAnotherClient<T>(
  port: string | undefined,
  use: (client: RefrataClient, documentId: string) => Promise<T>,
): Promise<T> {
  const client = new RefrataClient({
    url: `ws://127.0.0.1:${port ?? ""}/live`,
    kind: "cli",
    reconnect: false,
  });
  try {
    const summary = await eventually(
      () => Promise.resolve(client.document.get()),
      (document) => document !== null,
    );
    return await use(client, summary?.id ?? "");
  } finally {
    client.close();
  }
}

/** The Installation the runtime has open, asked as another client: its name, and whether it has unsaved changes. */
export async function openInstallation(
  port: string | undefined,
): Promise<{ readonly name: string; readonly dirty: boolean } | undefined> {
  return asAnotherClient(port, (client) => {
    const summary = client.document.get();
    return Promise.resolve(
      summary === null
        ? undefined
        : { name: summary.name, dirty: summary.dirty },
    );
  });
}

export async function openInstallationName(
  port: string | undefined,
): Promise<string | undefined> {
  return (await openInstallation(port))?.name;
}

/** Each Output's state as the runtime reports it, asked as another client that follows live state. */
export async function outputStates(
  port: string | undefined,
): Promise<Record<string, OutputState>> {
  return asAnotherClient(port, async (client, documentId) => {
    const view = client.openDocument(documentId, { live: true });
    await eventually(
      () => Promise.resolve(view.get()),
      (document) => document !== undefined,
    );
    return Object.fromEntries(
      Object.entries(view.liveState.get().outputs).map(([id, status]) => [
        id,
        status.state,
      ]),
    );
  });
}

/** Whether a checkbox of the native menu is checked. */
export async function menuChecked(id: string): Promise<boolean | undefined> {
  return app?.evaluate(
    ({ Menu }, itemId) =>
      Menu.getApplicationMenu()?.getMenuItemById(itemId)?.checked,
    id,
  );
}
