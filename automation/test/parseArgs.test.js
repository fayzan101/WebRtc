import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseArgs } from '../src/parseArgs.js';

describe('parseArgs', () => {
  it('parses required flags with defaults', () => {
    const opts = parseArgs(['--mode', 'mesh', '--n', '4']);
    assert.equal(opts.mode, 'mesh');
    assert.equal(opts.n, 4);
    assert.equal(opts.durationSec, 90);
    assert.equal(opts.cap, 'uncapped');
    assert.equal(opts.sampleIntervalMs, 2000);
    assert.equal(opts.joinTimeoutMs, 60_000);
    assert.equal(opts.headless, true);
  });

  it('accepts sfu + capped uplink + headed', () => {
    const opts = parseArgs([
      '--mode',
      'sfu',
      '--n',
      '3',
      '--duration',
      '30',
      '--cap',
      '1Mbps',
      '--out',
      'tmp-results',
      '--interval',
      '1000',
      '--timeout',
      '15000',
      '--room',
      'lab',
      '--base-url',
      'http://127.0.0.1:5174/',
      '--trial',
      '002',
      '--audio-file',
      'tone.wav',
      '--tc-iface',
      'eth0',
      '--capped-peer',
      'p1',
      '--headed',
    ]);
    assert.equal(opts.mode, 'sfu');
    assert.equal(opts.n, 3);
    assert.equal(opts.durationSec, 30);
    assert.equal(opts.cap, '1Mbps');
    assert.equal(opts.outDir, 'tmp-results');
    assert.equal(opts.sampleIntervalMs, 1000);
    assert.equal(opts.joinTimeoutMs, 15_000);
    assert.equal(opts.roomId, 'lab');
    assert.equal(opts.baseUrl, 'http://127.0.0.1:5174/');
    assert.equal(opts.trial, '002');
    assert.equal(opts.audioFile, 'tone.wav');
    assert.equal(opts.tcIface, 'eth0');
    assert.equal(opts.cappedPeer, 'p1');
    assert.equal(opts.headless, false);
  });

  it('rejects invalid mode / n / cap', () => {
    assert.throws(() => parseArgs(['--mode', 'p2p', '--n', '2']), /mode/);
    assert.throws(() => parseArgs(['--mode', 'mesh', '--n', '1']), /--n/);
    assert.throws(() => parseArgs(['--mode', 'mesh', '--n', '4', '--cap', '2Mbps']), /--cap/);
  });
});
