import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  detectFailurePoints,
  evaluateRunFailure,
  formatFailurePointsMd,
  meshFloorKbps,
} from '../src/failureDetect.js';

function samples({ uplinkKbps, loss, cpu = 40, count = 12 }) {
  const t0 = 1_000_000;
  return Array.from({ length: count }, (_, i) => ({
    ts: t0 + i * 2000,
    remoteCount: 3,
    uplinkBitrateBps: uplinkKbps * 1000,
    downlinkBitrateBps: uplinkKbps * 1000,
    rttMs: 20,
    jitterMs: 4,
    lossRatio: loss,
    cpuPercent: cpu,
    bytesSent: 1000 * (i + 1),
    bytesReceived: 2000 * (i + 1),
  }));
}

function run({ mode, n, cap, uplinkKbps, loss, cpu }) {
  const s = samples({ uplinkKbps, loss, cpu });
  return {
    mode,
    n,
    uplinkCap: cap,
    cappedPeerId: 'p1',
    participants: [
      { peerId: 'p1', role: 'capped', samples: s },
      ...Array.from({ length: n - 1 }, (_, i) => ({
        peerId: `p${i + 2}`,
        role: 'uncapped',
        samples: s,
      })),
    ],
  };
}

describe('failureDetect', () => {
  it('meshFloorKbps is (N-1)*25', () => {
    assert.equal(meshFloorKbps(4), 75);
    assert.equal(meshFloorKbps(2), 25);
  });

  it('flags mesh failure on high loss', () => {
    const e = evaluateRunFailure(
      run({ mode: 'mesh', n: 4, cap: '1Mbps', uplinkKbps: 100, loss: 0.08 }),
    );
    assert.equal(e.failed, true);
    assert.ok(e.reasons.some((r) => /loss/i.test(r)));
  });

  it('flags mesh failure when uplink below floor', () => {
    // N=4 floor = 75 kbps
    const e = evaluateRunFailure(
      run({ mode: 'mesh', n: 4, cap: '1Mbps', uplinkKbps: 40, loss: 0.01 }),
    );
    assert.equal(e.failed, true);
    assert.ok(e.reasons.some((r) => /mesh floor/i.test(r)));
  });

  it('marks CPU-bound inconclusive when only high CPU accompanies failure', () => {
    const analysis = detectFailurePoints([
      run({ mode: 'mesh', n: 3, cap: '1Mbps', uplinkKbps: 20, loss: 0.01, cpu: 95 }),
      run({ mode: 'sfu', n: 3, cap: '1Mbps', uplinkKbps: 40, loss: 0.01, cpu: 30 }),
    ]);
    assert.equal(analysis.points['mesh:1Mbps'].status, 'cpu-bound-inconclusive');
    assert.equal(analysis.points['mesh:1Mbps'].failureN, 3);
    assert.equal(analysis.points['sfu:1Mbps'].status, 'no-failure-observed');
  });

  it('reports smallest hard-failing N', () => {
    const analysis = detectFailurePoints([
      run({ mode: 'mesh', n: 3, cap: '1Mbps', uplinkKbps: 80, loss: 0.01 }),
      run({ mode: 'mesh', n: 4, cap: '1Mbps', uplinkKbps: 30, loss: 0.01 }),
      run({ mode: 'mesh', n: 5, cap: '1Mbps', uplinkKbps: 20, loss: 0.1 }),
      run({ mode: 'sfu', n: 4, cap: '1Mbps', uplinkKbps: 40, loss: 0.01 }),
    ]);
    assert.equal(analysis.points['mesh:1Mbps'].failureN, 4);
    assert.equal(analysis.points['mesh:1Mbps'].status, 'failed');
  });

  it('formatFailurePointsMd includes table', () => {
    const md = formatFailurePointsMd(
      detectFailurePoints([
        run({ mode: 'mesh', n: 4, cap: '1Mbps', uplinkKbps: 20, loss: 0.1 }),
      ]),
    );
    assert.match(md, /Failure points/);
    assert.match(md, /\| mesh \| 1Mbps \|/);
    assert.match(md, /failure N/);
  });
});
