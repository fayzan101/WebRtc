import type { StatsSample } from './types';

export type StatsSnapshot = {
  bytesSent: number;
  bytesReceived: number;
  packetsReceived: number;
  packetsLost: number;
  rttSeconds: number;
  jitterSeconds: number;
  ts: number;
};

export function emptySnapshot(ts = Date.now()): StatsSnapshot {
  return {
    bytesSent: 0,
    bytesReceived: 0,
    packetsReceived: 0,
    packetsLost: 0,
    rttSeconds: 0,
    jitterSeconds: 0,
    ts,
  };
}

export function bitrateBps(
  bytesNow: number,
  bytesPrev: number,
  tsNow: number,
  tsPrev: number,
): number {
  const dt = (tsNow - tsPrev) / 1000;
  if (dt <= 0) return 0;
  const delta = Math.max(0, bytesNow - bytesPrev);
  return (delta * 8) / dt;
}

export function lossRatio(
  packetsLostDelta: number,
  packetsReceivedDelta: number,
): number {
  const lost = Math.max(0, packetsLostDelta);
  const received = Math.max(0, packetsReceivedDelta);
  const total = lost + received;
  if (total <= 0) return 0;
  return lost / total;
}

export function sampleFromSnapshots(
  prev: StatsSnapshot,
  next: StatsSnapshot,
  remoteCount: number,
  pcCount: number,
): StatsSample {
  const packetsLostDelta = next.packetsLost - prev.packetsLost;
  const packetsReceivedDelta = next.packetsReceived - prev.packetsReceived;

  return {
    ts: next.ts,
    remoteCount,
    uplinkBitrateBps: bitrateBps(next.bytesSent, prev.bytesSent, next.ts, prev.ts),
    downlinkBitrateBps: bitrateBps(
      next.bytesReceived,
      prev.bytesReceived,
      next.ts,
      prev.ts,
    ),
    rttMs: next.rttSeconds * 1000,
    jitterMs: next.jitterSeconds * 1000,
    lossRatio: lossRatio(packetsLostDelta, packetsReceivedDelta),
    bytesSent: next.bytesSent,
    bytesReceived: next.bytesReceived,
    pcCount,
  };
}

/** Aggregate RTCStatsReport-like entries into a snapshot. */
export function aggregateReports(
  reports: Iterable<RTCStatsReport>,
  ts = Date.now(),
): StatsSnapshot {
  let bytesSent = 0;
  let bytesReceived = 0;
  let packetsReceived = 0;
  let packetsLost = 0;
  let rttSeconds = 0;
  let jitterSeconds = 0;
  let rttSamples = 0;
  let jitterSamples = 0;

  for (const report of reports) {
    report.forEach((stat) => {
      if (stat.type === 'outbound-rtp' && 'bytesSent' in stat) {
        const media = (stat as RTCOutboundRtpStreamStats).kind
          ?? (stat as { mediaType?: string }).mediaType;
        if (media === 'audio' || media === 'video' || media == null) {
          bytesSent += Number((stat as RTCOutboundRtpStreamStats).bytesSent ?? 0);
        }
      }
      if (stat.type === 'inbound-rtp' && 'bytesReceived' in stat) {
        const inbound = stat as RTCInboundRtpStreamStats;
        bytesReceived += Number(inbound.bytesReceived ?? 0);
        packetsReceived += Number(inbound.packetsReceived ?? 0);
        packetsLost += Number(inbound.packetsLost ?? 0);
        if (typeof inbound.jitter === 'number') {
          jitterSeconds += inbound.jitter;
          jitterSamples += 1;
        }
      }
      if (stat.type === 'candidate-pair') {
        const pair = stat as RTCIceCandidatePairStats;
        if (pair.state === 'succeeded' && typeof pair.currentRoundTripTime === 'number') {
          rttSeconds += pair.currentRoundTripTime;
          rttSamples += 1;
        }
      }
    });
  }

  return {
    bytesSent,
    bytesReceived,
    packetsReceived,
    packetsLost,
    rttSeconds: rttSamples ? rttSeconds / rttSamples : 0,
    jitterSeconds: jitterSamples ? jitterSeconds / jitterSamples : 0,
    ts,
  };
}

export async function collectPeerConnectionStats(
  pcs: Iterable<RTCPeerConnection>,
  ts = Date.now(),
): Promise<StatsSnapshot> {
  const reports: RTCStatsReport[] = [];
  for (const pc of pcs) {
    if (pc.connectionState === 'closed') continue;
    try {
      reports.push(await pc.getStats());
    } catch {
      // ignore closed/failing PCs
    }
  }
  return aggregateReports(reports, ts);
}
