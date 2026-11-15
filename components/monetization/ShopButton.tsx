import { ExternalLink } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AFFILIATE_REL, buildAmazonSearchUrl, buildGoogleShoppingUrl } from "@/lib/shopping-links";

// Prominent "where to buy" button for an upgrade suggestion: Amazon (affiliate) when tagged,
// otherwise Google Shopping.
export function ShopButton({ modelName }: { modelName: string }) {
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
