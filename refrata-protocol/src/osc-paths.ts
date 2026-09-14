/**
 * How a document Address is named on the OSC tree, shared by the runtime
 * that serves the tree and the CLI that lists it. Controllers and Macros
 * keep their short paths; a Look Layer row's value ends in `/value`, which
 * leaves the Attribute node free for sibling leaves (a row's alpha, once it
 * has an Address again), since a node with a value cannot also be a container.
 */
export function oscPathOfAddress(address: string): string {
  const segments = address.split("/");
  const [head, id = "", tail] = segments;
  if (head === "controller" && tail === "value") return `/controller/${id}`;
  if (head === "macro" && tail === "run") return `/macro/${id}`;
  if (head === "layer" && segments[2] === "row") return `/${address}/value`;
  return `/${address}`;
}

/** The document Address an OSC path names, undoing `oscPathOfAddress`; undefined for a malformed path. */
export function addressOfOscPath(path: string): string | undefined {
  if (!path.startsWith("/") || path.endsWith("/")) return undefined;
  const segments = path.slice(1).split("/");
  if (segments.length < 2) return undefined;
  const [head, id = ""] = segments;
  if (segments.length === 2 && head === "controller")
    return `controller/${id}/value`;
  if (segments.length === 2 && head === "macro") return `macro/${id}/run`;
  if (head === "layer" && segments[2] === "row" && segments.at(-1) === "value")
    segments.pop();
  return segments.join("/");
}

/** The OSCQuery TYPE tag of an Address's value type; a switch is T or F by its value. */
export function oscTypeOf(
  type: "boolean" | "number" | "color" | "choice" | "trigger",
  value?: unknown,
): string {
  switch (type) {
    case "number":
      return "f";
    case "boolean":
      return value === true ? "T" : "F";
    case "color":
      return "r";
    case "choice":
      return "s";
    case "trigger":
      return "I";
  }
}
