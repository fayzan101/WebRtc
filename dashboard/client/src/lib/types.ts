export type UplinkCap = 'uncapped' | '1Mbps' | '5Mbps';
export type Mode = 'mesh' | 'sfu';

export type RunMeta = {
  id: string;
  mode: Mode;
  n: number;
  uplinkCap: string;
  trial: string;
  fileName: string;
  source: 'results' | 'fixture';
  mtimeMs: number;
};

export type Sample = {
  ts: number;
  remoteCount: number;
  uplinkBitrateBps: number;
  downlinkBitrateBps: number;
  rttMs: number;
  jitterMs: number;
  lossRatio: number;
  cpuPercent?: number;
  bytesSent: number;
  bytesReceived: number;
};

export type Participant = {
  peerId: string;
  role?: string;
  samples: Sample[];
};

export type RunData = {
  schemaVersion: number;
  runId: string;
  mode: Mode;
  n: number;
  uplinkCap: string;
  cappedPeerId?: string;
  media?: string;
  durationSec?: number;
  sampleIntervalMs?: number;
  startedAt?: string;
  endedAt?: string;
  joinTimeMs?: number;
  participants: Participant[];
  sfu?: { pid?: number; samples?: Array<{ ts: number; cpuPercent: number }> };
  notes?: string;
};

export type SummaryRow = {
  mode: Mode;
  n: number;
  uplinkCap: string;
  trial: string;
  uplinkKbpsMean: number;
  downlinkKbpsMean: number;
  rttMsMean: number;
  jitterMsMean: number;
  lossMean: number;
  cpuClientMean: number;
  cpuSfuMean: number | null;
  joinTimeMs: number;
};

export type ComparePoint = {
  n: number;
  meshUplinkKbps: number | null;
  sfuUplinkKbps: number | null;
  meshDownlinkKbps: number | null;
  sfuDownlinkKbps: number | null;
};
