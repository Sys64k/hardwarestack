import { gpuIndexSource } from "@/lib/gpu-gaming-index";
import { SourceLink } from "./SourceLink";

// Where the GPU's gaming figure comes from: a credited review, or an estimate.
export function GpuGamingSource({ modelName }: { modelName: string }) {
  const source = gpuIndexSource(modelName);
  if (!source) {
    return <>The {modelName}&apos;s gaming performance is estimated from reviewed GPUs.</>;
  }
  return (
    <>
      The {modelName}&apos;s gaming performance is from <SourceLink source={source} /> ({source.resolution},{" "}
      {source.cpu}).
    </>
  );
}
