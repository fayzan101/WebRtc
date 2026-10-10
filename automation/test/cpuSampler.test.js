import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createCpuSampler, resolveSfuPid } from '../src/cpuSampler.js';

describe('cpuSampler', () => {
  it('resolveSfuPid reads LIVEKIT_PID / SFU_PID', () => {
    assert.equal(resolveSfuPid({}), 0);
    assert.equal(resolveSfuPid({ LIVEKIT_PID: '4321' }), 4321);
    assert.equal(resolveSfuPid({ SFU_PID: '99' }), 99);
    assert.equal(resolveSfuPid({ LIVEKIT_PID: 'nope' }), 0);
  });

  it('samples browser + extra SFU pid via injected pidusage', async () => {
    const calls = [];
    const sampler = createCpuSampler({
      extraPids: [9],
      pidusage: async (pids) => {
        calls.push(pids);
        if (Array.isArray(pids)) {
          return {
            11: { cpu: 21.5 },
            12: { cpu: 18 },
            9: { cpu: 7.25 },
          };
        }
        return { cpu: 21.5 };
      },
    });

    const result = await sampler.sample([11, 12]);
    assert.deepEqual(calls[0].sort((a, b) => a - b), [9, 11, 12]);
    assert.equal(result.byPid[11], 21.5);
    assert.equal(result.byPid[12], 18);
    assert.equal(result.sfuCpuPercent, 7.25);
  });

  it('handles empty pid list', async () => {
    const sampler = createCpuSampler({
      pidusage: async () => {
        throw new Error('should not call');
      },
    });
    const result = await sampler.sample([]);
    assert.deepEqual(result.byPid, {});
    assert.equal(result.sfuCpuPercent, null);
  });
});
