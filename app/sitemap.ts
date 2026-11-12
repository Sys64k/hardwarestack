import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";
import { getCpus, getGpus } from "@/lib/hardware-queries";
import { toSlug } from "@/lib/slug";
import { LLM_MODELS } from "@/lib/llm-models";
import { pairPath, sitemapPairs } from "@/lib/pair-pages";
import { SITE_URL } from "@/lib/site";
import { CODING_AGENTS_PATH } from "@/lib/coding-agents";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [cpus, gpus] = await Promise.all([getCpus(), getGpus()]);

  const cpuUrls: MetadataRoute.Sitemap = cpus.map((cpu) => ({
    url: `${SITE_URL}/cpu/${toSlug(cpu.modelName)}`,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const gpuUrls: MetadataRoute.Sitemap = gpus.map((gpu) => ({
    url: `${SITE_URL}/gpu/${toSlug(gpu.modelName)}`,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const localAiUrls: MetadataRoute.Sitemap = LLM_MODELS.map((model) => ({
    url: `${SITE_URL}/local-ai/${model.slug}`,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  localAiUrls.push({ url: `${SITE_URL}${CODING_AGENTS_PATH}`, changeFrequency: "monthly", priority: 0.8 });

  const pairUrls: MetadataRoute.Sitemap = sitemapPairs(cpus, gpus).map(({ cpu, gpu }) => ({
    url: `${SITE_URL}${pairPath(cpu.modelName, gpu.modelName)}`,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE_URL}/cpus`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/gpus`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/local-ai`, changeFrequency: "weekly", priority: 0.9 },
    ...cpuUrls,
    ...gpuUrls,
    ...localAiUrls,
    ...pairUrls,
  ];
}
