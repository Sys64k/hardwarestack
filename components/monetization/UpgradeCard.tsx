"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { planUpgrade, upgradeHeadline } from "@/lib/upgrade";
import type { UpgradeTarget } from "@/lib/upgrade";
import { UpgradeSuggestions } from "./UpgradeSuggestions";
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
        <UpgradeSuggestions plan={plan} cpu={cpu} ram={ram} />
      </CardContent>
    </Card>
  );
}
