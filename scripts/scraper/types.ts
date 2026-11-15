export interface RawCpuEntry {
  name: string;
  multiCoreScore: number;
  rank: number; // chart position — lower is better
}

export interface RawGpuEntry {
  name: string;
  score: number;
  rank: number; // chart position — lower is better
}

export type Tier = "ENTRY" | "MID" | "HIGH" | "ULTRA" | "ENTHUSIAST";
export type Vendor = "AMD" | "INTEL" | "NVIDIA";

export interface NormalizedCpu {
  modelName: string;
  vendor: "AMD" | "INTEL";
  cores: number;
  threads: number;
  baseClockGhz: number;
  boostClockGhz: number;
  socket: string;
  tier: Tier;
  singleCoreScore: number;  // estimated by Claude from model knowledge
  multiCoreScore: number;   // derived from PassMark score
}

export interface NormalizedGpu {
  modelName: string;
  vendor: "AMD" | "NVIDIA";
  vramGb: number;
  memoryBandwidthGbs: number; // reference-spec memory bandwidth, GB/s
  memoryType: string;
  architecture: string;
  tier: Tier;
  rasterScore: number; // derived from PassMark score
}
