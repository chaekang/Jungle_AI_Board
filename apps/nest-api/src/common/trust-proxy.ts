export function parseTrustProxyHops(value?: string) {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }

  const hops = Number(value);
  return Number.isInteger(hops) && hops > 0 ? hops : undefined;
}
