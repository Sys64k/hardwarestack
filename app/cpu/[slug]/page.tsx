import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { toSlug } from "@/lib/slug";
import { TIER_COLORS, TIER_LABELS, byGpuGamingScore, cpuGamingTier, gpuGamingTier, tierRepresentatives } from "@/lib/tiers";
import { isSuggestedGpu } from "@/lib/upgrade";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AFFILIATE_REL, buildAmazonSearchUrl } from "@/lib/shopping-links";
import type { CpuOption, GpuOption } from "@/types/hardware";
import { CpuPairingTable } from "@/components/detail/CpuPairingTable";

export const dynamic = "force-dynamic";

function pcPartPickerUrl(name: string) {
  const q = name.replace("Intel Core ", "").replace(/AMD Ryzen \d+ /, "").replace("AMD Ryzen ", "");
  return `https://pcpartpicker.com/search/?q=${encodeURIComponent(q)}`;
}
function googleShoppingUrl(name: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(name)}&tbm=shop`;
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const allCpus = await prisma.cpu.findMany({ select: { modelName: true } });
  const match = allCpus.find((c) => toSlug(c.modelName) === slug);
  if (!match) return {};
  return {
    title: `${match.modelName} Bottleneck Test & Specs`,
    description: `Check ${match.modelName} bottleneck analysis, GPU compatibility, and specs. Find the best GPU pairing for the ${match.modelName}.`,
    keywords: [
      `${match.modelName} bottleneck`,
      `${match.modelName} GPU pairing`,
      `${match.modelName} specs`,
      `${match.modelName} bottleneck calculator`,
    ],
  };
}

export default async function CpuDetailPage({ params }: Props) {
  const { slug } = await params;

  const [allCpus, allGpus] = await Promise.all([
    prisma.cpu.findMany(),
    prisma.gpu.findMany(),
  ]);

  const cpu = allCpus.find((c) => toSlug(c.modelName) === slug);
  if (!cpu) notFound();
  const amazonUrl = buildAmazonSearchUrl(cpu.modelName);

  // The fastest current GPU in each gaming tier, for the pairing table. Only GPUs still sold
  // new (isSuggestedGpu); CPUs on the GPU page aren't filtered, there's no such list for them.
  const pairingGpus = tierRepresentatives(
    byGpuGamingScore(allGpus).filter((g) => isSuggestedGpu(g.modelName)),
    gpuGamingTier
  );
  const tier = cpuGamingTier(cpu);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-12">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1.5 text-xs text-slate-400">
        <Link href="/" className="hover:text-slate-600">
          Home
        </Link>
        <span>/</span>
        <Link href="/cpus" className="hover:text-slate-600">
          CPUs
        </Link>
        <span>/</span>
        <span className="text-slate-600">{cpu.modelName}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Header */}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TIER_COLORS[tier]}`}
              >
                {TIER_LABELS[tier]}
              </span>
              <Badge variant="outline" className="text-xs text-slate-500">
                {cpu.vendor === "INTEL" ? "Intel" : "AMD"}
              </Badge>
              {cpu.socket && (
                <Badge variant="outline" className="text-xs text-slate-500">
                  {cpu.socket}
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {cpu.modelName}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {cpu.cores}-core {cpu.vendor === "INTEL" ? "Intel" : "AMD"}{" "}
              desktop processor with {cpu.boostClockGhz} GHz boost clock.{" "}
              {TIER_LABELS[tier]}-tier gaming performance.
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
                  ["Cores / Threads", `${cpu.cores} / ${cpu.threads}`],
                  ["Base Clock", `${cpu.baseClockGhz} GHz`],
                  ["Boost Clock", `${cpu.boostClockGhz} GHz`],
                  cpu.socket ? ["Socket", cpu.socket] : null,
                  cpu.singleCoreScore != null
                    ? ["Single-core Score", cpu.singleCoreScore.toLocaleString()]
                    : null,
                  cpu.multiCoreScore != null
                    ? ["Multi-core Score", cpu.multiCoreScore.toLocaleString()]
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
          <CpuPairingTable
            cpu={cpu as unknown as CpuOption}
            pairingGpus={pairingGpus as unknown as GpuOption[]}
          />
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          {/* CTA */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 flex flex-col gap-3">
            <p className="text-sm font-semibold text-slate-800">
              Test {cpu.modelName} in the Calculator
            </p>
            <p className="text-xs text-slate-500">
              Select your GPU and resolution to see a full bottleneck breakdown.
            </p>
            <Link
              href={`/?cpuId=${cpu.id}`}
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
              href={pcPartPickerUrl(cpu.modelName)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "no-underline")}
            >
              PCPartPicker
              <ExternalLink className="ml-1.5 h-3 w-3" />
            </a>
            <a
              href={googleShoppingUrl(cpu.modelName)}
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

          {/* All CPUs link */}
          <Link
            href="/cpus"
            className="text-xs text-slate-400 hover:text-slate-600 text-center py-1"
          >
            ← Browse all CPUs
          </Link>
        </div>
      </div>
    </main>
  );
}
