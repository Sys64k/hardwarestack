import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { toSlug } from "@/lib/slug";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AFFILIATE_REL, buildAmazonSearchUrl } from "@/lib/shopping-links";
import type { CpuOption, GpuOption } from "@/types/hardware";
import { GpuPairingTable } from "@/components/detail/GpuPairingTable";
import { GpuLocalAiSection } from "@/components/local-ai/GpuLocalAiSection";

export const dynamic = "force-dynamic";

function pcPartPickerUrl(name: string) {
  const q = name.replace("NVIDIA GeForce ", "").replace("AMD Radeon ", "");
  return `https://pcpartpicker.com/search/?q=${encodeURIComponent(q)}`;
}
function googleShoppingUrl(name: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(name)}&tbm=shop`;
}

interface Props {
  params: Promise<{ slug: string }>;
}

const TIER_LABELS: Record<string, string> = {
  ENTRY: "Entry",
  MID: "Mid-Range",
  HIGH: "High-End",
  ULTRA: "Ultra",
  ENTHUSIAST: "Enthusiast",
};
const TIER_COLORS: Record<string, string> = {
  ENTRY: "bg-slate-100 text-slate-600",
  MID: "bg-blue-50 text-blue-700",
  HIGH: "bg-violet-50 text-violet-700",
  ULTRA: "bg-amber-50 text-amber-700",
  ENTHUSIAST: "bg-red-50 text-red-700",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const allGpus = await prisma.gpu.findMany({ select: { modelName: true } });
  const match = allGpus.find((g) => toSlug(g.modelName) === slug);
  if (!match) return {};
  return {
    title: `${match.modelName} Bottleneck Test & Specs`,
    description: `Check ${match.modelName} bottleneck analysis, CPU compatibility, and specs. Find the best CPU pairing for the ${match.modelName}.`,
    keywords: [
      `${match.modelName} bottleneck`,
      `${match.modelName} CPU pairing`,
      `${match.modelName} specs`,
      `${match.modelName} bottleneck calculator`,
    ],
  };
}

const TIER_ORDER = ["ENTRY", "MID", "HIGH", "ULTRA", "ENTHUSIAST"] as const;

export default async function GpuDetailPage({ params }: Props) {
  const { slug } = await params;

  const [allGpus, allCpus] = await Promise.all([
    prisma.gpu.findMany(),
    prisma.cpu.findMany({
      orderBy: { singleCoreScore: "desc" },
    }),
  ]);

  const gpu = allGpus.find((g) => toSlug(g.modelName) === slug);
  if (!gpu) notFound();
  const amazonUrl = buildAmazonSearchUrl(gpu.modelName);

  // One representative CPU per tier for pairing table
  const pairingCpus = TIER_ORDER.flatMap((tier) => {
    const best = allCpus.find((c) => c.tier === tier);
    return best ? [best] : [];
  });


  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-12">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1.5 text-xs text-slate-400">
        <Link href="/" className="hover:text-slate-600">
          Home
        </Link>
        <span>/</span>
        <Link href="/gpus" className="hover:text-slate-600">
          GPUs
        </Link>
        <span>/</span>
        <span className="text-slate-600">{gpu.modelName}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Header */}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TIER_COLORS[gpu.tier]}`}
              >
                {TIER_LABELS[gpu.tier]}
              </span>
              <Badge variant="outline" className="text-xs text-slate-500">
                {gpu.vendor}
              </Badge>
              {gpu.architecture && (
                <Badge variant="outline" className="text-xs text-slate-500">
                  {gpu.architecture}
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {gpu.modelName}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {gpu.vramGb} GB {gpu.memoryType ?? ""}{" "}
              {gpu.vendor === "NVIDIA" ? "NVIDIA" : "AMD"} graphics card.{" "}
              {TIER_LABELS[gpu.tier]}-tier performance for{" "}
              {gpu.tier === "ENTRY" || gpu.tier === "MID"
                ? "1080p gaming"
                : gpu.tier === "HIGH"
                  ? "1440p gaming"
                  : "4K gaming"}.
            </p>
          </div>

          {/* Specs */}
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Specifications
              </h2>
            </div>
            <dl className="divide-y divide-slate-100">
              {(
                [
                  ["VRAM", `${gpu.vramGb} GB`],
                  gpu.memoryType ? ["Memory Type", gpu.memoryType] : null,
                  gpu.architecture ? ["Architecture", gpu.architecture] : null,
                  gpu.rasterScore != null
                    ? ["Raster Score", gpu.rasterScore.toLocaleString()]
                    : null,
                ] as ([string, string] | null)[]
              )
                .filter((row): row is [string, string] => row !== null)
                .map(([label, value]) => (
                  <div
                    key={label as string}
                    className="flex items-center justify-between px-4 py-2.5 text-sm"
                  >
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="font-medium text-slate-800 tabular-nums">
                      {value}
                    </dd>
                  </div>
                ))}
            </dl>
          </div>

          {/* Pairing table */}
          <GpuPairingTable
            pairingCpus={pairingCpus as unknown as CpuOption[]}
            gpu={gpu as unknown as GpuOption}
          />

          <GpuLocalAiSection gpu={gpu} />
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          {/* CTA */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 flex flex-col gap-3">
            <p className="text-sm font-semibold text-slate-800">
              Test {gpu.modelName} in the Calculator
            </p>
            <p className="text-xs text-slate-500">
              Select your CPU and resolution to see a full bottleneck breakdown.
            </p>
            <Link
              href={`/?gpuId=${gpu.id}`}
              className={cn(
                buttonVariants({ variant: "default", size: "sm" }),
                "bg-slate-900 hover:bg-slate-700 no-underline"
              )}
            >
              Open Calculator
            </Link>
          </div>

          {/* Buy */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 flex flex-col gap-3">
            <p className="text-sm font-semibold text-slate-800">Find Best Price</p>
            {amazonUrl && (
              <a
                href={amazonUrl}
                target="_blank"
                rel={AFFILIATE_REL}
                className={cn(buttonVariants({ variant: "default", size: "sm" }), "no-underline bg-slate-900 hover:bg-slate-700")}
              >
                Check price on Amazon
                <ExternalLink className="ml-1.5 h-3 w-3" />
              </a>
            )}
            <a
              href={pcPartPickerUrl(gpu.modelName)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "no-underline")}
            >
              PCPartPicker
              <ExternalLink className="ml-1.5 h-3 w-3" />
            </a>
            <a
              href={googleShoppingUrl(gpu.modelName)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: amazonUrl ? "outline" : "default", size: "sm" }),
                amazonUrl ? "no-underline" : "no-underline bg-slate-900 hover:bg-slate-700"
              )}
            >
              Google Shopping
              <ExternalLink className="ml-1.5 h-3 w-3" />
            </a>
            {amazonUrl && <p className="text-[10px] uppercase tracking-wide text-slate-400">Affiliate Partner</p>}
          </div>

          {/* All GPUs link */}
          <Link
            href="/gpus"
            className="text-xs text-slate-400 hover:text-slate-600 text-center py-1"
          >
            ← Browse all GPUs
          </Link>
        </div>
      </div>
    </main>
  );
}
