/*
  Warnings:

  - You are about to drop the `RetailLink` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "RetailLink" DROP CONSTRAINT "RetailLink_cpuId_fkey";

-- DropForeignKey
ALTER TABLE "RetailLink" DROP CONSTRAINT "RetailLink_gpuId_fkey";

-- DropForeignKey
ALTER TABLE "RetailLink" DROP CONSTRAINT "RetailLink_ramId_fkey";

-- DropTable
DROP TABLE "RetailLink";
