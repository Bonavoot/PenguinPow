"use strict";

// Tachiai — the sealed opening at HAKKIYOI.
//
// The call is the chord held at the shout. A tap released before the shout
// still counts, so a buffered press comes out as the opening move.
const TACHIAI_HAKKIYOI_MS = 2700;
const TACHIAI_LIVE_MS = 800;
const TACHIAI_INPUT_GRACE_MS = 240;
const TACHIAI_CHARGE_HITSTUN_MS = 820;
const TACHIAI_CHARGE_HIT_RECOVERY_MS = 700;
const TACHIAI_CHARGE_HITSTOP_MS = 460;

const TACHIAI_CHARGE_POWER = 100;
// Ready gap is 192. Mid-bout sidestep travel is 160 and does not cross.
const TACHIAI_SIDESTEP_TRAVEL = 240;

// Peak of `height * 4 * t * (1-t)` is `height`. 56px in 40ms is above the
// slap band before the slap's active frames, and still a body a charge hits.
const TACHIAI_DODGE_HOP_HEIGHT = 56;
const TACHIAI_DODGE_HOP_MS = 40;
const TACHIAI_DODGE_SLAP_CLEAR_PX = 24;

const TACHIAI_CALL = Object.freeze({
  STAND: "stand",
  SLAP: "slap",
  CHARGE: "charge",
  PALM: "palm",
  GRAB: "grab",
  HENKA: "henka",
  MATADOR: "matador",
  PARRY: "parry",
  DODGE_IN: "dodgeIn",
  DODGE_BACK: "dodgeBack",
});

const CAPTION = Object.freeze({
  charge: "CHARGE",
  henka: "HENKA",
  grab: "OSHI",
  slap: "HATAKIKOMI",
  palm: "TSUPPARI",
  dodgeIn: "DODGE",
  dodgeBack: "DODGE",
  parry: "RECEIVE",
  matador: "HIKIOTOSHI",
  stand: null,
});

function emptyHeld() {
  return {
    mouse1: false,
    mouse2: false,
    shift: false,
    s: false,
    a: false,
    d: false,
    " ": false,
    w: false,
  };
}

function heldFromKeys(keys) {
  const src = keys || {};
  return {
    mouse1: !!src.mouse1,
    mouse2: !!src.mouse2,
    shift: !!src.shift,
    s: !!src.s,
    a: !!src.a,
    d: !!src.d,
    " ": !!src[" "],
    w: !!src.w,
  };
}

/**
 * Facing is derived from positions. facing -1 looks toward +X, so the
 * fighter on the left presses D to come forward.
 */
function classifyTachiaiCall(held, playerX, opponentX) {
  const h = held || emptyHeld();
  const onLeft = (playerX || 0) <= (opponentX || 0);
  const forward = onLeft ? "d" : "a";
  const back = onLeft ? "a" : "d";
  const forwardHeld = !!h[forward];
  const backHeld = !!h[back] && !forwardHeld;

  if (h.shift && h.s) return TACHIAI_CALL.HENKA;
  if (h.shift) return backHeld ? TACHIAI_CALL.DODGE_BACK : TACHIAI_CALL.DODGE_IN;
  if (h[" "] && backHeld) return TACHIAI_CALL.MATADOR;
  if (h[" "]) return TACHIAI_CALL.PARRY;
  if (h.mouse2) return TACHIAI_CALL.GRAB;
  if (h.mouse1 && h.s && forwardHeld) return TACHIAI_CALL.CHARGE;
  if (h.mouse1 && backHeld) return TACHIAI_CALL.PALM;
  if (h.mouse1) return TACHIAI_CALL.SLAP;
  return TACHIAI_CALL.STAND;
}

function isTachiaiLive(player, now) {
  if (!player || !player.tachiaiActionPending) return false;
  if (!player.tachiaiCall || player.tachiaiCall === TACHIAI_CALL.STAND) return false;
  return typeof now === "number" && now < (player.tachiaiUntil || 0);
}

function markTachiaiAction(player, call, now) {
  if (!player || player.tachiaiActionConsumed) return false;
  if (player.tachiaiActionPending) return player.tachiaiCall === call;
  const nowMs = typeof now === "number" ? now : 0;
  const committed = player.tachiaiCall === call;
  const firstPress = inTachiaiInputGrace(player, nowMs) && !player.tachiaiLaunched;
  if (!committed && !firstPress) return false;
  if (player.tachiaiLaunched && player.tachiaiCall !== call) return false;
  player.tachiaiCall = call;
  player.tachiaiLaunched = true;
  player.tachiaiActionPending = true;
  if (!(player.tachiaiUntil > nowMs)) player.tachiaiUntil = nowMs + TACHIAI_LIVE_MS;
  return true;
}

function endTachiaiAction(player, call) {
  if (!player || !player.tachiaiActionPending) return false;
  if (call && player.tachiaiCall !== call) return false;
  player.tachiaiActionPending = false;
  player.tachiaiActionConsumed = true;
  player.tachiaiUntil = 0;
  player.tachiaiCall = TACHIAI_CALL.STAND;
  return true;
}

function isTachiaiHenka(player, now) {
  return isTachiaiLive(player, now) && player.tachiaiCall === TACHIAI_CALL.HENKA;
}

function tachiaiDodgeHopY(ageMs, height = TACHIAI_DODGE_HOP_HEIGHT, hopMs = TACHIAI_DODGE_HOP_MS) {
  if (!(ageMs > 0) || !(hopMs > 0) || ageMs >= hopMs) return 0;
  const t = ageMs / hopMs;
  return height * 4 * t * (1 - t);
}

function tachiaiDodgeClearsSlap(player, now) {
  if (!player || !player.isDodging || player.isDodgeStartup) return false;
  if (player.tachiaiCall !== TACHIAI_CALL.DODGE_IN && player.tachiaiCall !== TACHIAI_CALL.DODGE_BACK) {
    return false;
  }
  if (!isTachiaiLive(player, now)) return false;
  const hopMs = player.tachiaiDodgeHopMs > 0 ? player.tachiaiDodgeHopMs : TACHIAI_DODGE_HOP_MS;
  const height = player.tachiaiDodgeHopHeight > 0 ? player.tachiaiDodgeHopHeight : TACHIAI_DODGE_HOP_HEIGHT;
  const age = now - (player.dodgeStartupEndTime || player.dodgeStartTime || now);
  return tachiaiDodgeHopY(age, height, hopMs) >= TACHIAI_DODGE_SLAP_CLEAR_PX;
}

function tachiaiCaption(callA, callB) {
  const a = CAPTION[callA] || null;
  const b = CAPTION[callB] || null;
  if (a && b && a !== b) return `${a}  ${b}`;
  return a || b || null;
}

const CPU_TACHIAI_WEIGHTS = Object.freeze({
  aggressive: Object.freeze({ charge: 45, slap: 25, grab: 15, henka: 10, dodgeIn: 5 }),
  balanced: Object.freeze({ slap: 35, charge: 20, henka: 15, grab: 10, parry: 10, dodgeIn: 10 }),
  defensive: Object.freeze({ slap: 30, parry: 20, henka: 20, dodgeBack: 15, grab: 15 }),
});

function cpuTachiaiWeights(aggression, lastHumanCall) {
  const table = CPU_TACHIAI_WEIGHTS[aggression] || CPU_TACHIAI_WEIGHTS.balanced;
  const weights = { ...table };
  if (lastHumanCall === TACHIAI_CALL.CHARGE) {
    weights.henka = (weights.henka || 0) + 25;
  } else if (lastHumanCall === TACHIAI_CALL.HENKA) {
    weights.grab = (weights.grab || 0) + 25;
    weights.slap = (weights.slap || 0) + 10;
  }
  return weights;
}

function pickCpuTachiaiCall(aggression, lastHumanCall, rng = Math.random) {
  const weights = cpuTachiaiWeights(aggression, lastHumanCall);
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = (typeof rng === "function" ? rng() : 0) * total;
  for (const [call, w] of entries) {
    roll -= w;
    if (roll < 0) return call;
  }
  return entries.length ? entries[entries.length - 1][0] : TACHIAI_CALL.SLAP;
}

function clearTachiaiCall(player) {
  if (!player) return;
  player.tachiaiCall = null;
  player.tachiaiIntent = null;
  player.tachiaiSealed = false;
  player.tachiaiUntil = 0;
  player.tachiaiHeld = null;
  player.tachiaiImmediatePush = false;
  player.tachiaiActionPending = false;
  player.tachiaiActionConsumed = false;
  player.tachiaiBufferedCall = null;
  player.tachiaiLaunched = false;
  player.tachiaiInputGraceUntil = 0;
  player.tachiaiRopeAfterDrive = false;
  player.tachiaiChargePunish = false;
  player.tachiaiChargePunishDir = 0;
}

function sealTachiai(room) {
  if (!room || room.tachiaiSealed) return;
  room.tachiaiSealed = true;
  const players = room.players || [];
  for (const player of players) {
    const opponent = players.find((p) => p !== player);
    if (player.isCPU && player.tachiaiIntent) {
      player.tachiaiCall = player.tachiaiIntent;
    } else {
      const heldCall = classifyTachiaiCall(
        player.tachiaiHeld,
        player.x,
        opponent ? opponent.x : player.x + 1
      );
      // A chord still held at the shout wins. A tap that was released still
      // counts, so buffering the move before HAKKIYOI is the move that comes out.
      player.tachiaiCall =
        heldCall !== TACHIAI_CALL.STAND
          ? heldCall
          : player.tachiaiBufferedCall || TACHIAI_CALL.STAND;
    }
    player.tachiaiSealed = true;
  }
}

function noteTachiaiContact(room, io, caption) {
  if (!room || !io || !caption || room.tachiaiContactEmitted) return false;
  if (!room.tachiaiCommitted) return false;
  room.tachiaiContactEmitted = true;
  if (typeof io.in === "function") {
    io.in(room.id).emit("tachiai_resolve", { caption, contact: true });
  }
  return true;
}

function inTachiaiInputGrace(player, now) {
  return !!(
    player &&
    player.tachiaiInputGraceUntil &&
    typeof now === "number" &&
    now < player.tachiaiInputGraceUntil
  );
}

function unsealTachiai(room) {
  if (!room) return;
  room.tachiaiSealed = false;
  room.tachiaiCommitted = false;
  room.tachiaiContactEmitted = false;
  for (const player of room.players || []) {
    const memory = player.tachiaiMemory;
    clearTachiaiCall(player);
    player.tachiaiMemory = memory;
  }
}

module.exports = {
  TACHIAI_HAKKIYOI_MS,
  TACHIAI_LIVE_MS,
  TACHIAI_INPUT_GRACE_MS,
  TACHIAI_CHARGE_HITSTUN_MS,
  TACHIAI_CHARGE_HIT_RECOVERY_MS,
  TACHIAI_CHARGE_HITSTOP_MS,
  TACHIAI_CHARGE_POWER,
  TACHIAI_SIDESTEP_TRAVEL,
  TACHIAI_DODGE_HOP_HEIGHT,
  TACHIAI_DODGE_HOP_MS,
  TACHIAI_DODGE_SLAP_CLEAR_PX,
  TACHIAI_CALL,
  CAPTION,
  emptyHeld,
  heldFromKeys,
  classifyTachiaiCall,
  isTachiaiLive,
  isTachiaiHenka,
  markTachiaiAction,
  endTachiaiAction,
  tachiaiDodgeHopY,
  tachiaiDodgeClearsSlap,
  tachiaiCaption,
  CPU_TACHIAI_WEIGHTS,
  cpuTachiaiWeights,
  pickCpuTachiaiCall,
  clearTachiaiCall,
  sealTachiai,
  noteTachiaiContact,
  inTachiaiInputGrace,
  unsealTachiai,
};
