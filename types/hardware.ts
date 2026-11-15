export type Resolution = "1080p" | "1440p" | "4K";

export type VendorType = "AMD" | "INTEL" | "NVIDIA";

export type TierType = "ENTRY" | "MID" | "HIGH" | "ULTRA" | "ENTHUSIAST";

export type RamTypeValue = "DDR4" | "DDR5";

export interface CpuOption {
  id: string;
  vendor: VendorType;
  modelName: string;
  tier: TierType;
  socket: string | null;
  cores: number;
  threads: number;
  boostClockGhz: number;
  singleCoreScore: number | null;
}

export interface GpuOption {
  id: string;
  vendor: VendorType;
  modelName: string;
  tier: TierType;
  vramGb: number;
  memoryBandwidthGbs: number | null;
  rasterScore: number | null;
}

export interface RamOption {
  id: string;
  modelName: string;
  type: RamTypeValue;
  speedMhz: number;
  capacityGb: number;
  channels: number;
  latencyCl: number | null;
  tier: TierType;
}

export type BottleneckComponent = "CPU" | "GPU" | "RAM" | "Balanced";

export interface BottleneckResult {
  cpuUtilization: number;
  gpuUtilization: number;
  ramUtilization: number;
  bottleneckComponent: BottleneckComponent;
  bottleneckPercentage: number;
}
