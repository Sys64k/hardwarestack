import { describePlan, type UpgradePlan } from "@/lib/upgrade";
import type { CpuOption, RamOption } from "@/types/hardware";
import { ShopButton } from "./ShopButton";

interface UpgradeSuggestionsProps {
  plan: UpgradePlan;
  cpu: CpuOption;
  ram?: RamOption;
}

// The parts an upgrade plan suggests, one row each with how it fits and a shop button.
export function UpgradeSuggestions({ plan, cpu, ram }: UpgradeSuggestionsProps) {
  return describePlan(plan, cpu, ram).map((s) => (
    <div
      key={s.modelName}
      className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-md border border-slate-100 bg-slate-50 p-3"
    >
      <div className="flex-1 min-w-0">
        {s.label && <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{s.label}</p>}
        <p className="text-sm font-medium text-slate-800 truncate">{s.modelName}</p>
        {s.note && <p className="text-xs text-slate-500">{s.note}</p>}
      </div>
      <ShopButton modelName={s.modelName} />
    </div>
  ));
}
