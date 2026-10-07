import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateLiveKitEnv, validateTokenRequest } from '../src/validate.js';

describe('validateTokenRequest', () => {
  it('accepts roomName + identity', () => {
    const r = validateTokenRequest({ roomName: ' project23 ', identity: ' p1 ' });
    assert.equal(r.ok, true);
    assert.equal(r.roomName, 'project23');
    assert.equal(r.identity, 'p1');
  });

  it('accepts aliases room and peerId', () => {
    const r = validateTokenRequest({ room: 'lab', peerId: 'alice' });
    assert.equal(r.ok, true);
    assert.equal(r.roomName, 'lab');
    assert.equal(r.identity, 'alice');
  });

  it('rejects bad bodies', () => {
    assert.equal(validateTokenRequest(null).ok, false);
    assert.equal(validateTokenRequest([]).ok, false);
    assert.equal(validateTokenRequest({ identity: 'p1' }).ok, false);
    assert.equal(validateTokenRequest({ roomName: 'r', identity: '' }).ok, false);
    assert.equal(validateTokenRequest({ roomName: 'r', identity: 'bad id!' }).ok, false);
    assert.equal(
      validateTokenRequest({ roomName: 'x'.repeat(200), identity: 'p1' }).ok,
      false,
    );
  });
});

describe('validateLiveKitEnv', () => {
  it('accepts valid env', () => {
    const r = validateLiveKitEnv({
      apiKey: 'devkey',
      apiSecret: 'secret',
      livekitUrl: 'ws://127.0.0.1:7880',
    });
    assert.equal(r.ok, true);
  });

  it('rejects missing fields and bad URL scheme', () => {
    assert.equal(validateLiveKitEnv({}).ok, false);
    assert.equal(
      validateLiveKitEnv({
        apiKey: 'k',
        apiSecret: 's',
        livekitUrl: 'http://localhost:7880',
      }).ok,
      false,
    );
  });
});
