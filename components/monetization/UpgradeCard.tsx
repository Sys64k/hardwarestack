"use client";

import { ExternalLink } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AFFILIATE_REL, buildAmazonSearchUrl, buildGoogleShoppingUrl } from "@/lib/shopping-links";
import { describePlan, planUpgrade, upgradeHeadline } from "@/lib/upgrade";
import type { UpgradeTarget } from "@/lib/upgrade";
import type { CpuOption, GpuOption, RamOption, Resolution } from "@/types/hardware";

interface UpgradeCardProps {
  bottleneckComponent: UpgradeTarget;
  cpu: CpuOption;
  gpu: GpuOption;
  ram?: RamOption;
  cpus: CpuOption[];
  gpus: GpuOption[];
  rams: RamOption[];
  resolution: Resolution;
}

function ShopButton({ modelName }: { modelName: string }) {
  const amazonUrl = buildAmazonSearchUrl(modelName);
  return (
    <div className="flex flex-col items-start sm:items-end gap-1 shrink-0">
      <a
        href={amazonUrl ?? buildGoogleShoppingUrl(modelName)}
        target="_blank"
        rel={amazonUrl ? AFFILIATE_REL : "noopener noreferrer"}
        className={cn(buttonVariants({ variant: "default", size: "sm" }), "no-underline bg-slate-900 hover:bg-slate-700")}
      >
        {amazonUrl ? "Check price on Amazon" : "Google Shopping"}
        <ExternalLink className="ml-1.5 h-3 w-3" />
      </a>
      {amazonUrl && <p className="text-[10px] uppercase tracking-wide text-slate-400">Affiliate Partner</p>}
    </div>
  );
}

export function UpgradeCard({ bottleneckComponent, cpu, gpu, ram, cpus, gpus, rams, resolution }: UpgradeCardProps) {
  const plan = planUpgrade({ target: bottleneckComponent, cpu, gpu, ram, cpus, gpus, rams, resolution });
  if (!plan) return null;

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-800">Upgrade Recommendation</CardTitle>
        <p className="text-xs text-slate-500">{upgradeHeadline(plan, resolution)}</p>
      </CardHeader>
      <CardContent className="pt-0 flex flex-col gap-2">
        {describePlan(plan, cpu, ram).map((s) => (
          <div
            key={s.modelName}
            className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-md border border-slate-100 bg-slate-50 p-3"
          >
            <div className="flex-1 min-w-0">
              {s.label && (
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{s.label}</p>
              )}
              <p className="text-sm font-medium text-slate-800 truncate">{s.modelName}</p>
              {s.note && <p className="text-xs text-slate-500">{s.note}</p>}
            </div>
            <ShopButton modelName={s.modelName} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
