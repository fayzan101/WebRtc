import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import { parseSummarizeArgs, runSummarizeCli } from '../src/summarizeCli.js';

describe('summarizeCli', () => {
  it('parseSummarizeArgs resolves defaults under repo', () => {
    const opts = parseSummarizeArgs([]);
    assert.equal(opts.help, false);
    assert.ok(opts.resultsDir.endsWith(`${path.sep}results`));
    assert.ok(opts.outPath.includes(path.join('summary', 'bitrate-vs-n.csv')));
    assert.equal(opts.skipMs, 10_000);
  });

  it('runSummarizeCli writes CSV from injected summarize', () => {
    const written = [];
    const logs = [];
    const result = runSummarizeCli(
      {
        help: false,
        resultsDir: '/tmp/results',
        outPath: path.join('tmp', 'summary', 'bitrate-vs-n.csv'),
        skipMs: 10_000,
      },
      {
        summarize: () => ({
          rows: [
            {
              mode: 'mesh',
              n: 2,
              uplinkCap: 'uncapped',
              trial: '001',
              uplinkKbpsMean: 40,
              downlinkKbpsMean: 39,
              rttMsMean: 10,
              jitterMsMean: 2,
              lossMean: 0.001,
              cpuClientMean: 30,
              cpuSfuMean: null,
              joinTimeMs: 1200,
            },
          ],
          csv: 'mode,n\nmesh,2\n',
          markdown: '### tables',
          warnings: [],
        }),
        writeFileSync: (file, body) => written.push({ file, body }),
        mkdirSync: () => {},
        log: (m) => logs.push(String(m)),
        warn: () => {},
      },
    );

    assert.equal(written.length, 1);
    assert.equal(written[0].body, 'mode,n\nmesh,2\n');
    assert.equal(result.rows.length, 1);
    assert.ok(logs.some((l) => l.includes('Wrote 1 row')));
  });
});
