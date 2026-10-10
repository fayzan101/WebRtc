import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildRunDocument,
  buildRunId,
  expectedMinSamples,
  normalizeSample,
  validateRunDocument,
} from '../src/schema.js';

function sample(overrides = {}) {
  return {
    ts: 1,
    remoteCount: 1,
    uplinkBitrateBps: 10,
    downlinkBitrateBps: 20,
    rttMs: 1,
    jitterMs: 1,
    lossRatio: 0,
    cpuPercent: 5,
    bytesSent: 100,
    bytesReceived: 200,
    ...overrides,
  };
}

describe('schema', () => {
  it('buildRunId encodes mode/n/cap', () => {
    assert.equal(buildRunId('mesh', 4, 'uncapped'), 'M4-U');
    assert.equal(buildRunId('sfu', 6, '1Mbps'), 'S6-1M');
    assert.equal(buildRunId('mesh', 3, '5Mbps'), 'M3-5M');
  });

  it('normalizeSample fills defaults and cpu', () => {
    const s = normalizeSample({ uplinkBitrateBps: 42 }, 12.5);
    assert.equal(s.uplinkBitrateBps, 42);
    assert.equal(s.cpuPercent, 12.5);
    assert.equal(s.remoteCount, 0);
  });

  it('buildRunDocument matches schema-v1 shape', () => {
    const doc = buildRunDocument({
      mode: 'mesh',
      n: 2,
      uplinkCap: 'uncapped',
      durationSec: 10,
      sampleIntervalMs: 2000,
      startedAt: '2026-01-01T00:00:00.000Z',
      endedAt: '2026-01-01T00:00:10.000Z',
      joinTimeMs: 900,
      chromium: 'Chrome/120',
      participants: [
        { peerId: 'p1', samples: [sample()] },
        { peerId: 'p2', samples: [sample({ remoteCount: 1 })] },
      ],
      sfuSamples: [],
      host: { os: 'test', arch: 'x64', cpuModel: 'x', singleLaptop: true },
      versions: { node: 'v20', chromium: 'Chrome/120', livekitServer: '', livekitClient: '' },
    });

    assert.equal(doc.schemaVersion, 1);
    assert.equal(doc.runId, 'M2-U');
    assert.equal(doc.participants.length, 2);
    assert.equal(doc.participants[0].role, 'capped');
    assert.equal(doc.participants[1].role, 'uncapped');
    assert.deepEqual(validateRunDocument(doc), []);
  });

  it('validateRunDocument catches missing sample fields', () => {
    const doc = buildRunDocument({
      mode: 'sfu',
      n: 2,
      uplinkCap: 'uncapped',
      durationSec: 10,
      sampleIntervalMs: 2000,
      startedAt: 't0',
      endedAt: 't1',
      joinTimeMs: 1,
      participants: [
        { peerId: 'p1', samples: [{ ts: 1 }] },
        { peerId: 'p2', samples: [sample()] },
      ],
      host: { os: 't', arch: 'x', cpuModel: '', singleLaptop: true },
      versions: { node: 'v', chromium: '', livekitServer: '', livekitClient: '' },
    });
    const errors = validateRunDocument(doc);
    assert.ok(errors.some((e) => e.includes('p1.samples[0]')));
  });

  it('expectedMinSamples uses duration/interval − 1', () => {
    assert.equal(expectedMinSamples(90, 2000), 44);
    assert.equal(expectedMinSamples(2, 2000), 0);
  });
});
