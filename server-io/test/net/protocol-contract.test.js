"use strict";

/**
 * The server reads shared/netProtocol.json (CJS); the Vite client bundles the
 * ESM twin client/src/lib/netProtocol.js (esbuild 0.18 cannot import JSON
 * with attributes). This test fails the build if the two ever drift, and pins
 * the wire fields the session contract added to the fighter_action stream.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { pathToFileURL } = require("url");

const fs = require("fs");

const json = require("../../../shared/netProtocol.json");
const { DELTA_TRACKED_PROPS, ALWAYS_SEND_PROPS } = require("../../constants");

describe("net protocol contract", () => {
  it("server-io/netProtocol.json is a byte-identical deploy mirror of shared/ (Heroku app root is server-io/)", () => {
    const shared = fs.readFileSync(path.join(__dirname, "../../../shared/netProtocol.json"));
    const mirror = fs.readFileSync(path.join(__dirname, "../../netProtocol.json"));
    assert.ok(shared.equals(mirror), "re-copy shared/netProtocol.json over server-io/netProtocol.json");
  });

  it("client ESM twin matches shared/netProtocol.json", async () => {
    const esm = await import(pathToFileURL(path.join(__dirname, "../../../client/src/lib/netProtocol.js")).href);
    assert.equal(esm.PROTOCOL_VERSION, json.PROTOCOL_VERSION);
    assert.equal(esm.HELLO_TIMEOUT_MS, json.HELLO_TIMEOUT_MS);
    assert.equal(esm.RECONNECT_GRACE_MS, json.RECONNECT_GRACE_MS);
    assert.equal(esm.SESSION_IDLE_TTL_MS, json.SESSION_IDLE_TTL_MS);
    assert.equal(esm.INPUT_SEQ_MAX_JUMP, json.INPUT_SEQ_MAX_JUMP);
    assert.deepEqual({ ...esm.EVENTS }, json.EVENTS);
  });

  it("inputSeqAck and isDisconnected ride the delta wire (not every packet)", () => {
    assert.ok(DELTA_TRACKED_PROPS.includes("inputSeqAck"));
    assert.ok(DELTA_TRACKED_PROPS.includes("isDisconnected"));
    assert.ok(!ALWAYS_SEND_PROPS.includes("inputSeqAck"));
  });

  it("protocol version is a positive integer ≥ 2 (v1 = unversioned legacy)", () => {
    assert.ok(Number.isInteger(json.PROTOCOL_VERSION) && json.PROTOCOL_VERSION >= 2);
    assert.ok(json.RECONNECT_GRACE_MS >= 5000 && json.RECONNECT_GRACE_MS <= 60000);
  });
});
