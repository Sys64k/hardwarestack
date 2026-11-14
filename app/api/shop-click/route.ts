import { NextRequest, NextResponse } from "next/server";
import { getPartNames } from "@/lib/hardware-queries";
import { parseShopClick } from "@/lib/shop-click-schema";
import type { ShopClickRejection } from "@/lib/shop-click-schema";
import { recordShopClick } from "@/lib/shop-click-store";

const REJECTION_STATUS: Record<ShopClickRejection, number> = {
  "too-large": 413,
  invalid: 400,
  "unknown-part": 400,
};

// Receives the beacon ShopClickTracker sends when a shop link is clicked.
export async function POST(req: NextRequest) {
  const parsed = parseShopClick(await req.text(), await getPartNames());
  if (!parsed.ok) return NextResponse.json({ error: parsed.reason }, { status: REJECTION_STATUS[parsed.reason] });
  await recordShopClick(parsed.click);
  return new NextResponse(null, { status: 204 });
}
