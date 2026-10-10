import os from 'node:os';
import { SCHEMA_VERSION, peerIdsForN } from '@webrtc/shared';

const SAMPLE_KEYS = [
  'ts',
  'remoteCount',
  'uplinkBitrateBps',
  'downlinkBitrateBps',
  'rttMs',
  'jitterMs',
  'lossRatio',
  'cpuPercent',
  'bytesSent',
  'bytesReceived',
];

/**
 * Compact run id, e.g. M4-1M / S6-U.
 * @param {'mesh'|'sfu'} mode
 * @param {number} n
 * @param {string} cap
 */
export function buildRunId(mode, n, cap) {
  const letter = mode === 'mesh' ? 'M' : 'S';
  const capTag =
    cap === 'uncapped' ? 'U' : cap === '1Mbps' ? '1M' : cap === '5Mbps' ? '5M' : cap;
  return `${letter}${n}-${capTag}`;
}

/**
 * @param {unknown} raw
 * @param {number} cpuPercent
 */
export function normalizeSample(raw, cpuPercent) {
  const s = raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : {};
  return {
    ts: Number(s.ts) || Date.now(),
    remoteCount: Number(s.remoteCount) || 0,
    uplinkBitrateBps: Number(s.uplinkBitrateBps) || 0,
    downlinkBitrateBps: Number(s.downlinkBitrateBps) || 0,
    rttMs: Number(s.rttMs) || 0,
    jitterMs: Number(s.jitterMs) || 0,
    lossRatio: Number(s.lossRatio) || 0,
    cpuPercent: Number.isFinite(cpuPercent) ? cpuPercent : 0,
    bytesSent: Number(s.bytesSent) || 0,
    bytesReceived: Number(s.bytesReceived) || 0,
  };
}

/**
 * @param {object} opts
 */
export function buildRunDocument(opts) {
  const {
    mode,
    n,
    uplinkCap,
    durationSec,
    sampleIntervalMs,
    startedAt,
    endedAt,
    joinTimeMs,
    participants,
    sfuSamples = [],
    sfuPid = 0,
    notes = '',
    chromium = '',
    cappedPeerId = 'p1',
    host = null,
    versions = null,
  } = opts;

  const peerIds = peerIdsForN(n);
  const byId = new Map(participants.map((p) => [p.peerId, p]));

  return {
    schemaVersion: SCHEMA_VERSION,
    runId: buildRunId(mode, n, uplinkCap),
    mode,
    n,
    uplinkCap,
    cappedPeerId,
    media: 'audio',
    durationSec,
    sampleIntervalMs,
    startedAt,
    endedAt,
    joinTimeMs: joinTimeMs ?? null,
    host: host ?? {
      os: process.platform,
      arch: process.arch,
      cpuModel: os.cpus()[0]?.model ?? '',
      singleLaptop: true,
    },
    versions: versions ?? {
      node: process.version,
      chromium,
      livekitServer: '',
      livekitClient: '',
    },
    participants: peerIds.map((peerId) => {
      const row = byId.get(peerId);
      return {
        peerId,
        role: peerId === cappedPeerId ? 'capped' : 'uncapped',
        samples: row?.samples ?? [],
      };
    }),
    sfu: {
      pid: sfuPid || 0,
      samples: sfuSamples,
    },
    notes,
  };
}

/**
 * Lightweight schema-v1 field checks (not JSON Schema).
 * @param {unknown} doc
 * @returns {string[]}
 */
export function validateRunDocument(doc) {
  const errors = [];
  if (!doc || typeof doc !== 'object') {
    return ['document must be an object'];
  }
  const d = /** @type {Record<string, any>} */ (doc);

  if (d.schemaVersion !== SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${SCHEMA_VERSION}`);
  }
  if (d.mode !== 'mesh' && d.mode !== 'sfu') {
    errors.push('mode must be mesh|sfu');
  }
  if (!Number.isInteger(d.n) || d.n < 2 || d.n > 6) {
    errors.push('n must be integer 2..6');
  }
  if (!['uncapped', '1Mbps', '5Mbps'].includes(d.uplinkCap)) {
    errors.push('uplinkCap invalid');
  }
  if (typeof d.runId !== 'string' || !d.runId) {
    errors.push('runId required');
  }
  if (!Array.isArray(d.participants) || d.participants.length !== d.n) {
    errors.push(`participants length must equal n (${d.n})`);
  } else {
    for (const p of d.participants) {
      if (!p?.peerId || !Array.isArray(p.samples)) {
        errors.push(`participant ${p?.peerId ?? '?'} missing samples`);
        continue;
      }
      for (let i = 0; i < p.samples.length; i += 1) {
        const sample = p.samples[i];
        for (const key of SAMPLE_KEYS) {
          if (!(key in sample) || typeof sample[key] !== 'number') {
            errors.push(`${p.peerId}.samples[${i}].${key} must be a number`);
            break;
          }
        }
      }
    }
  }
  if (!d.sfu || typeof d.sfu !== 'object' || !Array.isArray(d.sfu.samples)) {
    errors.push('sfu.samples must be an array');
  }
  return errors;
}

/**
 * Minimum sample count expected for a duration/interval run.
 * @param {number} durationSec
 * @param {number} sampleIntervalMs
 */
export function expectedMinSamples(durationSec, sampleIntervalMs) {
  const ticks = Math.floor((durationSec * 1000) / sampleIntervalMs);
  return Math.max(0, ticks - 1);
}
