"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { toSlug } from "@/lib/slug";
import { TIERS_HIGHEST_FIRST, TIER_COLORS, TIER_LABELS, groupByTier } from "@/lib/tiers";
import type { TierType } from "@/types/hardware";

interface Cpu {
  id: string;
  modelName: string;
  gamingTier: TierType;
  cores: number;
  threads: number;
  boostClockGhz: number;
  singleCoreScore: number | null;
  multiCoreScore: number | null;
}

export function CpuList({ cpus }: { cpus: Cpu[] }) {
  const [query, setQuery] = useState("");
  const q = query.toLowerCase().trim();

  const filtered = q ? cpus.filter(c => c.modelName.toLowerCase().includes(q)) : cpus;

  const groups = groupByTier(filtered, c => c.gamingTier, TIERS_HIGHEST_FIRST);

  return (
    <div className="flex flex-col gap-6">
      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search CPUs…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full rounded-md border border-slate-200 bg-white py-2 pl-8 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none sm:max-w-xs"
        />
        {q && (
          <span className="ml-3 text-xs text-slate-400">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-slate-400">No CPUs match &ldquo;{query}&rdquo;.</p>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map(({ tier, items }) => (
            <section key={tier}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TIER_COLORS[tier]}`}>
                  {TIER_LABELS[tier]}
                </span>
                <span className="text-xs text-slate-400">{items.length} CPUs</span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs">Model</th>
                      <th className="text-right px-4 py-2.5 font-medium text-slate-500 text-xs hidden sm:table-cell">Cores</th>
                      <th className="text-right px-4 py-2.5 font-medium text-slate-500 text-xs hidden sm:table-cell">Boost</th>
                      <th className="text-right px-4 py-2.5 font-medium text-slate-500 text-xs">Single-core</th>
                      <th className="text-right px-4 py-2.5 font-medium text-slate-500 text-xs hidden md:table-cell">Multi-core</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map(cpu => (
                      <tr key={cpu.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-800">
                          <Link href={`/cpu/${toSlug(cpu.modelName)}`} className="hover:text-slate-600">
                            {cpu.modelName}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-500 hidden sm:table-cell">{cpu.cores}C / {cpu.threads}T</td>
                        <td className="px-4 py-3 text-right text-slate-500 hidden sm:table-cell">{cpu.boostClockGhz} GHz</td>
                        <td className="px-4 py-3 text-right text-slate-600 tabular-nums">{cpu.singleCoreScore?.toLocaleString() ?? "—"}</td>
                        <td className="px-4 py-3 text-right text-slate-500 tabular-nums hidden md:table-cell">{cpu.multiCoreScore?.toLocaleString() ?? "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/cpu/${toSlug(cpu.modelName)}`} className="text-xs text-slate-400 hover:text-slate-700">Test →</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
