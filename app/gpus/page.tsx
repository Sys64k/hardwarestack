import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { withGpuGamingTier } from "@/lib/tiers";
import { GpuList } from "@/components/gpus/GpuList";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "All Desktop GPUs",
  description:
    "Browse all discrete desktop GPUs in the HardwareStack database. Compare NVIDIA GeForce and AMD Radeon graphics cards by tier and performance scores.",
};

export default async function GpusPage() {
  // Grouped and ordered by gaming performance, not the stored segment tier.
  const rows = await prisma.gpu.findMany();
  const gpus = withGpuGamingTier(rows);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Desktop GPUs
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {gpus.length} graphics cards in the database. Click any GPU to see its bottleneck analysis.
        </p>
      </div>
      <GpuList gpus={gpus} />
    </main>
  );
}
