export function formatGb(gib: number): string {
  // Compare after rounding so 9.97 reads "10", not "10.0".
  return Math.round(gib * 10) < 100 ? gib.toFixed(1) : Math.round(gib).toString();
}

export function formatContext(tokens: number): string {
  return `${tokens / 1024}K`;
}

export function formatSpeed(tokensPerSecond: number | null): string {
  if (tokensPerSecond === null) return "—";
  return tokensPerSecond < 10 ? `~${tokensPerSecond.toFixed(1)} tok/s` : `~${Math.round(tokensPerSecond)} tok/s`;
}

