import type { RamTypeValue } from "@/types/hardware";

export const SOCKET_ORDER = ["AM4", "AM5", "LGA1200", "LGA1700", "LGA1851"] as const;

export const SOCKET_LABELS: Record<string, string> = {
  AM4: "AMD AM4 (Ryzen 5000 & older)",
  AM5: "AMD AM5 (Ryzen 7000/9000)",
  LGA1200: "Intel LGA1200 (10th/11th Gen)",
  LGA1700: "Intel LGA1700 (12th–14th Gen)",
  LGA1851: "Intel LGA1851 (Core Ultra 200)",
};

// Which RAM types each socket's motherboards take. LGA1700 boards come in DDR4 and DDR5 versions.
export const SOCKET_RAM_COMPAT: Record<string, RamTypeValue[]> = {
  AM4: ["DDR4"],
  AM5: ["DDR5"],
  LGA1200: ["DDR4"],
  LGA1700: ["DDR4", "DDR5"],
  LGA1851: ["DDR5"],
};

// How current each platform is: 1 = end of life (AM4, LGA1200), 2 = no new CPUs coming
// (LGA1700), 3 = current (AM5, LGA1851). A platform upgrade never moves to a lower era,
// from either vendor; same-era moves are allowed (e.g. LGA1851 to AM5).
export const SOCKET_ERA: Record<string, number> = {
  AM4: 1,
  LGA1200: 1,
  LGA1700: 2,
  AM5: 3,
  LGA1851: 3,
};

// false also when either socket is unknown.
export function isOlderPlatform(current: string, candidate: string): boolean {
  const from = SOCKET_ERA[current];
  const to = SOCKET_ERA[candidate];
  return from !== undefined && to !== undefined && to < from;
}

// Unknown sockets count as compatible: better to show a kit than to hide every one.
export function isRamCompatible(socket: string | null, ramType: RamTypeValue): boolean {
  const types = ramTypesForSocket(socket);
  return !types || types.includes(ramType);
}

// null when the socket is missing or not in the table: compatibility unknown.
export function ramTypesForSocket(socket: string | null): RamTypeValue[] | null {
  return socket ? (SOCKET_RAM_COMPAT[socket] ?? null) : null;
}
