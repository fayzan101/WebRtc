import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import { formatTrial, nextTrialNumber, resolveRunPath, runFileName } from '../src/paths.js';

describe('paths', () => {
  it('formats trial and file names', () => {
    assert.equal(formatTrial(1), '001');
    assert.equal(formatTrial('12'), '012');
    assert.equal(runFileName({ n: 4, cap: '1Mbps', trial: '002' }), 'n4-1Mbps-002.json');
    assert.equal(
      resolveRunPath('results', 'mesh', { n: 2, cap: 'uncapped', trial: '001' }),
      path.join('results', 'mesh', 'n2-uncapped-001.json'),
    );
  });

  it('nextTrialNumber picks max+1', () => {
    const fsApi = {
      readdirSync: () => [
        'n4-uncapped-001.json',
        'n4-uncapped-003.json',
        'n4-1Mbps-001.json',
        'readme.txt',
      ],
    };
    assert.equal(nextTrialNumber('/tmp/mesh', 4, 'uncapped', fsApi), 4);
    assert.equal(nextTrialNumber('/tmp/mesh', 4, '1Mbps', fsApi), 2);
    assert.equal(nextTrialNumber('/tmp/mesh', 2, 'uncapped', fsApi), 1);
  });

  it('nextTrialNumber treats missing dir as 1', () => {
    const fsApi = {
      readdirSync: () => {
        const err = new Error('missing');
        err.code = 'ENOENT';
        throw err;
      },
    };
    assert.equal(nextTrialNumber('/missing', 2, 'uncapped', fsApi), 1);
  });
});
