import { gamingIndexSource } from "@/lib/cpu-gaming-index";
import { SourceLink } from "./SourceLink";

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
