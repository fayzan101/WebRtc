import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  errorMessage,
  joinedMessage,
  parseRawMessage,
  peerJoinedMessage,
  peerLeftMessage,
  validateClientMessage,
} from '../src/protocol.js';

describe('parseRawMessage', () => {
  it('parses JSON strings', () => {
    const result = parseRawMessage('{"type":"join"}');
    assert.equal(result.ok, true);
    assert.deepEqual(result.value, { type: 'join' });
  });

  it('parses Buffer payloads', () => {
    const result = parseRawMessage(Buffer.from('{"a":1}'));
    assert.equal(result.ok, true);
    assert.deepEqual(result.value, { a: 1 });
  });

  it('rejects empty / whitespace / invalid JSON', () => {
    assert.equal(parseRawMessage('').ok, false);
    assert.equal(parseRawMessage('   ').ok, false);
    assert.equal(parseRawMessage(null).ok, false);
    assert.equal(parseRawMessage('{nope').ok, false);
    assert.match(parseRawMessage('{nope').error, /invalid JSON/);
  });

  it('rejects unsupported formats', () => {
    assert.equal(parseRawMessage(42).ok, false);
  });
});

describe('validateClientMessage', () => {
  it('accepts a valid join and trims ids', () => {
    const result = validateClientMessage({
      type: 'join',
      roomId: ' project23 ',
      from: ' p1 ',
    });
    assert.equal(result.ok, true);
    assert.deepEqual(result.message, {
      type: 'join',
      roomId: 'project23',
      from: 'p1',
      payload: {},
    });
  });

  it('accepts leave', () => {
    const result = validateClientMessage({
      type: 'leave',
      roomId: 'r',
      from: 'p1',
    });
    assert.equal(result.ok, true);
    assert.equal(result.message.type, 'leave');
  });

  it('accepts offer/answer with sdp', () => {
    for (const type of ['offer', 'answer']) {
      const result = validateClientMessage({
        type,
        roomId: 'r',
        from: 'p1',
        to: 'p2',
        payload: { sdp: 'v=0' },
      });
      assert.equal(result.ok, true);
      assert.equal(result.message.payload.sdp, 'v=0');
    }
  });

  it('accepts ice-candidate object, string, or null (end-of-candidates)', () => {
    assert.equal(
      validateClientMessage({
        type: 'ice-candidate',
        roomId: 'r',
        from: 'p1',
        to: 'p2',
        payload: { candidate: { candidate: 'a', sdpMid: '0' } },
      }).ok,
      true,
    );
    assert.equal(
      validateClientMessage({
        type: 'ice-candidate',
        roomId: 'r',
        from: 'p1',
        to: 'p2',
        payload: { candidate: 'candidate:1 1 UDP' },
      }).ok,
      true,
    );
    assert.equal(
      validateClientMessage({
        type: 'ice-candidate',
        roomId: 'r',
        from: 'p1',
        to: 'p2',
        payload: { candidate: null },
      }).ok,
      true,
    );
  });

  it('rejects non-objects and unknown types', () => {
    assert.equal(validateClientMessage(null).ok, false);
    assert.equal(validateClientMessage([]).ok, false);
    assert.equal(validateClientMessage({ type: 'joined', roomId: 'r', from: 'p1' }).ok, false);
    assert.equal(validateClientMessage({ type: 'explode', roomId: 'r', from: 'p1' }).ok, false);
  });

  it('rejects missing/blank roomId and from', () => {
    assert.equal(validateClientMessage({ type: 'join', roomId: '', from: 'p1' }).ok, false);
    assert.equal(validateClientMessage({ type: 'join', roomId: 'r', from: '  ' }).ok, false);
    assert.equal(validateClientMessage({ type: 'join', from: 'p1' }).ok, false);
  });

  it('rejects directed messages without to or with to===from', () => {
    assert.equal(
      validateClientMessage({
        type: 'offer',
        roomId: 'r',
        from: 'p1',
        payload: { sdp: 'x' },
      }).ok,
      false,
    );
    assert.equal(
      validateClientMessage({
        type: 'offer',
        roomId: 'r',
        from: 'p1',
        to: 'p1',
        payload: { sdp: 'x' },
      }).ok,
      false,
    );
  });

  it('rejects offer/answer without sdp', () => {
    assert.equal(
      validateClientMessage({
        type: 'offer',
        roomId: 'r',
        from: 'p1',
        to: 'p2',
        payload: {},
      }).ok,
      false,
    );
    assert.equal(
      validateClientMessage({
        type: 'answer',
        roomId: 'r',
        from: 'p1',
        to: 'p2',
        payload: { sdp: '   ' },
      }).ok,
      false,
    );
  });

  it('rejects ice-candidate without candidate field or bad type', () => {
    assert.equal(
      validateClientMessage({
        type: 'ice-candidate',
        roomId: 'r',
        from: 'p1',
        to: 'p2',
        payload: {},
      }).ok,
      false,
    );
    assert.equal(
      validateClientMessage({
        type: 'ice-candidate',
        roomId: 'r',
        from: 'p1',
        to: 'p2',
        payload: { candidate: 12 },
      }).ok,
      false,
    );
  });

  it('rejects directed messages with non-object payload', () => {
    assert.equal(
      validateClientMessage({
        type: 'offer',
        roomId: 'r',
        from: 'p1',
        to: 'p2',
        payload: 'sdp',
      }).ok,
      false,
    );
  });
});

describe('server message helpers', () => {
  it('builds error/joined/peer events', () => {
    assert.deepEqual(errorMessage('nope', 'r', 'p1').payload, { message: 'nope' });
    assert.deepEqual(joinedMessage('r', 'p1', ['p2']).payload, { peers: ['p2'] });
    assert.equal(peerJoinedMessage('r', 'p3').type, 'peer-joined');
    assert.equal(peerLeftMessage('r', 'p3').type, 'peer-left');
  });
});
