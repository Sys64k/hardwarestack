-- CreateTable
CREATE TABLE "ShopClick" (
    "day" DATE NOT NULL,
    "retailer" TEXT NOT NULL,
    "part" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ShopClick_pkey" PRIMARY KEY ("day","retailer","part","page")
);
