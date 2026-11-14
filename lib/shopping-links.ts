export function pcPartPickerQuery(name: string): string {
  return name
    .replace("Intel Core ", "")         // "i9-14900K"
    .replace(/AMD Ryzen \d+ /, "")      // "5950X", "7950X"
    .replace("NVIDIA GeForce ", "")     // "RTX 3090"
    .replace("AMD Radeon ", "");        // "RX 7900 XTX"
}

export function buildGoogleShoppingUrl(modelName: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(modelName)}&tbm=shop`;
}

export function buildPcPartPickerUrl(modelName: string): string {
  return `https://pcpartpicker.com/search/?q=${encodeURIComponent(pcPartPickerQuery(modelName))}`;
}

// Affiliate links must be marked as paid so search engines don't treat them as endorsements.
export const AFFILIATE_REL = "sponsored nofollow noopener noreferrer";

export function hasAffiliateTag(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_TAG);
}

// Tagged amazon.de search link; null when no Associates tag is configured.
export function buildAmazonSearchUrl(modelName: string): string | null {
  const tag = process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_TAG;
  if (!tag) return null;
  return `https://www.amazon.de/s?k=${encodeURIComponent(modelName)}&tag=${encodeURIComponent(tag)}`;
}

export interface ShopLink {
  href: string;
  label: string;
  rel: string;
}

// Single "where to buy" link for compact lists: Amazon when tagged, otherwise Google Shopping.
export function buildShopLink(modelName: string): ShopLink {
  const amazon = buildAmazonSearchUrl(modelName);
  return amazon
    ? { href: amazon, label: "Amazon", rel: AFFILIATE_REL }
    : { href: buildGoogleShoppingUrl(modelName), label: "Shop", rel: "noopener noreferrer" };
}
