import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, before, after } from 'node:test';
import {
  buildRunCatalog,
  parseRunFileName,
  resolveRunPath,
  resolveSummaryCsv,
} from '../src/catalog.js';

describe('parseRunFileName', () => {
  it('parses mesh/sfu run names', () => {
    assert.deepEqual(parseRunFileName('/x/results/mesh/n4-1Mbps-002.json'), {
      mode: 'mesh',
      n: 4,
      uplinkCap: '1Mbps',
      trial: '002',
      fileName: 'n4-1Mbps-002.json',
    });
  });

  it('rejects bad paths', () => {
    assert.equal(parseRunFileName('/x/other/n2-uncapped-001.json'), null);
    assert.equal(parseRunFileName('/x/mesh/readme.json'), null);
  });
});

describe('catalog merge', () => {
  /** @type {string} */
  let tmp;
  /** @type {{ resultsDir: string, fixturesDir: string }} */
  let roots;

  before(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-cat-'));
    roots = {
      resultsDir: path.join(tmp, 'results'),
      fixturesDir: path.join(tmp, 'fixtures'),
    };
    fs.mkdirSync(path.join(roots.resultsDir, 'mesh'), { recursive: true });
    fs.mkdirSync(path.join(roots.fixturesDir, 'mesh'), { recursive: true });
    fs.mkdirSync(path.join(roots.fixturesDir, 'sfu'), { recursive: true });
    fs.mkdirSync(path.join(roots.fixturesDir, 'summary'), { recursive: true });

    fs.writeFileSync(
      path.join(roots.fixturesDir, 'mesh', 'n2-uncapped-001.json'),
      JSON.stringify({ schemaVersion: 1, mode: 'mesh', n: 2 }),
    );
    fs.writeFileSync(
      path.join(roots.fixturesDir, 'sfu', 'n2-uncapped-001.json'),
      JSON.stringify({ schemaVersion: 1, mode: 'sfu', n: 2 }),
    );
    fs.writeFileSync(
      path.join(roots.resultsDir, 'mesh', 'n2-uncapped-001.json'),
      JSON.stringify({ schemaVersion: 1, mode: 'mesh', n: 2, notes: 'real' }),
    );
    fs.writeFileSync(
      path.join(roots.fixturesDir, 'summary', 'bitrate-vs-n.csv'),
      'mode,n\nmesh,2\n',
    );
  });

  after(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('prefers results over fixtures for same id', () => {
    const runs = buildRunCatalog(roots);
    const mesh = runs.find((r) => r.id === 'mesh/n2-uncapped-001.json');
    assert.ok(mesh);
    assert.equal(mesh.source, 'results');
    assert.equal(runs.filter((r) => r.mode === 'sfu').length, 1);
  });

  it('resolveRunPath blocks traversal and finds files', () => {
    assert.equal(resolveRunPath(roots, '../mesh/n2-uncapped-001.json'), null);
    const hit = resolveRunPath(roots, 'mesh/n2-uncapped-001.json');
    assert.ok(hit);
    assert.equal(hit.source, 'results');
  });

  it('resolveSummaryCsv falls back to fixtures', () => {
    const csv = resolveSummaryCsv(roots);
    assert.ok(csv);
    assert.equal(csv.source, 'fixture');
  });
});
