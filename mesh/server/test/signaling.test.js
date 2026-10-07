import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { RoomRegistry } from '../src/rooms.js';
import { SignalingSession } from '../src/signaling.js';

function mockWs() {
  const sent = [];
  return {
    readyState: 1,
    sent,
    send(data) {
      sent.push(typeof data === 'string' ? JSON.parse(data) : data);
    },
  };
}

describe('SignalingSession', () => {
  /** @type {RoomRegistry} */
  let rooms;
  /** @type {ReturnType<typeof mockWs>} */
  let ws;
  /** @type {SignalingSession} */
  let session;
  /** @type {Record<string, unknown>[]} */
  let logs;

  beforeEach(() => {
    rooms = new RoomRegistry();
    ws = mockWs();
    logs = [];
    session = new SignalingSession(ws, {
      rooms,
      log: (e) => logs.push(e),
      now: () => 123,
    });
  });

  it('joins and acks existing peers', () => {
    const other = mockWs();
    rooms.addPeer('project23', 'p1', other);

    session.handleRaw(
      JSON.stringify({ type: 'join', roomId: 'project23', from: 'p2' }),
    );

    assert.equal(ws.sent[0].type, 'joined');
    assert.deepEqual(ws.sent[0].payload.peers, ['p1']);
    assert.equal(other.sent.length, 1);
    assert.equal(other.sent[0].type, 'peer-joined');
    assert.equal(session.session?.peerId, 'p2');
  });

  it('rejects duplicate join for same peerId', () => {
    rooms.addPeer('r', 'p1', mockWs());
    session.handleMessage({ type: 'join', roomId: 'r', from: 'p1', payload: {} });
    assert.equal(ws.sent[0].type, 'error');
    assert.match(ws.sent[0].payload.message, /already joined/);
    assert.equal(session.session, null);
  });

  it('rejects second join on same socket', () => {
    session.handleMessage({ type: 'join', roomId: 'r', from: 'p1', payload: {} });
    session.handleMessage({ type: 'join', roomId: 'r2', from: 'p9', payload: {} });
    assert.equal(ws.sent.at(-1).type, 'error');
    assert.match(ws.sent.at(-1).payload.message, /already joined/);
  });

  it('relays offer only to target', () => {
    const target = mockWs();
    const bystander = mockWs();
    rooms.addPeer('r', 'p2', target);
    rooms.addPeer('r', 'p3', bystander);
    session.handleMessage({ type: 'join', roomId: 'r', from: 'p1', payload: {} });

    session.handleMessage({
      type: 'offer',
      roomId: 'r',
      from: 'p1',
      to: 'p2',
      payload: { sdp: 'offer-sdp' },
    });

    assert.equal(target.sent.length, 2); // peer-joined + offer
    const offer = target.sent[1];
    assert.equal(offer.type, 'offer');
    assert.equal(offer.payload.sdp, 'offer-sdp');
    assert.equal(bystander.sent.length, 1); // only peer-joined
    assert.equal(session.relayCount, 1);
  });

  it('errors when relaying before join', () => {
    session.handleMessage({
      type: 'offer',
      roomId: 'r',
      from: 'p1',
      to: 'p2',
      payload: { sdp: 'x' },
    });
    assert.match(ws.sent[0].payload.message, /must join/);
  });

  it('errors when target peer is missing', () => {
    session.handleMessage({ type: 'join', roomId: 'r', from: 'p1', payload: {} });
    session.handleMessage({
      type: 'answer',
      roomId: 'r',
      from: 'p1',
      to: 'ghost',
      payload: { sdp: 'a' },
    });
    assert.match(ws.sent.at(-1).payload.message, /not found/);
  });

  it('rejects relay with mismatched session identity', () => {
    session.handleMessage({ type: 'join', roomId: 'r', from: 'p1', payload: {} });
    session.handleMessage({
      type: 'ice-candidate',
      roomId: 'other',
      from: 'p1',
      to: 'p2',
      payload: { candidate: null },
    });
    assert.match(ws.sent.at(-1).payload.message, /must match/);
  });

  it('leave broadcasts peer-left and clears session', () => {
    const other = mockWs();
    session.handleMessage({ type: 'join', roomId: 'r', from: 'p1', payload: {} });
    rooms.addPeer('r', 'p2', other);
    // clear peer-joined noise
    other.sent.length = 0;

    session.handleMessage({ type: 'leave', roomId: 'r', from: 'p1', payload: {} });
    assert.equal(session.session, null);
    assert.equal(rooms.getPeer('r', 'p1'), null);
    assert.equal(other.sent[0].type, 'peer-left');
  });

  it('leave before join returns error', () => {
    session.handleMessage({ type: 'leave', roomId: 'r', from: 'p1', payload: {} });
    assert.match(ws.sent[0].payload.message, /not joined/);
  });

  it('disconnect via depart notifies remaining peers', () => {
    const other = mockWs();
    session.handleMessage({ type: 'join', roomId: 'r', from: 'p1', payload: {} });
    rooms.addPeer('r', 'p2', other);
    other.sent.length = 0;
    session.depart('disconnect');
    assert.equal(other.sent[0].type, 'peer-left');
    assert.equal(logs.some((e) => e.msg === 'disconnect'), true);
  });

  it('returns error for invalid JSON and validation failures', () => {
    session.handleRaw('{bad');
    assert.equal(ws.sent[0].type, 'error');
    session.handleRaw(JSON.stringify({ type: 'join', roomId: '', from: 'p1' }));
    assert.equal(ws.sent[1].type, 'error');
  });
});
