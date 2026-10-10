import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { collectStats } from '../src/collectStats.js';

function mockPage(peerId, uplink) {
  return {
    peerId,
    browserPid: peerId === 'p1' ? 11 : 22,
    page: {
      async evaluate(fn) {
        const src = String(fn);
        if (src.includes('__getJoinTimeMs')) {
          return peerId === 'p1' ? 1200 : 800;
        }
        return {
          ts: 0,
          remoteCount: 1,
          uplinkBitrateBps: uplink,
          downlinkBitrateBps: uplink,
          rttMs: 10,
          jitterMs: 2,
          lossRatio: 0,
          bytesSent: 1000,
          bytesReceived: 2000,
        };
      },
    },
  };
}

describe('collectStats', () => {
  it('collects samples for each peer and tracks max join time', async () => {
    let t = 0;
    const sleeps = [];
    const result = await collectStats({
      pages: [mockPage('p1', 40_000), mockPage('p2', 41_000)],
      durationSec: 4,
      sampleIntervalMs: 2000,
      sfuPid: 9,
      now: () => t,
      sleep: async (ms) => {
        sleeps.push(ms);
        t += ms;
      },
      sampleCpu: async () => ({
        byPid: { 11: 30, 22: 28 },
        sfuCpuPercent: 5,
      }),
    });

    assert.equal(result.joinTimeMs, 1200);
    assert.equal(result.participants.length, 2);
    assert.ok(result.participants[0].samples.length >= 2);
    assert.equal(result.participants[0].samples[0].cpuPercent, 30);
    assert.equal(result.participants[0].samples[0].uplinkBitrateBps, 40_000);
    assert.ok(result.sfuSamples.length >= 1);
    assert.equal(result.sfuSamples[0].cpuPercent, 5);
    assert.ok(sleeps.every((ms) => ms > 0));
  });

  it('fails loudly when __webrtcStats is missing', async () => {
    await assert.rejects(
      () =>
        collectStats({
          pages: [
            {
              peerId: 'p1',
              browserPid: 1,
              page: {
                async evaluate(fn) {
                  if (String(fn).includes('__getJoinTimeMs')) return 1;
                  throw new Error('__webrtcStats missing');
                },
              },
            },
          ],
          durationSec: 2,
          sampleIntervalMs: 2000,
          now: () => 0,
          sleep: async () => {},
          sampleCpu: async () => ({ byPid: { 1: 1 }, sfuCpuPercent: null }),
        }),
      /stats failed for p1/,
    );
  });
});
