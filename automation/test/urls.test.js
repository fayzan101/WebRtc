import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defaultBaseUrl, participantUrl } from '../src/urls.js';

describe('urls', () => {
  it('defaultBaseUrl uses env ports', () => {
    assert.equal(
      defaultBaseUrl('mesh', { MESH_VITE_PORT: '5199' }),
      'http://127.0.0.1:5199/',
    );
    assert.equal(
      defaultBaseUrl('sfu', { SFU_VITE_PORT: '5200' }),
      'http://127.0.0.1:5200/',
    );
  });

  it('participantUrl sets Phase 4 autojoin query', () => {
    const url = participantUrl({
      baseUrl: 'http://127.0.0.1:5173/',
      roomId: 'project23',
      peerId: 'p2',
    });
    const parsed = new URL(url);
    assert.equal(parsed.origin, 'http://127.0.0.1:5173');
    assert.equal(parsed.searchParams.get('roomId'), 'project23');
    assert.equal(parsed.searchParams.get('peerId'), 'p2');
    assert.equal(parsed.searchParams.get('autojoin'), '1');
    assert.equal(parsed.searchParams.get('video'), '0');
  });

  it('rejects missing fields', () => {
    assert.throws(() => participantUrl({ baseUrl: '', roomId: 'r', peerId: 'p1' }), /baseUrl/);
    assert.throws(
      () => participantUrl({ baseUrl: 'http://x/', roomId: ' ', peerId: 'p1' }),
      /roomId/,
    );
  });
});
