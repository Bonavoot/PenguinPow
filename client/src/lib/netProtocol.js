// ESM twin of shared/netProtocol.json for the Vite/browser bundle.
// server-io/test/net/protocol-contract.test.js fails if the two drift.
export const PROTOCOL_VERSION = 3;
export const HELLO_TIMEOUT_MS = 10000;
export const RECONNECT_GRACE_MS = 5000;
export const PREMATCH_READY_CAP_MS = 25000;
export const PING_INTERVAL_MS = 2500;
export const PING_TIMEOUT_MS = 5000;
export const SESSION_IDLE_TTL_MS = 600000;
export const INPUT_SEQ_MAX_JUMP = 4096;
export const REMOTE_INTERP_DELAY_MS = 24;
export const EVENTS = Object.freeze({
  HELLO: "hello",
  SESSION: "session",
  OPPONENT_RECONNECTING: "opponent_reconnecting",
  MATCH_RESUMED: "match_resumed",
  MATCH_ABANDONED: "match_abandoned",
});
