import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UpgradeSuggestions } from "@/components/monetization/UpgradeSuggestions";
import { fixHeading, fixMessage, type PairFix } from "@/lib/pair-pages";
import type { CpuOption, GpuOption } from "@/types/hardware";

interface PairFixesProps {
  fixes: PairFix[];
  cpu: CpuOption;
  gpu: GpuOption;
}

// One entry per resolution (or run of resolutions) where a part is the limit. Shop links
// appear only for a part that removes the bottleneck.
export function PairFixes({ fixes, cpu, gpu }: PairFixesProps) {
  if (fixes.length === 0) return null;
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-800">How to fix it</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex flex-col gap-4">
        {fixes.map((fix) => (
          <div key={fix.resolutions.join()} className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-slate-700">{fixHeading(fix)}</p>
            <p className="text-xs text-slate-500">{fixMessage(fix, cpu, gpu)}</p>
            {fix.resolves && fix.plan && <UpgradeSuggestions plan={fix.plan} cpu={cpu} />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
