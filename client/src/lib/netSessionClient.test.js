/**
 * Client half of the net session contract (pure state, no socket).
 * Run: node --test client/src/lib/netSessionClient.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SessionState, PROTOCOL_VERSION } from "./netSessionClient.js";

describe("SessionState", () => {
  it("hello payload carries the protocol version and, once known, the resume token", () => {
    const s = new SessionState("remote");
    assert.deepEqual(s.helloPayload(), { protocolVersion: PROTOCOL_VERSION });
    s.applyHelloAck({ ok: true, playerId: "p_1", token: "tok-1", resumed: false, roomId: null });
    assert.deepEqual(s.helloPayload(), { protocolVersion: PROTOCOL_VERSION, resumeToken: "tok-1" });
  });

  it("a fresh identity resets the input seq; a resumed identity keeps it", () => {
    const s = new SessionState("remote");
    s.applyHelloAck({ ok: true, playerId: "p_1", token: "tok-1", resumed: false });
    s.stampInput({});
    s.stampInput({});
    assert.equal(s.inputSeq, 2);
    // reconnect, same identity (resumed match)
    const r = s.applyHelloAck({ ok: true, playerId: "p_1", token: "tok-1", resumed: true, roomId: "Room 1" });
    assert.equal(r.resumed, true);
    assert.equal(r.identityChanged, false);
    assert.equal(s.inputSeq, 2, "seq continues so the server does not see stale packets");
    // server restarted → new identity
    const f = s.applyHelloAck({ ok: true, playerId: "p_2", token: "tok-2", resumed: false });
    assert.equal(f.identityChanged, true);
    assert.equal(s.inputSeq, 0);
    assert.equal(s.stats.fresh, 2);
    assert.equal(s.stats.resumedMatch, 1);
  });

  it("stampInput sets a monotonic seq and the stable id on every packet", () => {
    const s = new SessionState("remote");
    s.applyHelloAck({ ok: true, playerId: "p_9", token: "t", resumed: false });
    const a = s.stampInput({ id: "transient-socket-id", keys: {} });
    const b = s.stampInput({ id: "transient-socket-id", keys: {} });
    assert.equal(a.seq, 1);
    assert.equal(b.seq, 2);
    assert.equal(a.id, "p_9");
    assert.equal(b.id, "p_9");
    assert.equal(s.stats.inputsSent, 2);
  });

  it("protocol mismatch is reported, not swallowed", () => {
    const s = new SessionState("remote");
    const r = s.applyHelloAck({ ok: false, reason: "protocol_mismatch", serverVersion: 99 });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "protocol_mismatch");
    assert.equal(r.serverVersion, 99);
    assert.equal(s.status, "mismatch");
    const t = s.applyHelloAck(null);
    assert.equal(t.reason, "no_ack");
  });

  it("the token lives in memory only: reconnects resume, a new page load never does", () => {
    const s = new SessionState("remote");
    s.applyHelloAck({ ok: true, playerId: "p_1", token: "tok-1", resumed: false });
    // socket.io reconnect within the same page → same object, token presented
    assert.deepEqual(s.helloPayload(), { protocolVersion: PROTOCOL_VERSION, resumeToken: "tok-1" });
    // a reload / duplicated tab / relaunch constructs a fresh SessionState:
    // no token, so it can neither evict the live tab nor be resumed into a
    // bout its UI is not showing.
    const fresh = new SessionState("remote");
    assert.equal(fresh.token, null);
    assert.equal(fresh.playerId, null);
    assert.deepEqual(fresh.helloPayload(), { protocolVersion: PROTOCOL_VERSION });
    s.forget();
    assert.equal(s.token, null);
    assert.equal(s.inputSeq, 0);
  });

  it("tracks unacked inputs from the echoed inputSeqAck", () => {
    const s = new SessionState("remote");
    s.applyHelloAck({ ok: true, playerId: "p_1", token: "t", resumed: false });
    for (let i = 0; i < 5; i++) s.stampInput({});
    assert.equal(s.unackedInputs, 5);
    s.noteAck(3);
    assert.equal(s.unackedInputs, 2);
    s.noteAck(2); // out-of-date ack never regresses
    assert.equal(s.stats.lastAckSeq, 3);
  });

  it("separate servers keep separate identities", () => {
    const remote = new SessionState("remote");
    const local = new SessionState("local");
    remote.applyHelloAck({ ok: true, playerId: "p_r", token: "tr", resumed: false });
    local.applyHelloAck({ ok: true, playerId: "p_l", token: "tl", resumed: false });
    assert.equal(remote.playerId, "p_r");
    assert.equal(local.playerId, "p_l");
    assert.notEqual(remote.helloPayload().resumeToken, local.helloPayload().resumeToken);
  });
});
