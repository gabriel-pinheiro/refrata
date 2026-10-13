import { parseFixtureType, type FixtureType } from "@refrata/core";

/**
 * A Fixture Type as a `.refrata-fixture` file, made and read in the page:
 * the type is in the document already, so exporting is a download and
 * importing is a file picked here. No path on the runtime's machine is
 * involved, so both work on a remote Studio and in Desktop alike.
 */
export const FIXTURE_FILE_EXTENSION = ".refrata-fixture";

/** The file name a type exports to: its model's part of the key. */
export function fixtureFileName(type: FixtureType): string {
  return `${type.key.slice(type.key.indexOf("/") + 1)}${FIXTURE_FILE_EXTENSION}`;
}

/** Starts the browser's own download of the type, exactly the Fixture Type format. */
export function downloadFixtureType(type: FixtureType): void {
  const url = URL.createObjectURL(
    new Blob([`${JSON.stringify(type, null, 2)}\n`], {
      type: "application/json",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = fixtureFileName(type);
  link.click();
  URL.revokeObjectURL(url);
}

/** Asks for one `.refrata-fixture` file on this machine; undefined when the picker is dismissed. */
export function pickFixtureFile(): Promise<File | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = `${FIXTURE_FILE_EXTENSION},.json,application/json`;
    input.addEventListener("change", () => resolve(input.files?.[0]));
    input.addEventListener("cancel", () => resolve(undefined));
    input.click();
  });
}

/** The Fixture Type a file holds, or why it holds none. */
export async function readFixtureFile(
  file: File,
): Promise<FixtureType | { readonly error: string }> {
  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    return { error: `${file.name} is not a Fixture Type file.` };
  }
  const parsed = parseFixtureType(json);
  return parsed.ok ? parsed.type : { error: `${file.name}: ${parsed.error}` };
}
