import { pcPartPickerQuery } from "./shopping-links";

// Shared by the browser tracker and the API route, so it stays free of server-only
// imports (the request schema is in shop-click-schema.ts).
//
// Counts clicks on shop links, so it's visible which retailers and parts earn. Nothing
// identifies the visitor: a click is stored only as one more on a per-day counter for
// (retailer, part, page kind), with no IP, user agent, cookie or full URL.

export const SHOP_RETAILERS = ["amazon", "google-shopping", "pcpartpicker"] as const;
export type ShopRetailer = (typeof SHOP_RETAILERS)[number];

// Stored as plain strings (see prisma/schema.prisma), so these lists are the only check.
// A new route counts as "other" until it's added to pageKind.
export const PAGE_KINDS = ["home", "cpu", "gpu", "pair", "cpus", "gpus", "local-ai", "other"] as const;
export type PageKind = (typeof PAGE_KINDS)[number];

export const MAX_QUERY_LENGTH = 120;

// What gets counted: one click, resolved to a catalogue part.
export interface ShopClickRecord {
  retailer: ShopRetailer;
  part: string;
  page: PageKind;
}

export interface ShopLinkTarget {
  retailer: ShopRetailer;
  query: string;
}

// Which retailer a link goes to, and the part searched for; null for any other link.
// Matches the URLs built in lib/shopping-links.ts.
interface ShopLinkRule {
  retailer: ShopRetailer;
  host: string; // without "www."
  matchesPath: (pathname: string) => boolean;
  queryParam: string;
  extra?: (params: URLSearchParams) => boolean;
}

// One rule per retailer link built in lib/shopping-links.ts; the round-trip tests feed
// those builders' URLs through here, so a changed link fails a test instead of silently
// going uncounted.
const SHOP_LINK_RULES: ShopLinkRule[] = [
  { retailer: "amazon", host: "amazon.de", matchesPath: (p) => p === "/s", queryParam: "k" },
  {
    retailer: "google-shopping",
    host: "google.com",
    matchesPath: (p) => p === "/search",
    queryParam: "q",
    extra: (params) => params.get("tbm") === "shop",
  },
  { retailer: "pcpartpicker", host: "pcpartpicker.com", matchesPath: (p) => p.startsWith("/search"), queryParam: "q" },
];

export function classifyShopHref(href: string): ShopLinkTarget | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  const rule = SHOP_LINK_RULES.find(
    (r) => r.host === host && r.matchesPath(url.pathname) && (r.extra?.(url.searchParams) ?? true)
  );
  const query = rule ? url.searchParams.get(rule.queryParam)?.trim() : undefined;
  if (!rule || !query || query.length > MAX_QUERY_LENGTH) return null;
  return { retailer: rule.retailer, query };
}

const PAGE_PREFIXES: [string, PageKind][] = [
  ["/bottleneck/", "pair"],
  ["/cpu/", "cpu"],
  ["/gpu/", "gpu"],
  ["/local-ai", "local-ai"],
];

export function pageKind(pathname: string): PageKind {
  if (pathname === "/") return "home";
  if (pathname === "/cpus") return "cpus";
  if (pathname === "/gpus") return "gpus";
  return PAGE_PREFIXES.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? "other";
}

// Left or middle click: both open the link (middle in a new tab).
export function isCountableButton(button: number): boolean {
  return button === 0 || button === 1;
}

// The beacon body for a click on this link, or null when it isn't a shop link.
export function buildShopClickBody(href: string, pathname: string): string | null {
  const target = classifyShopHref(href);
  return target ? JSON.stringify({ ...target, page: pageKind(pathname) }) : null;
}

// The catalogue model a click's search query names, or null when it names none. Only
// known parts are stored, so the table can't be filled with arbitrary strings.
// PCPartPicker links search a shortened name ("RTX 4070"), so those match that form.
// A linear scan over the ~250 catalogue names; fine at this size.
export function resolvePart(click: ShopLinkTarget, modelNames: readonly string[]): string | null {
  const matches = (name: string) =>
    click.retailer === "pcpartpicker" ? pcPartPickerQuery(name) === click.query : name === click.query;
  return modelNames.find(matches) ?? null;
}

// Midnight UTC of the click's day: the counters are per day.
export function utcDay(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
}
