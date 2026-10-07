import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRoomToken } from '../src/token.js';

describe('createRoomToken', () => {
  it('returns a JWT-like string', async () => {
    const token = await createRoomToken({
      apiKey: 'devkey',
      apiSecret: 'secret',
      roomName: 'project23',
      identity: 'p1',
    });
    assert.equal(typeof token, 'string');
    assert.equal(token.split('.').length, 3);
  });

  it('throws when credentials missing', async () => {
    await assert.rejects(
      () =>
        createRoomToken({
          apiKey: '',
          apiSecret: 'secret',
          roomName: 'r',
          identity: 'p1',
        }),
      /required/,
    );
  });
});
