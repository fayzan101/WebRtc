import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { RoomRegistry } from '../src/rooms.js';

function fakeWs(readyState = 1) {
  const sent = [];
  return {
    readyState,
    sent,
    send(data) {
      sent.push(data);
    },
  };
}

describe('RoomRegistry', () => {
  /** @type {RoomRegistry} */
  let rooms;

  beforeEach(() => {
    rooms = new RoomRegistry();
  });

  it('adds a peer to a new room', () => {
    const ws = fakeWs();
    const result = rooms.addPeer('project23', 'p1', ws);
    assert.equal(result.ok, true);
    assert.equal(rooms.peerCount('project23'), 1);
    assert.equal(rooms.getPeer('project23', 'p1')?.ws, ws);
  });

  it('lists peers and supports excludePeerId', () => {
    rooms.addPeer('r', 'p1', fakeWs());
    rooms.addPeer('r', 'p2', fakeWs());
    rooms.addPeer('r', 'p3', fakeWs());
    assert.deepEqual(rooms.listPeers('r').sort(), ['p1', 'p2', 'p3']);
    assert.deepEqual(rooms.listPeers('r', { excludePeerId: 'p2' }).sort(), ['p1', 'p3']);
  });

  it('rejects duplicate peerId in the same room', () => {
    rooms.addPeer('r', 'p1', fakeWs());
    const dup = rooms.addPeer('r', 'p1', fakeWs());
    assert.equal(dup.ok, false);
    assert.match(dup.error, /already joined/);
    assert.equal(rooms.peerCount('r'), 1);
  });

  it('allows same peerId in different rooms', () => {
    assert.equal(rooms.addPeer('a', 'p1', fakeWs()).ok, true);
    assert.equal(rooms.addPeer('b', 'p1', fakeWs()).ok, true);
    assert.equal(rooms.roomCount(), 2);
  });

  it('rejects missing roomId, peerId, or ws', () => {
    assert.equal(rooms.addPeer('', 'p1', fakeWs()).ok, false);
    assert.equal(rooms.addPeer('r', '', fakeWs()).ok, false);
    assert.equal(rooms.addPeer('r', 'p1', null).ok, false);
  });

  it('removes peer and deletes empty room', () => {
    rooms.addPeer('r', 'p1', fakeWs());
    const result = rooms.removePeer('r', 'p1');
    assert.equal(result.removed, true);
    assert.equal(result.roomEmpty, true);
    assert.equal(rooms.roomCount(), 0);
    assert.equal(rooms.getPeer('r', 'p1'), null);
  });

  it('removePeer on unknown peer is a no-op', () => {
    const result = rooms.removePeer('missing', 'p9');
    assert.equal(result.removed, false);
  });

  it('keeps room when other peers remain', () => {
    rooms.addPeer('r', 'p1', fakeWs());
    rooms.addPeer('r', 'p2', fakeWs());
    const result = rooms.removePeer('r', 'p1');
    assert.equal(result.removed, true);
    assert.equal(result.roomEmpty, false);
    assert.equal(rooms.peerCount('r'), 1);
  });

  it('removeBySocket finds and removes the matching peer', () => {
    const ws = fakeWs();
    rooms.addPeer('r', 'p1', fakeWs());
    rooms.addPeer('r', 'p2', ws);
    const found = rooms.removeBySocket(ws);
    assert.deepEqual(found, { roomId: 'r', peerId: 'p2' });
    assert.equal(rooms.peerCount('r'), 1);
  });

  it('removeBySocket returns null when socket unknown', () => {
    assert.equal(rooms.removeBySocket(fakeWs()), null);
  });

  it('broadcast skips sender and closed sockets', () => {
    const a = fakeWs(1);
    const b = fakeWs(1);
    const closed = fakeWs(3);
    rooms.addPeer('r', 'p1', a);
    rooms.addPeer('r', 'p2', b);
    rooms.addPeer('r', 'p3', closed);
    const sent = rooms.broadcast('r', 'p1', { type: 'peer-joined', from: 'p1' });
    assert.equal(sent, 1);
    assert.equal(b.sent.length, 1);
    assert.equal(a.sent.length, 0);
    assert.equal(closed.sent.length, 0);
  });

  it('sendTo delivers only to target peer', () => {
    const a = fakeWs();
    const b = fakeWs();
    rooms.addPeer('r', 'p1', a);
    rooms.addPeer('r', 'p2', b);
    assert.equal(rooms.sendTo('r', 'p2', { type: 'offer' }), true);
    assert.equal(b.sent.length, 1);
    assert.equal(a.sent.length, 0);
    assert.equal(rooms.sendTo('r', 'missing', { type: 'offer' }), false);
  });

  it('clear empties all rooms', () => {
    rooms.addPeer('a', 'p1', fakeWs());
    rooms.addPeer('b', 'p1', fakeWs());
    rooms.clear();
    assert.equal(rooms.roomCount(), 0);
  });
});
