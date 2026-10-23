import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildLineChartSvg,
  chartForMetric,
  parseSummaryCsv,
  seriesByMode,
  writeStandardPlots,
} from '../src/plotResults.js';

const SAMPLE_CSV = `mode,n,uplinkCap,trial,uplinkKbpsMean,downlinkKbpsMean,rttMsMean,jitterMsMean,lossMean,cpuClientMean,cpuSfuMean,joinTimeMs
mesh,2,uncapped,001,41.44,39.20,11.00,2.60,0.0020,32.40,,1260
mesh,4,uncapped,001,121.44,115.20,13.40,3.20,0.0020,44.40,,1620
mesh,6,uncapped,001,201.44,191.20,15.80,3.80,0.0120,56.40,,1980
sfu,2,uncapped,001,43.44,41.20,10.48,2.60,0.0020,19.20,10.00,880
sfu,4,uncapped,001,43.44,121.20,10.48,3.20,0.0020,23.20,12.00,1060
sfu,6,uncapped,001,43.44,201.20,10.48,3.80,0.0020,27.20,14.00,1240
`;

describe('plotResults', () => {
  it('parseSummaryCsv reads schema header', () => {
    const rows = parseSummaryCsv(SAMPLE_CSV);
    assert.equal(rows.length, 6);
    assert.equal(rows[0].mode, 'mesh');
    assert.equal(rows[0].uplinkKbpsMean, 41.44);
    assert.equal(rows[3].cpuSfuMean, 10);
  });

  it('seriesByMode groups mesh/sfu for a cap', () => {
    const g = seriesByMode(parseSummaryCsv(SAMPLE_CSV), 'uncapped');
    assert.equal(g.mesh.length, 3);
    assert.equal(g.sfu.length, 3);
    assert.equal(g.mesh[2].n, 6);
  });

  it('buildLineChartSvg emits a real SVG with paths', () => {
    const svg = buildLineChartSvg({
      title: 'Test',
      yLabel: 'kbps',
      series: [
        { name: 'mesh', color: '#00f', points: [{ x: 2, y: 40 }, { x: 4, y: 120 }] },
        { name: 'sfu', color: '#0f0', points: [{ x: 2, y: 43 }, { x: 4, y: 43 }] },
      ],
    });
    assert.match(svg, /<svg[\s\S]*<\/svg>/);
    assert.match(svg, /<path d="M/);
    assert.match(svg, /Test/);
    assert.ok(svg.length > 400);
  });

  it('writeStandardPlots writes non-empty SVGs', () => {
    const written = [];
    const rows = parseSummaryCsv(SAMPLE_CSV);
    const result = writeStandardPlots(rows, '/tmp/figures', {
      writeFileSync: (file, body) => {
        written.push({ file, body });
      },
      mkdirSync: () => {},
      cap: 'uncapped',
    });
    assert.equal(result.written.length, 5);
    assert.equal(written.length, 5);
    assert.ok(written.every((w) => w.body.includes('<svg') && w.body.length > 400));
    assert.ok(chartForMetric(result.grouped, 'uplinkKbpsMean', 'kbps', 'Uplink').includes('mesh'));
  });

  it('rejects empty series', () => {
    assert.throws(() => buildLineChartSvg({ title: 'x', yLabel: 'y', series: [] }), /series/);
  });
});
