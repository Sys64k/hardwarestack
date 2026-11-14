import { prisma } from "./prisma";
import { type ShopClickRecord, utcDay } from "./shop-clicks";

// Adds one to the day's counter. A single INSERT … ON CONFLICT, so two clicks arriving
// together can't both try to create the row.
export async function recordShopClick(click: ShopClickRecord, at: Date = new Date()): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO "ShopClick" ("day", "retailer", "part", "page", "count")
    VALUES (${utcDay(at)}::date, ${click.retailer}, ${click.part}, ${click.page}, 1)
    ON CONFLICT ("day", "retailer", "part", "page")
    DO UPDATE SET "count" = "ShopClick"."count" + 1`;
}
