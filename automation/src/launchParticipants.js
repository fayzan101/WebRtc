import { peerIdsForN } from '@webrtc/shared';
import { participantUrl } from './urls.js';

export const CHROME_ARGS = Object.freeze([
  '--use-fake-device-for-media-stream',
  '--use-fake-ui-for-media-stream',
  '--autoplay-policy=no-user-gesture-required',
  '--disable-dev-shm-usage',
  '--no-sandbox',
]);

/**
 * @param {string|undefined} audioFile
 */
export function buildChromeArgs(audioFile) {
  const args = [...CHROME_ARGS];
  if (audioFile) {
    args.push(`--use-file-for-fake-audio-capture=${audioFile}`);
  }
  return args;
}

/**
 * Launch N separate Chromium instances and wait until each is connected.
 *
 * @param {object} opts
 * @param {number} opts.n
 * @param {'mesh'|'sfu'} opts.mode
 * @param {string} opts.baseUrl
 * @param {string} opts.roomId
 * @param {number} opts.joinTimeoutMs
 * @param {boolean} [opts.headless]
 * @param {string} [opts.audioFile]
 * @param {import('puppeteer').PuppeteerNode} [opts.puppeteer]
 */
export async function launchParticipants(opts) {
  const {
    n,
    mode,
    baseUrl,
    roomId,
    joinTimeoutMs,
    headless = true,
    audioFile,
    puppeteer: puppeteerInjected,
  } = opts;

  const puppeteer = puppeteerInjected ?? (await import('puppeteer')).default;
  const peerIds = peerIdsForN(n);
  const args = buildChromeArgs(audioFile);
  const browsers = [];
  const pages = [];

  try {
    for (const peerId of peerIds) {
      const browser = await puppeteer.launch({
        headless,
        args,
      });
      browsers.push(browser);

      const page = await browser.newPage();
      const url = participantUrl({ baseUrl, roomId, peerId, video: 0 });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: joinTimeoutMs });

      await page.waitForFunction(
        () => window.__webrtcReady === true && typeof window.__waitUntilConnected === 'function',
        { timeout: joinTimeoutMs },
      );

      await page.evaluate(
        async (nMinus1, timeoutMs) => {
          const wait = window.__waitUntilConnected;
          if (!wait) throw new Error('__waitUntilConnected missing');
          await Promise.race([
            wait(nMinus1),
            new Promise((_, reject) => {
              setTimeout(() => reject(new Error(`__waitUntilConnected(${nMinus1}) timed out`)), timeoutMs);
            }),
          ]);
        },
        n - 1,
        joinTimeoutMs,
      );

      const proc = browser.process();
      const pid = proc?.pid ?? 0;

      pages.push({
        peerId,
        page,
        browser,
        browserPid: pid,
        mode,
      });
    }

    const chromiumVersion = await pages[0].page.browser().version();
    return { browsers, pages, peerIds, chromiumVersion };
  } catch (err) {
    await closeParticipants(browsers);
    throw err;
  }
}

/**
 * Best-effort close of all browsers.
 * @param {Array<{ close?: () => Promise<void> }>} browsers
 */
export async function closeParticipants(browsers) {
  const list = browsers ?? [];
  await Promise.all(
    list.map(async (browser) => {
      try {
        await browser.close();
      } catch {
        // ignore close errors during cleanup
      }
    }),
  );
}
