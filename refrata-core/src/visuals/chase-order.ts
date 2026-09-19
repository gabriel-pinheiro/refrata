export const CHASE_ORDERS = [
  { value: "forward", label: "Forward" },
  { value: "backward", label: "Backward" },
  { value: "bounce", label: "Bounce" },
  { value: "center-out", label: "Center out" },
  { value: "ends-in", label: "Ends in" },
  { value: "random", label: "Random" },
] as const;

/**
 * The steps of one pass of a Chase over `count` Targets: each step is the
 * indexes lit together. Center out over eight is four steps of pairs; over
 * seven, the middle one alone, then pairs. Random has no pass; see `heads`.
 */
export function chaseSteps(
  order: string,
  count: number,
): readonly (readonly number[])[] {
  const forward = Array.from({ length: count }, (_, index) => [index]);
  switch (order) {
    case "backward":
      return forward.reverse();
    case "bounce":
      return count < 3
        ? forward
        : [...forward, ...forward.slice(1, -1).reverse()];
    case "center-out":
    case "ends-in": {
      const pairs: number[][] = [];
      for (let low = 0, high = count - 1; low <= high; low += 1, high -= 1)
        pairs.push(low === high ? [low] : [low, high]);
      return order === "ends-in" ? pairs : pairs.reverse();
    }
    default:
      return forward;
  }
}

/** The indexes lit at `position`: the pass wraps around; random picks one that is not `last`. */
export function heads(
  order: string,
  count: number,
  position: number,
  last: readonly number[],
  random: () => number,
): readonly number[] {
  if (count === 0) return [];
  if (order === "random") {
    if (count === 1) return [0];
    let index = Math.floor(random() * (count - 1));
    if (last.includes(index)) index = count - 1;
    return [index];
  }
  const steps = chaseSteps(order, count);
  return steps[position % steps.length] ?? [];
}
