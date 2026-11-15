import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { withCpuGamingTier } from "@/lib/tiers";
import { CpuList } from "@/components/cpus/CpuList";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "All Desktop CPUs",
  description:
    "Browse all desktop CPUs in the HardwareStack database. Compare Intel Core and AMD Ryzen processors by tier and performance scores.",
};

export default async function CpusPage() {
  // Grouped and ordered by gaming performance, not the stored segment tier.
  const rows = await prisma.cpu.findMany();
  const cpus = withCpuGamingTier(rows);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Desktop CPUs
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {cpus.length} processors in the database. Click any CPU to see its bottleneck analysis.
        </p>
      </div>
      <CpuList cpus={cpus} />
    </main>
  );
}
