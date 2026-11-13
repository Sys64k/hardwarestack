import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCpus, getGpus, getRams } from "@/lib/hardware-queries";
import { hasScores, pairPath, pairSummary, parsePairSlug, relatedCpus, relatedGpus } from "@/lib/pair-pages";
import { hasAffiliateTag } from "@/lib/shopping-links";
import { SITE_URL } from "@/lib/site";
import { toSlug } from "@/lib/slug";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { BottleneckBadge } from "@/components/detail/BottleneckBadge";
import { CpuGamingSource } from "@/components/detail/CpuGamingSource";
import { ShopLink } from "@/components/monetization/ShopLink";
import { UpgradeCard } from "@/components/monetization/UpgradeCard";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ pair: string }>;
}

async function findPair(slug: string) {
  const [cpus, gpus] = await Promise.all([getCpus(), getGpus()]);
  const match = parsePairSlug(slug, cpus, gpus);
  if (!match || !hasScores(match.cpu, match.gpu)) return null;
  return { ...match, cpus, gpus };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pair } = await params;
  const found = await findPair(pair);
  if (!found) return {};
  const { cpu, gpu } = found;
  const { verdict, best } = pairSummary(cpu, gpu);
  const title = `${cpu.modelName} + ${gpu.modelName} Bottleneck`;
  const description = `Does the ${cpu.modelName} bottleneck the ${gpu.modelName}? ${verdict} Best resolution: ${best}.`;
  const url = `${SITE_URL}${pairPath(cpu.modelName, gpu.modelName)}`;
  return {
    title,
    description,
    keywords: [
      `${cpu.modelName} ${gpu.modelName} bottleneck`,
      `${cpu.modelName} with ${gpu.modelName}`,
      `will ${cpu.modelName} bottleneck ${gpu.modelName}`,
    ],
    alternates: { canonical: url },
    openGraph: { title: `${title} — HardwareStack`, description, url, type: "website" },
  };
}

export default async function PairPage({ params }: Props) {
  const { pair } = await params;
  const [found, rams] = await Promise.all([findPair(pair), getRams()]);
  if (!found) notFound();
  const { cpu, gpu, cpus, gpus } = found;

  const { results, best, worst, verdict } = pairSummary(cpu, gpu);
  const otherGpus = relatedGpus(cpu, gpu, gpus);
  const otherCpus = relatedCpus(cpu, gpu, cpus);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-12">
      <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
        <Link href="/" className="hover:text-slate-600">
          Home
        </Link>
        <span>/</span>
        <Link href={`/cpu/${toSlug(cpu.modelName)}`} className="hover:text-slate-600">
          {cpu.modelName}
        </Link>
        <span>/</span>
        <span className="text-slate-600">{gpu.modelName}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {cpu.modelName} + {gpu.modelName} Bottleneck
            </h1>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              {verdict} The best resolution for this pair is{" "}
              <span className="font-semibold text-slate-900">{best}</span>.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Bottleneck by resolution
              </h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-2 text-left">Resolution</th>
                  <th className="px-4 py-2 text-right">CPU Load</th>
                  <th className="px-4 py-2 text-right">GPU Load</th>
                  <th className="px-4 py-2 text-right">Imbalance</th>
                  <th className="px-4 py-2 text-right">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map(({ resolution, result }) => (
                  <tr key={resolution}>
                    <td className="px-4 py-3 font-medium text-slate-800">{resolution}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{result.cpuUtilization}%</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{result.gpuUtilization}%</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                      {Math.round(result.bottleneckPercentage)}%
                    </td>
                    <td className="px-4 py-3 text-right">
                      <BottleneckBadge component={result.bottleneckComponent} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-4 py-2.5 border-t border-slate-100 text-[11px] text-slate-400">
              Imbalances under 10% count as balanced. Assumes fast dual-channel RAM; add your RAM kit in the
              calculator for a tailored result. <CpuGamingSource modelName={cpu.modelName} />
            </p>
          </div>

          {worst && (
            <UpgradeCard
              bottleneckComponent={worst.component}
              cpu={cpu}
              gpu={gpu}
              cpus={cpus}
              gpus={gpus}
              rams={rams}
              resolution={worst.resolution}
            />
          )}

          {(otherGpus.length > 0 || otherCpus.length > 0) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {otherGpus.length > 0 && (
                <RelatedList
                  title={`Other GPUs with the ${cpu.modelName}`}
                  links={otherGpus.map((g) => ({ href: pairPath(cpu.modelName, g.modelName), label: g.modelName }))}
                />
              )}
              {otherCpus.length > 0 && (
                <RelatedList
                  title={`Other CPUs with the ${gpu.modelName}`}
                  links={otherCpus.map((c) => ({ href: pairPath(c.modelName, gpu.modelName), label: c.modelName }))}
                />
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5 flex flex-col gap-3">
            <p className="text-sm font-semibold text-slate-800">Fine-tune this build</p>
            <p className="text-xs text-slate-500">
              Open the calculator with this pair preselected to add your RAM and see the data flow.
            </p>
            <Link
              href={`/?cpuId=${cpu.id}&gpuId=${gpu.id}`}
              className={cn(
                buttonVariants({ variant: "default", size: "sm" }),
                "bg-slate-900 hover:bg-slate-700 no-underline"
              )}
            >
              Open Calculator
            </Link>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 flex flex-col gap-3">
            <p className="text-sm font-semibold text-slate-800">Components</p>
            {[
              { href: `/cpu/${toSlug(cpu.modelName)}`, name: cpu.modelName, kind: "CPU" },
              { href: `/gpu/${toSlug(gpu.modelName)}`, name: gpu.modelName, kind: "GPU" },
            ].map((part) => (
              <div key={part.href} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">{part.kind}</p>
                  <Link href={part.href} className="text-sm font-medium text-slate-800 hover:text-slate-600">
                    {part.name}
                  </Link>
                </div>
                <ShopLink modelName={part.name} />
              </div>
            ))}
            {hasAffiliateTag() && (
              <p className="text-[10px] uppercase tracking-wide text-slate-400">Affiliate Partner</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function RelatedList({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      </div>
      <ul className="divide-y divide-slate-100">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="block px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
