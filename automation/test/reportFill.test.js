import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildFilledReport,
  markdownMetricTable,
  parseFailureTable,
} from '../src/reportFill.js';

const rows = [
  {
    mode: 'mesh',
    n: 2,
    uplinkCap: 'uncapped',
    trial: '001',
    uplinkKbpsMean: 41.44,
    downlinkKbpsMean: 39.2,
    rttMsMean: 11,
    jitterMsMean: 2.6,
    lossMean: 0.002,
    cpuClientMean: 32.4,
    cpuSfuMean: null,
    joinTimeMs: 1260,
  },
  {
    mode: 'mesh',
    n: 6,
    uplinkCap: 'uncapped',
    trial: '001',
    uplinkKbpsMean: 201.44,
    downlinkKbpsMean: 191.2,
    rttMsMean: 15.8,
    jitterMsMean: 3.8,
    lossMean: 0.012,
    cpuClientMean: 56.4,
    cpuSfuMean: null,
    joinTimeMs: 1980,
  },
  {
    mode: 'sfu',
    n: 2,
    uplinkCap: 'uncapped',
    trial: '001',
    uplinkKbpsMean: 43.44,
    downlinkKbpsMean: 41.2,
    rttMsMean: 10.48,
    jitterMsMean: 2.6,
    lossMean: 0.002,
    cpuClientMean: 19.2,
    cpuSfuMean: 10,
    joinTimeMs: 880,
  },
  {
    mode: 'sfu',
    n: 6,
    uplinkCap: 'uncapped',
    trial: '001',
    uplinkKbpsMean: 43.44,
    downlinkKbpsMean: 201.2,
    rttMsMean: 10.48,
    jitterMsMean: 3.8,
    lossMean: 0.002,
    cpuClientMean: 27.2,
    cpuSfuMean: 14,
    joinTimeMs: 1240,
  },
];

describe('reportFill', () => {
  it('markdownMetricTable includes measured values', () => {
    const md = markdownMetricTable(rows, 'uncapped');
    assert.match(md, /\| mesh \| 6 \| 201\.44 \|/);
    assert.match(md, /\| sfu \| 2 \| 43\.44 \|/);
  });

  it('parseFailureTable reads detector rows', () => {
    const md = `| mode | cap | status | failure N | notes |
| --- | --- | --- | --- | --- |
| mesh | 1Mbps | failed | 4 | mean loss 8% |
| sfu | 1Mbps | no-failure-observed | — | — |
`;
    const map = parseFailureTable(md);
    assert.equal(map['mesh:1Mbps'].failureN, '4');
    assert.equal(map['sfu:1Mbps'].status, 'no-failure-observed');
  });

  it('buildFilledReport embeds figures and appendix commands', () => {
    const report = buildFilledReport({
      rows,
      failureMd: `| mode | cap | status | failure N | notes |
| --- | --- | --- | --- | --- |
| mesh | 1Mbps | failed | 4 | loss |
`,
      authors: 'Test Author',
    });
    assert.match(report, /Test Author/);
    assert.match(report, /figures\/uplink-vs-n\.svg/);
    assert.match(report, /201\.4/);
    assert.match(report, /npm run matrix/);
    assert.match(report, /tc-uplink\.sh/);
    assert.match(report, /\| 1 Mbps \| 4 \(failed\) \|/);
  });
});
