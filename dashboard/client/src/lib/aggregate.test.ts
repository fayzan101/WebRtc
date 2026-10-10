import { describe, expect, it } from 'vitest';
import {
  buildCompareSeries,
  mean,
  parseSummaryCsv,
  participantMeans,
  runAggregateMeans,
  seriesForParticipant,
  steadySamples,
} from './aggregate';
import type { RunData, Sample } from './types';

function sample(partial: Partial<Sample> & { ts: number }): Sample {
  return {
    remoteCount: 1,
    uplinkBitrateBps: 40_000,
    downlinkBitrateBps: 50_000,
    rttMs: 10,
    jitterMs: 2,
    lossRatio: 0.01,
    cpuPercent: 20,
    bytesSent: 1,
    bytesReceived: 1,
    ...partial,
  };
}

describe('steadySamples', () => {
  it('returns empty for empty input', () => {
    expect(steadySamples([])).toEqual([]);
  });

  it('skips first 10s when enough samples', () => {
    const samples = [0, 5, 10, 15, 20].map((sec) =>
      sample({ ts: 1_000_000 + sec * 1000, uplinkBitrateBps: sec * 1000 }),
    );
    const steady = steadySamples(samples);
    expect(steady[0].ts).toBe(1_000_000 + 10_000);
    expect(steady).toHaveLength(3);
  });

  it('falls back when all samples are inside ramp window', () => {
    const samples = [sample({ ts: 100 }), sample({ ts: 200 })];
    expect(steadySamples(samples, 10_000)).toHaveLength(1);
  });
});

describe('parseSummaryCsv', () => {
  it('returns empty for blank / header-only', () => {
    expect(parseSummaryCsv('')).toEqual([]);
    expect(parseSummaryCsv('mode,n,uplinkKbpsMean\n')).toEqual([]);
  });

  it('parses rows and skips bad modes', () => {
    const csv = [
      'mode,n,uplinkCap,trial,uplinkKbpsMean,downlinkKbpsMean,rttMsMean,jitterMsMean,lossMean,cpuClientMean,cpuSfuMean,joinTimeMs',
      'mesh,2,uncapped,001,80,90,10,2,0.01,20,,1200',
      'sfu,2,uncapped,001,42,80,11,2,0.01,15,10,900',
      'other,2,uncapped,001,1,1,1,1,0,1,,1',
    ].join('\n');
    const rows = parseSummaryCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].mode).toBe('mesh');
    expect(rows[0].cpuSfuMean).toBeNull();
    expect(rows[1].cpuSfuMean).toBe(10);
  });
});

describe('buildCompareSeries', () => {
  it('averages trials and leaves null gaps', () => {
    const rows = parseSummaryCsv(
      [
        'mode,n,uplinkCap,trial,uplinkKbpsMean,downlinkKbpsMean,rttMsMean,jitterMsMean,lossMean,cpuClientMean,cpuSfuMean,joinTimeMs',
        'mesh,2,uncapped,001,80,90,10,2,0,20,,1',
        'mesh,2,uncapped,002,100,90,10,2,0,20,,1',
        'sfu,4,uncapped,001,42,120,10,2,0,15,8,1',
      ].join('\n'),
    );
    const series = buildCompareSeries(rows, 'uncapped');
    expect(series.find((p) => p.n === 2)?.meshUplinkKbps).toBe(90);
    expect(series.find((p) => p.n === 2)?.sfuUplinkKbps).toBeNull();
    expect(series.find((p) => p.n === 4)?.sfuUplinkKbps).toBe(42);
  });

  it('filters by cap', () => {
    const rows = parseSummaryCsv(
      [
        'mode,n,uplinkCap,trial,uplinkKbpsMean,downlinkKbpsMean,rttMsMean,jitterMsMean,lossMean,cpuClientMean,cpuSfuMean,joinTimeMs',
        'mesh,2,1Mbps,001,30,40,10,2,0,20,,1',
        'mesh,2,uncapped,001,80,90,10,2,0,20,,1',
      ].join('\n'),
    );
    expect(buildCompareSeries(rows, '1Mbps')).toHaveLength(1);
    expect(buildCompareSeries(rows, '1Mbps')[0].meshUplinkKbps).toBe(30);
  });
});

describe('means helpers', () => {
  it('computes participant and run means', () => {
    expect(mean([])).toBe(0);
    const samples = [
      sample({ ts: 0, uplinkBitrateBps: 10_000 }),
      sample({ ts: 15_000, uplinkBitrateBps: 50_000 }),
      sample({ ts: 20_000, uplinkBitrateBps: 70_000 }),
    ];
    const m = participantMeans(samples);
    expect(m.uplinkKbps).toBeCloseTo(60, 5);

    const run: RunData = {
      schemaVersion: 1,
      runId: 'X',
      mode: 'mesh',
      n: 2,
      uplinkCap: 'uncapped',
      participants: [
        { peerId: 'p1', samples },
        {
          peerId: 'p2',
          samples: [
            sample({ ts: 0, uplinkBitrateBps: 20_000 }),
            sample({ ts: 15_000, uplinkBitrateBps: 40_000 }),
          ],
        },
      ],
    };
    expect(runAggregateMeans(run).uplinkKbps).toBeGreaterThan(0);
    expect(runAggregateMeans({ ...run, participants: [] }).uplinkKbps).toBe(0);
  });

  it('builds relative time series', () => {
    const series = seriesForParticipant([
      sample({ ts: 1000, uplinkBitrateBps: 1000 }),
      sample({ ts: 3000, uplinkBitrateBps: 2000 }),
    ]);
    expect(series[0].tSec).toBe(0);
    expect(series[1].tSec).toBe(2);
    expect(series[1].uplinkKbps).toBe(2);
  });
});
