export function formatGb(gib: number): string {
  // Compare after rounding so 9.97 reads "10", not "10.0".
  return Math.round(gib * 10) < 100 ? gib.toFixed(1) : Math.round(gib).toString();
}

// 0.75 → "75%"
export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

export function formatContext(tokens: number): string {
  return `${tokens / 1024}K`;
}

// Whole tok/s, or one decimal below 10.
function roundSpeed(tokensPerSecond: number): string {
  return tokensPerSecond < 10 ? tokensPerSecond.toFixed(1) : String(Math.round(tokensPerSecond));
}

// Measured, so no "~".
export function formatMeasuredSpeed(tokensPerSecond: number | null): string {
  return tokensPerSecond === null ? "—" : `${roundSpeed(tokensPerSecond)} tok/s`;
}

export function formatSpeed(tokensPerSecond: number | null): string {
  return tokensPerSecond === null ? "—" : `~${roundSpeed(tokensPerSecond)} tok/s`;
}

