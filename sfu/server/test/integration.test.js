import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createSfuServer } from '../src/index.js';

describe('sfu token API integration', () => {
  /** @type {ReturnType<typeof createSfuServer>} */
  let sfu;
  let port;

  before(async () => {
    sfu = createSfuServer({
      port: 0,
      apiKey: 'devkey',
      apiSecret: 'secret',
      livekitUrl: 'ws://127.0.0.1:7880',
      log: () => {},
    });
    const started = await sfu.start();
    port = started.port;
  });

  after(async () => {
    await sfu.stop();
  });

  it('GET /health reports phase 3 token API', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.phase, 3);
    assert.equal(body.tokenApi, true);
    assert.equal(body.livekitConfigured, true);
  });

  it('POST /token issues token + url', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ roomName: 'project23', identity: 'p1' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(typeof body.token, 'string');
    assert.equal(body.token.split('.').length, 3);
    assert.equal(body.url, 'ws://127.0.0.1:7880');
    assert.equal(body.identity, 'p1');
  });

  it('POST /token rejects invalid body with 400', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ roomName: 'r' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /identity/i);
  });

  it('POST /token returns 503 when env missing', async () => {
    const broken = createSfuServer({
      port: 0,
      apiKey: '',
      apiSecret: '',
      livekitUrl: '',
      log: () => {},
    });
    const { port: p } = await broken.start();
    try {
      const res = await fetch(`http://127.0.0.1:${p}/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ roomName: 'r', identity: 'p1' }),
      });
      assert.equal(res.status, 503);
    } finally {
      await broken.stop();
    }
  });
});
