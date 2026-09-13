/**
 * Matching a typed query against a name: a name that starts with the query
 * beats a name with a word starting with it, which beats a name merely
 * containing its letters in order. The pickers search word by word with it.
 */

/** Whether every character of `query` appears in `text` in order. */
export function isSubsequence(query: string, text: string): boolean {
  let at = 0;
  for (const character of query) {
    at = text.indexOf(character, at);
    if (at === -1) return false;
    at += 1;
  }
  return true;
}

/** 0 prefix, 1 word prefix, 2 letters in order; undefined when `text` does not match. */
export function matchTier(
  query: string,
  text: string,
  fuzzy = true,
): 0 | 1 | 2 | undefined {
  const haystack = text.toLowerCase();
  if (haystack.startsWith(query)) return 0;
  if (haystack.split(/\s+/).some((word) => word.startsWith(query))) return 1;
  if (fuzzy && isSubsequence(query.replaceAll(" ", ""), haystack)) return 2;
  return undefined;
}
