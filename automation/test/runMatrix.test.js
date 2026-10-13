import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildMatrixPlan,
  executeMatrix,
  parseMatrixArgs,
} from '../src/runMatrix.js';

describe('runMatrix', () => {
  it('parseMatrixArgs defaults to full uncapped grid', () => {
    const opts = parseMatrixArgs([]);
    assert.deepEqual(opts.modes, ['mesh', 'sfu']);
    assert.deepEqual(opts.ns, [2, 3, 4, 5, 6]);
    assert.equal(opts.trials, 1);
    assert.equal(opts.cap, 'uncapped');
    assert.equal(opts.cooldownSec, 15);
    assert.equal(opts.dryRun, false);
  });

  it('parseMatrixArgs accepts subset + dry-run', () => {
    const opts = parseMatrixArgs([
      '--modes',
      'mesh',
      '--n',
      '2,3',
      '--trials',
      '2',
      '--cooldown',
      '0',
      '--dry-run',
    ]);
    assert.deepEqual(opts.modes, ['mesh']);
    assert.deepEqual(opts.ns, [2, 3]);
    assert.equal(opts.trials, 2);
    assert.equal(opts.cooldownSec, 0);
    assert.equal(opts.dryRun, true);
  });

  it('buildMatrixPlan orders mode × N × trial', () => {
    const plan = buildMatrixPlan({
      modes: ['mesh', 'sfu'],
      ns: [2, 3],
      trials: 1,
      roomPrefix: 'lab',
    });
    assert.equal(plan.length, 4);
    assert.equal(plan[0].mode, 'mesh');
    assert.equal(plan[0].n, 2);
    assert.equal(plan[0].roomId, 'lab-mesh-n2-t001');
    assert.equal(plan[3].mode, 'sfu');
    assert.equal(plan[3].n, 3);
  });

  it('executeMatrix dry-run does not invoke runOnce', async () => {
    let called = 0;
    const outcome = await executeMatrix(
      parseMatrixArgs(['--n', '2', '--modes', 'mesh', '--dry-run']),
      {
        runOnce: async () => {
          called += 1;
          return { outPath: 'x', doc: {} };
        },
        log: () => {},
        error: () => {},
      },
    );
    assert.equal(outcome.dryRun, true);
    assert.equal(outcome.plan.length, 1);
    assert.equal(called, 0);
  });

  it('executeMatrix continues after failure and writes summary', async () => {
    const written = [];
    const sleeps = [];
    let calls = 0;
    const outcome = await executeMatrix(
      {
        ...parseMatrixArgs(['--modes', 'mesh', '--n', '2,3', '--trials', '1', '--cooldown', '1']),
        dryRun: false,
      },
      {
        runOnce: async (opts) => {
          calls += 1;
          if (opts.n === 2) throw new Error('join timeout');
          return {
            outPath: `results/mesh/n${opts.n}-uncapped-001.json`,
            doc: { runId: `M${opts.n}-U` },
          };
        },
        sleep: async (ms) => {
          sleeps.push(ms);
        },
        writeFileSync: (file, body) => {
          written.push({ file, body });
        },
        mkdirSync: () => {},
        log: () => {},
        error: () => {},
      },
    );

    assert.equal(calls, 2);
    assert.equal(outcome.ok, 1);
    assert.equal(outcome.failed, 1);
    assert.equal(sleeps.length, 1);
    assert.equal(sleeps[0], 1000);
    assert.equal(written.length, 1);
    const summary = JSON.parse(written[0].body);
    assert.equal(summary.ok, 1);
    assert.equal(summary.failed, 1);
  });
});
