import { gamingIndexSource, type GamingIndexSource } from "@/lib/cpu-gaming-index";

// Link to a review the CPU gaming figures come from.
export function SourceLink({ source }: { source: GamingIndexSource }) {
  return (
    <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">
      {source.publisher}
    </a>
  );
}

// Where the CPU's gaming figure comes from: a credited review, or an estimate.
export function CpuGamingSource({ modelName }: { modelName: string }) {
  const source = gamingIndexSource(modelName);
  if (!source) {
    return <>The {modelName}&apos;s gaming performance is estimated from reviewed CPUs.</>;
  }
  return (
    <>
      The {modelName}&apos;s gaming performance is from <SourceLink source={source} /> ({source.gpu},{" "}
      {source.resolution}).
    </>
  );
}
