import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildChromeArgs,
  CHROME_ARGS,
  closeParticipants,
  launchParticipants,
} from '../src/launchParticipants.js';

function createMockPuppeteer({ failPeer } = {}) {
  const closed = [];
  const browsers = [];

  const puppeteer = {
    async launch() {
      const pages = [];
      const pid = 1000 + browsers.length;
      const browser = {
        process: () => ({ pid }),
        async newPage() {
          const peerHint = { current: null };
          const page = {
            peerHint,
            async goto(url) {
              peerHint.current = new URL(url).searchParams.get('peerId');
            },
            async waitForFunction() {
              /* ready */
            },
            async evaluate(fn, nMinus1) {
              if (failPeer && peerHint.current === failPeer) {
                throw new Error(`join failed for ${failPeer}`);
              }
              if (typeof fn === 'function') {
                // emulate wait body success
                return undefined;
              }
              return nMinus1;
            },
            browser: () => ({
              async version() {
                return 'Chrome/test';
              },
            }),
          };
          pages.push(page);
          return page;
        },
        async close() {
          closed.push(browser);
        },
        async version() {
          return 'Chrome/test';
        },
      };
      browsers.push(browser);
      return browser;
    },
  };

  return { puppeteer, closed, browsers };
}

describe('launchParticipants', () => {
  it('includes fake-media chrome args (+ optional audio file)', () => {
    assert.ok(CHROME_ARGS.includes('--use-fake-device-for-media-stream'));
    assert.ok(CHROME_ARGS.includes('--autoplay-policy=no-user-gesture-required'));
    const withAudio = buildChromeArgs('tone.wav');
    assert.ok(withAudio.some((a) => a.includes('tone.wav')));
  });

  it('launches N browsers and returns pages', async () => {
    const { puppeteer } = createMockPuppeteer();
    const result = await launchParticipants({
      n: 2,
      mode: 'mesh',
      baseUrl: 'http://127.0.0.1:5173/',
      roomId: 'project23',
      joinTimeoutMs: 5000,
      puppeteer,
    });
    assert.equal(result.peerIds.length, 2);
    assert.equal(result.pages.length, 2);
    assert.equal(result.pages[0].peerId, 'p1');
    assert.equal(result.pages[1].browserPid, 1001);
    assert.equal(result.chromiumVersion, 'Chrome/test');
    await closeParticipants(result.browsers);
  });

  it('closes browsers when join fails mid-launch', async () => {
    const { puppeteer, closed } = createMockPuppeteer({ failPeer: 'p2' });
    await assert.rejects(
      () =>
        launchParticipants({
          n: 2,
          mode: 'mesh',
          baseUrl: 'http://127.0.0.1:5173/',
          roomId: 'lab',
          joinTimeoutMs: 1000,
          puppeteer,
        }),
      /join failed for p2/,
    );
    assert.ok(closed.length >= 1);
  });

  it('closeParticipants ignores close errors', async () => {
    await closeParticipants([
      {
        async close() {
          throw new Error('already gone');
        },
      },
    ]);
  });
});
