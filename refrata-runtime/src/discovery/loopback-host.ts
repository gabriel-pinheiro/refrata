/**
 * Whether the host the runtime binds to is this machine alone: 127.0.0.0/8,
 * ::1 or `localhost`. Nobody on the network could reach such a runtime, so it
 * is not announced there.
 */
export function isLoopbackHost(host: string): boolean {
  const name = host
    .trim()
    .toLowerCase()
    .replace(/^\[(.*)\]$/, "$1");
  if (name === "localhost" || name === "::1") return true;
  // The IPv4 loopback block, also as an IPv4-mapped IPv6 address.
  return /^(::ffff:)?127(\.\d{1,3}){3}$/.test(name);
}
