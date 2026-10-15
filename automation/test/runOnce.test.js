import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import { executeRun } from '../src/runOnce.js';
import { expectedMinSamples } from '../src/schema.js';

function makeSample(i) {
  return {
    ts: 1_000_000 + i * 2000,
    remoteCount: 1,
    uplinkBitrateBps: 30_000 + i,
    downlinkBitrateBps: 29_000 + i,
    rttMs: 12,
    jitterMs: 3,
    lossRatio: 0.001,
    cpuPercent: 20,
    bytesSent: 1000 * (i + 1),
    bytesReceived: 2000 * (i + 1),
  };
}

describe('executeRun', () => {
  it('writes a valid schema-v1 JSON and always closes browsers', async () => {
    const written = [];
    const closed = [];
    const durationSec = 6;
    const sampleIntervalMs = 2000;
    const min = expectedMinSamples(durationSec, sampleIntervalMs);
    const sampleCount = Math.max(min, 3);

    const result = await executeRun(
      {
        mode: 'mesh',
        n: 2,
        durationSec,
        cap: 'uncapped',
        outDir: path.join('tmp-test-results'),
        roomId: 'project23',
        sampleIntervalMs,
        joinTimeoutMs: 5000,
        trial: '001',
        headless: true,
      },
      {
        launch: async () => ({
          browsers: [{ id: 'b1' }, { id: 'b2' }],
          pages: [
            { peerId: 'p1', page: {}, browserPid: 11 },
            { peerId: 'p2', page: {}, browserPid: 22 },
          ],
          peerIds: ['p1', 'p2'],
          chromiumVersion: 'Chrome/test',
        }),
        collect: async () => ({
          joinTimeMs: 1111,
          participants: [
            {
              peerId: 'p1',
              samples: Array.from({ length: sampleCount }, (_, i) => makeSample(i)),
            },
            {
              peerId: 'p2',
              samples: Array.from({ length: sampleCount }, (_, i) => makeSample(i + 10)),
            },
          ],
          sfuSamples: [],
        }),
        close: async (browsers) => {
          closed.push(...browsers);
        },
        createSampler: () => ({
          sample: async () => ({ byPid: {}, sfuCpuPercent: null }),
        }),
        writeFileSync: (file, body) => {
          written.push({ file, body });
        },
        mkdirSync: () => {},
        readdirSync: () => [],
        now: () => Date.parse('2026-10-10T12:00:00.000Z'),
        applyCap: async () => ({ applied: false, note: '' }),
        clearCap: async () => ({ cleared: false }),
      },
    );

    assert.equal(result.trial, '001');
    assert.ok(result.outPath.endsWith(path.join('mesh', 'n2-uncapped-001.json')));
    assert.equal(written.length, 1);
    const doc = JSON.parse(written[0].body);
    assert.equal(doc.schemaVersion, 1);
    assert.equal(doc.runId, 'M2-U');
    assert.equal(doc.participants.length, 2);
    assert.equal(doc.joinTimeMs, 1111);
    assert.deepEqual(closed.map((b) => b.id), ['b1', 'b2']);
  });

  it('closes browsers when collect fails', async () => {
    const closed = [];
    await assert.rejects(
      () =>
        executeRun(
          {
            mode: 'sfu',
            n: 2,
            durationSec: 4,
            cap: 'uncapped',
            outDir: 'tmp-test-results',
            roomId: 'project23',
            sampleIntervalMs: 2000,
            joinTimeoutMs: 1000,
            trial: '1',
            headless: true,
          },
          {
            launch: async () => ({
              browsers: [{ id: 'x' }],
              pages: [{ peerId: 'p1', page: {}, browserPid: 1 }],
              peerIds: ['p1', 'p2'],
              chromiumVersion: 'Chrome/test',
            }),
            collect: async () => {
              throw new Error('stats boom');
            },
            close: async (browsers) => {
              closed.push(...browsers);
            },
            createSampler: () => ({ sample: async () => ({ byPid: {} }) }),
            writeFileSync: () => {
              throw new Error('should not write');
            },
            mkdirSync: () => {},
            readdirSync: () => [],
            applyCap: async () => ({ applied: false, note: '' }),
            clearCap: async () => ({ cleared: false }),
          },
        ),
      /stats boom/,
    );
    assert.deepEqual(closed.map((b) => b.id), ['x']);
  });

  it('applies tc before launch and clears in finally', async () => {
    const ops = [];
    await executeRun(
      {
        mode: 'mesh',
        n: 2,
        durationSec: 6,
        cap: '1Mbps',
        outDir: 'tmp-test-results',
        roomId: 'project23',
        sampleIntervalMs: 2000,
        joinTimeoutMs: 1000,
        trial: '1',
        headless: true,
        tcIface: 'eth0',
        cappedPeer: 'p1',
      },
      {
        launch: async () => {
          ops.push('launch');
          return {
            browsers: [{ id: 'b' }],
            pages: [
              { peerId: 'p1', page: {}, browserPid: 1 },
              { peerId: 'p2', page: {}, browserPid: 2 },
            ],
            peerIds: ['p1', 'p2'],
            chromiumVersion: 'Chrome/test',
          };
        },
        collect: async () => ({
          joinTimeMs: 1,
          participants: [
            {
              peerId: 'p1',
              samples: Array.from({ length: 3 }, (_, i) => makeSample(i)),
            },
            {
              peerId: 'p2',
              samples: Array.from({ length: 3 }, (_, i) => makeSample(i)),
            },
          ],
          sfuSamples: [],
        }),
        close: async () => {
          ops.push('close');
        },
        createSampler: () => ({ sample: async () => ({ byPid: {} }) }),
        writeFileSync: () => {},
        mkdirSync: () => {},
        readdirSync: () => [],
        applyCap: async () => {
          ops.push('apply');
          return { applied: true, note: 'tc applied on eth0 rate=1mbit' };
        },
        clearCap: async () => {
          ops.push('clear');
          return { cleared: true };
        },
      },
    );
    assert.deepEqual(ops, ['apply', 'launch', 'close', 'clear']);
  });
});
