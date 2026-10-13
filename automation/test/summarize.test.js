import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aggregateRun,
  formatMarkdownTables,
  rowsToCsv,
  sanityWarnings,
  steadySamples,
  summarizeRuns,
  trialFromFileName,
} from '../src/summarize.js';

function sample(ts, uplinkBitrateBps, extra = {}) {
  return {
    ts,
    remoteCount: 1,
    uplinkBitrateBps,
    downlinkBitrateBps: uplinkBitrateBps,
    rttMs: 10,
    jitterMs: 2,
    lossRatio: 0.001,
    cpuPercent: 25,
    bytesSent: 1000,
    bytesReceived: 2000,
    ...extra,
  };
}

function runDoc({ mode, n, uplink, trial = '001', sfuCpu = null }) {
  const t0 = 1_000_000;
  const samples = [
    sample(t0, uplink * 0.5),
    sample(t0 + 12_000, uplink),
    sample(t0 + 14_000, uplink),
  ];
  return {
    schemaVersion: 1,
    mode,
    n,
    uplinkCap: 'uncapped',
    trial,
    joinTimeMs: 1000 + n * 100,
    notes: `Phase 6 fixture trial ${trial}`,
    participants: Array.from({ length: n }, (_, i) => ({
      peerId: `p${i + 1}`,
      role: i === 0 ? 'capped' : 'uncapped',
      samples,
    })),
    sfu: {
      pid: sfuCpu == null ? 0 : 9,
      samples:
        sfuCpu == null
          ? []
          : [
              { ts: t0, cpuPercent: sfuCpu },
              { ts: t0 + 12_000, cpuPercent: sfuCpu },
            ],
    },
  };
}

describe('summarize', () => {
  it('steadySamples drops first 10s', () => {
    const samples = [sample(0, 1), sample(5000, 2), sample(11_000, 3)];
    const steady = steadySamples(samples, 10_000);
    assert.equal(steady.length, 1);
    assert.equal(steady[0].uplinkBitrateBps, 3);
  });

  it('trialFromFileName parses result names', () => {
    assert.equal(trialFromFileName('n4-uncapped-002.json'), '002');
    assert.equal(trialFromFileName('n6-1Mbps-010.json'), '010');
  });

  it('aggregateRun averages steady-state participant means', () => {
    const row = aggregateRun(runDoc({ mode: 'mesh', n: 2, uplink: 40_000 }));
    assert.equal(row.mode, 'mesh');
    assert.equal(row.n, 2);
    assert.ok(Math.abs(row.uplinkKbpsMean - 40) < 0.01);
    assert.equal(row.trial, '001');
  });

  it('rowsToCsv matches schema header', () => {
    const rows = summarizeRuns([
      runDoc({ mode: 'mesh', n: 2, uplink: 40_000 }),
      runDoc({ mode: 'sfu', n: 2, uplink: 43_000, sfuCpu: 10 }),
    ]);
    const csv = rowsToCsv(rows);
    assert.match(csv, /^mode,n,uplinkCap,trial,/);
    assert.match(csv, /mesh,2,uncapped,001,/);
    assert.match(csv, /sfu,2,uncapped,001,/);
    assert.match(csv, /,10\.00,/); // cpuSfuMean
  });

  it('formatMarkdownTables includes metric sections', () => {
    const rows = summarizeRuns([runDoc({ mode: 'mesh', n: 2, uplink: 40_000 })]);
    const md = formatMarkdownTables(rows);
    assert.match(md, /Uplink \/ downlink/);
    assert.match(md, /\| mesh \| 2 \|/);
  });

  it('sanityWarnings flags inverted mesh / steep SFU', () => {
    const bad = summarizeRuns([
      runDoc({ mode: 'mesh', n: 2, uplink: 200_000 }),
      runDoc({ mode: 'mesh', n: 6, uplink: 40_000 }),
      runDoc({ mode: 'sfu', n: 2, uplink: 40_000 }),
      runDoc({ mode: 'sfu', n: 6, uplink: 200_000 }),
    ]);
    const warnings = sanityWarnings(bad);
    assert.ok(warnings.some((w) => /Mesh uplink did not rise/.test(w)));
    assert.ok(warnings.some((w) => /SFU uplink not roughly flat/.test(w)));
  });

  it('sanityWarnings silent for expected trends', () => {
    const good = summarizeRuns([
      runDoc({ mode: 'mesh', n: 2, uplink: 40_000 }),
      runDoc({ mode: 'mesh', n: 6, uplink: 200_000 }),
      runDoc({ mode: 'sfu', n: 2, uplink: 43_000 }),
      runDoc({ mode: 'sfu', n: 6, uplink: 44_000 }),
    ]);
    assert.deepEqual(sanityWarnings(good), []);
  });
});
