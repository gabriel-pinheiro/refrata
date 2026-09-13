import { RefrataClient } from "@refrata/client";
import { settings } from "@refrata/core";
import type { DocumentSummary } from "@refrata/protocol";
import { hostname, userInfo } from "node:os";

export const DEFAULT_URL = `ws://127.0.0.1:${String(settings.runtime.port)}${settings.runtime.livePath}`;

/** One undo owner per shell user, so `refrata undo` spans invocations. */
function cliActor(): string {
  return (
    process.env.REFRATA_ACTOR ?? `cli:${userInfo().username}@${hostname()}`
  );
}

function unreachable(url: string): Error {
  return new Error(
    `Could not connect to ${url}. The runtime speaks WebSocket at ${settings.runtime.livePath} on its HTTP port (${String(settings.runtime.port)} unless changed); is it running there?`,
  );
}

/** Connects to a normalized live URL (see `url.ts`) or fails naming what it tried. */
export async function connect(url: string): Promise<RefrataClient> {
  const client = new RefrataClient({
    url,
    kind: "cli",
    actor: cliActor(),
    reconnect: false,
    scheduleFlush: (flush) => setTimeout(flush, 0),
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(unreachable(url)),
      settings.cli.connectTimeoutMs,
    );
    client.phase.subscribe((phase) => {
      if (phase === "connected") {
        clearTimeout(timer);
        resolve();
      } else if (phase === "closed") {
        clearTimeout(timer);
        reject(unreachable(url));
      }
    });
  });
  // The document summary arrives right after welcome.
  await new Promise((resolve) => setTimeout(resolve, 20));
  return client;
}

/** The runtime's open Installation, or a helpful error. */
export function currentDocument(client: RefrataClient): DocumentSummary {
  const summary = client.document.get();
  if (summary === null)
    throw new Error(
      "No Installation is open. Use `refrata documents open <file>` or `refrata documents new <name>`.",
    );
  return summary;
}

export function parseJsonArgument(text: string | undefined): unknown {
  if (text === undefined || text.trim() === "") return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Not valid JSON: ${text}`);
  }
}

export function parseValue(text: string): unknown {
  if (text === "true") return true;
  if (text === "false") return false;
  if (text === "null") return null;
  const number = Number(text);
  if (text.trim() !== "" && Number.isFinite(number)) return number;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
