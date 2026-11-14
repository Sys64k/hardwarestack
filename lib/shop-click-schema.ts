import { z } from "zod";
import { MAX_QUERY_LENGTH, PAGE_KINDS, SHOP_RETAILERS, resolvePart } from "./shop-clicks";
import type { ShopClickRecord } from "./shop-clicks";

// The beacon body ShopClickTracker sends. Server-only, to keep zod out of the browser bundle.
export const shopClickSchema = z.object({
  retailer: z.enum(SHOP_RETAILERS),
  query: z.string().trim().min(1).max(MAX_QUERY_LENGTH),
  page: z.enum(PAGE_KINDS),
});
export type ShopClickBody = z.infer<typeof shopClickSchema>;

// Generous for the longest valid body; a query is at most MAX_QUERY_LENGTH characters.
export const MAX_BODY_CHARS = 1024;

export type ShopClickRejection = "too-large" | "invalid" | "unknown-part";

export type ParsedShopClick = { ok: true; click: ShopClickRecord } | { ok: false; reason: ShopClickRejection };

// Validates a click beacon's raw body and resolves its query to a catalogue model.
export function parseShopClick(text: string, modelNames: readonly string[]): ParsedShopClick {
  if (text.length > MAX_BODY_CHARS) return { ok: false, reason: "too-large" };
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  const parsed = shopClickSchema.safeParse(body);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const part = resolvePart(parsed.data, modelNames);
  if (!part) return { ok: false, reason: "unknown-part" };
  return { ok: true, click: { retailer: parsed.data.retailer, page: parsed.data.page, part } };
}
