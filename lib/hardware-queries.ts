import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { CpuOption, GpuOption, RamOption } from "@/types/hardware";

export const getCpus = unstable_cache(
  async (): Promise<CpuOption[]> => {
    const rows = await prisma.cpu.findMany({
      orderBy: [{ tier: "asc" }, { singleCoreScore: "desc" }],
    });
    return rows as CpuOption[];
  },
  ["cpus"],
  { tags: ["hardware"], revalidate: 86400 }
);

export const getGpus = unstable_cache(
  async (): Promise<GpuOption[]> => {
    const rows = await prisma.gpu.findMany({
      orderBy: [{ tier: "asc" }, { rasterScore: "desc" }],
    });
    return rows as GpuOption[];
  },
  ["gpus"],
  { tags: ["hardware"], revalidate: 86400 }
);

export const getRams = unstable_cache(
  async (): Promise<RamOption[]> => {
    const rows = await prisma.ram.findMany({
      orderBy: [{ type: "asc" }, { speedMhz: "asc" }],
    });
    return rows as RamOption[];
  },
  ["rams"],
  { tags: ["hardware"], revalidate: 86400 }
);

// Every CPU, GPU and RAM model name in the catalogue (from the cached queries above).
export async function getPartNames(): Promise<string[]> {
  const [cpus, gpus, rams] = await Promise.all([getCpus(), getGpus(), getRams()]);
  return [...cpus, ...gpus, ...rams].map((p) => p.modelName);
}
