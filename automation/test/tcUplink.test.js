import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  applyCapIfNeeded,
  capToTcRate,
  clearCapIfNeeded,
  createTcController,
} from '../src/tcUplink.js';

describe('tcUplink', () => {
  it('maps schema caps to tc rates', () => {
    assert.equal(capToTcRate('1Mbps'), '1mbit');
    assert.equal(capToTcRate('5Mbps'), '5mbit');
    assert.equal(capToTcRate('uncapped'), null);
  });

  it('createTcController shells out apply/clear/show', async () => {
    /** @type {string[][]} */
    const calls = [];
    const scriptPath = path.resolve('/repo/scripts/tc-uplink.sh');
    const tc = createTcController({
      scriptPath,
      existsSync: () => true,
      platform: 'linux',
      shell: 'bash',
      runCommand: async ({ command, args }) => {
        calls.push([command, ...args]);
        return { code: 0, stdout: 'ok', stderr: '' };
      },
    });

    await tc.apply('eth0', '1mbit');
    await tc.clear('eth0');
    await tc.show('eth0');

    assert.deepEqual(calls[0], ['bash', scriptPath, 'apply', 'eth0', '1mbit']);
    assert.deepEqual(calls[1], ['bash', scriptPath, 'clear', 'eth0']);
    assert.deepEqual(calls[2], ['bash', scriptPath, 'show', 'eth0']);
  });

  it('applyCapIfNeeded no-ops without iface and notes missing shaping', async () => {
    const result = await applyCapIfNeeded({
      cap: '1Mbps',
      createController: () => {
        throw new Error('should not create');
      },
    });
    assert.equal(result.applied, false);
    assert.match(result.note, /without --tc-iface/);
  });

  it('applyCapIfNeeded applies when iface set', async () => {
    const ops = [];
    const result = await applyCapIfNeeded({
      cap: '5Mbps',
      tcIface: 'eth0',
      createController: () => ({
        apply: async (iface, rate) => {
          ops.push(['apply', iface, rate]);
          return { code: 0, stdout: '', stderr: '' };
        },
        clear: async () => ({ code: 0, stdout: '', stderr: '' }),
        show: async () => ({ code: 0, stdout: '', stderr: '' }),
      }),
    });
    assert.equal(result.applied, true);
    assert.equal(result.rate, '5mbit');
    assert.deepEqual(ops, [['apply', 'eth0', '5mbit']]);
  });

  it('clearCapIfNeeded clears when iface set', async () => {
    const ops = [];
    await clearCapIfNeeded({
      tcIface: 'wlan0',
      createController: () => ({
        apply: async () => ({ code: 0, stdout: '', stderr: '' }),
        clear: async (iface) => {
          ops.push(iface);
          return { code: 0, stdout: '', stderr: '' };
        },
        show: async () => ({ code: 0, stdout: '', stderr: '' }),
      }),
    });
    assert.deepEqual(ops, ['wlan0']);
  });
});
