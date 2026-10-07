import type { Room } from 'livekit-client';
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
  return (Math.max(0, bytesNow - bytesPrev) * 8) / dt;
}

export function lossRatio(lostDelta: number, recvDelta: number): number {
  const lost = Math.max(0, lostDelta);
  const recv = Math.max(0, recvDelta);
  const total = lost + recv;
  return total <= 0 ? 0 : lost / total;
}

export function sampleFromSnapshots(
  prev: StatsSnapshot,
  next: StatsSnapshot,
  remoteCount: number,
  pcCount: number,
): StatsSample {
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
    lossRatio: lossRatio(
      next.packetsLost - prev.packetsLost,
      next.packetsReceived - prev.packetsReceived,
    ),
    bytesSent: next.bytesSent,
    bytesReceived: next.bytesReceived,
    pcCount,
  };
}

function accumulateReport(report: RTCStatsReport, into: StatsSnapshot) {
  let jitterAdd = 0;
  let jitterN = 0;
  report.forEach((stat) => {
    if (stat.type === 'outbound-rtp' && 'bytesSent' in stat) {
      into.bytesSent += Number((stat as RTCOutboundRtpStreamStats).bytesSent ?? 0);
    }
    if (stat.type === 'inbound-rtp' && 'bytesReceived' in stat) {
      const inbound = stat as RTCInboundRtpStreamStats;
      into.bytesReceived += Number(inbound.bytesReceived ?? 0);
      into.packetsReceived += Number(inbound.packetsReceived ?? 0);
      into.packetsLost += Number(inbound.packetsLost ?? 0);
      if (typeof inbound.jitter === 'number') {
        jitterAdd += inbound.jitter;
        jitterN += 1;
      }
    }
    if (stat.type === 'candidate-pair') {
      const pair = stat as RTCIceCandidatePairStats;
      if (pair.state === 'succeeded' && typeof pair.currentRoundTripTime === 'number') {
        into.rttSeconds = Math.max(into.rttSeconds, pair.currentRoundTripTime);
      }
    }
  });
  if (jitterN > 0) {
    into.jitterSeconds += jitterAdd / jitterN;
  }
}

type StatsCapable = {
  getSenderStats?: () => Promise<RTCStatsReport | undefined>;
  getReceiverStats?: () => Promise<RTCStatsReport | undefined>;
  sender?: RTCRtpSender;
  receiver?: RTCRtpReceiver;
};

/** Collect WebRTC stats from LiveKit local + remote tracks. */
export async function collectLiveKitStats(
  room: Room,
  ts = Date.now(),
): Promise<StatsSnapshot> {
  const snap = emptySnapshot(ts);
  let jitterBuckets = 0;

  for (const pub of room.localParticipant.trackPublications.values()) {
    const track = pub.track as StatsCapable | undefined;
    if (!track) continue;
    try {
      const report =
        (await track.getSenderStats?.()) ??
        (track.sender ? await track.sender.getStats() : undefined);
      if (report) {
        const before = snap.jitterSeconds;
        accumulateReport(report, snap);
        if (snap.jitterSeconds !== before) jitterBuckets += 1;
      }
    } catch {
      // ignore
    }
  }

  for (const participant of room.remoteParticipants.values()) {
    for (const pub of participant.trackPublications.values()) {
      const track = pub.track as StatsCapable | undefined;
      if (!track) continue;
      try {
        const report =
          (await track.getReceiverStats?.()) ??
          (track.receiver ? await track.receiver.getStats() : undefined);
        if (report) {
          const before = snap.jitterSeconds;
          accumulateReport(report, snap);
          if (snap.jitterSeconds !== before) jitterBuckets += 1;
        }
      } catch {
        // ignore
      }
    }
  }

  if (jitterBuckets > 1) {
    snap.jitterSeconds /= jitterBuckets;
  }

  return snap;
}

export function countLiveKitPcs(room: Room): number {
  return room.state === 'connected' ? 1 : 0;
}
