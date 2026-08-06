import styled, { keyframes } from "styled-components";
import { isOutsideDohyo } from "../constants";
import getImageSrc from "./getImageSrc";
import { GROUND_LEVEL } from "./fighterAssets";
import { FONT_DISPLAY, FONT_UI, FONT_WEIGHT, TEXT_SHADOW_COMBAT, TEXT_SHADOW_COMBAT_HEAVY, TEXT_SHADOW_DISPLAY, TEXT_SHADOW_UI, TRACK } from "./menuTheme";

// Painted soles sit ~2.1% above the sprite box bottom (transparent padding
// under the feet — keep in sync with ICE_REFLECTION_FOOT_NUDGE_PCT).
// Procedural scaleY/skew MUST pivot here: origin at box-bottom ("center
// bottom") lifts/dips the visual feet whenever the body squashes.
// Transparent padding below may expand into the ice when squashing; that's
// invisible and keeps soles glued to GROUND_LEVEL.
export const FIGHTER_SOLE_TRANSFORM_ORIGIN = "50% calc(100% - 2.1%)";

const validProps = [
  "src",
  "style",
  "alt",
  "className",
  "id",
  "onClick",
  "pullSpeed",
  "pullHopHeight",
  "pullHopSpeed",
];

export const RedTintOverlay = styled.div
  .withConfig({
    shouldForwardProp: (prop) =>
      ![
        "$x",
        "$y",
        "$facing",
        "$isThrowing",
        "$isRingOutThrowCutscene",
        "$imageSrc",
      ].includes(prop),
  })
  .attrs((props) => ({
    style: {
      position: "absolute",
      width: "12.30%",
      height: "auto",
      aspectRatio: 1,
      left: `${(props.$x / 1280) * 100}%`,
      bottom: `${(props.$y / 720) * 100}%`,
      translate: "-50%",
      transform: props.$facing === 1 ? "scaleX(1)" : "scaleX(-1)",
      background: "rgba(156, 136, 255, 0.6)",
      zIndex: isOutsideDohyo(props.$x, props.$y) ? 0 : 101,
      pointerEvents: "none",
      mixBlendMode: "multiply",
      maskImage: `url(${props.$imageSrc})`,
      maskSize: "contain",
      maskRepeat: "no-repeat",
      maskPosition: "center",
      WebkitMaskImage: `url(${props.$imageSrc})`,
      WebkitMaskSize: "contain",
      WebkitMaskRepeat: "no-repeat",
      WebkitMaskPosition: "center",
    },
  }))``;

export const HurtTintOverlay = styled.div
  .withConfig({
    shouldForwardProp: (prop) =>
      ![
        "$x",
        "$y",
        "$facing",
        "$isThrowing",
        "$isRingOutThrowCutscene",
        "$imageSrc",
      ].includes(prop),
  })
  .attrs((props) => ({
    style: {
      position: "absolute",
      width: "12.30%",
      height: "auto",
      aspectRatio: 1,
      left: `${(props.$x / 1280) * 100}%`,
      bottom: `${(props.$y / 720) * 100}%`,
      translate: "-50%",
      transform: props.$facing === 1 ? "scaleX(1)" : "scaleX(-1)",
      background: "rgba(255, 64, 64, 0.55)",
      zIndex: isOutsideDohyo(props.$x, props.$y) ? 0 : 101,
      pointerEvents: "none",
      mixBlendMode: "multiply",
      maskImage: `url(${props.$imageSrc})`,
      maskSize: "contain",
      maskRepeat: "no-repeat",
      maskPosition: "center",
      WebkitMaskImage: `url(${props.$imageSrc})`,
      WebkitMaskSize: "contain",
      WebkitMaskRepeat: "no-repeat",
      WebkitMaskPosition: "center",
    },
  }))``;

export const TintedImage = styled.img
  .withConfig({
    shouldForwardProp: (prop) =>
      ![
        "$x",
        "$y",
        "$facing",
        "$isThrowing",
        "$isRingOutThrowCutscene",
        "$variant",
      ].includes(prop),
  })
  .attrs((props) => ({
    decoding: "async",
    style: {
      position: "absolute",
      left: `${(props.$x / 1280) * 100}%`,
      bottom: `${(props.$y / 720) * 100}%`,
      translate: "-50%",
      transform: props.$facing === 1 ? "scaleX(1)" : "scaleX(-1)",
      zIndex: isOutsideDohyo(props.$x, props.$y) ? 0 : 101,
      pointerEvents: "none",
      width: "min(12.30%, 379px)",

      height: "auto",
      willChange: "opacity, transform",
      filter:
        props.$variant === "hurt"
          ? "sepia(1) saturate(10000%) hue-rotate(0deg) brightness(.75)"
          : "sepia(1) saturate(10000%) hue-rotate(265deg) brightness(.75)",
      opacity: props.$variant === "hurt" ? 0.4 : 0.4,
      mixBlendMode: "color",
    },
  }))``;

export const getFighterPopFilter = (props) => {
  // Grab-arm overlay: never take status/rim glows. Body can glow; the arm
  // stays clean so Deep Grip / danger / push rims don't halo the flipper.
  if (props.$grabArmLayer) {
    return "none";
  }

  // Subject separation comes from CLARITY + the DoF behind them, NOT a glow.
  // A warm rim drop-shadow read as a cheesy halo (the cheap-mobile-game tell),
  // so it's gone. Instead: a tight all-around dark contour that cuts the
  // (often light) penguin bodies cleanly off the blurred crowd, plus a soft
  // downward shadow for grounding/weight. Zero color cast — clean cut-out read.
  const edge = "drop-shadow(0 0 clamp(0.5px, 0.06cqw, 1.5px) rgba(8, 5, 3, 0.6))";
  const ground = "drop-shadow(0 2px clamp(1px, 0.12cqw, 3px) rgba(0, 0, 0, 0.45))";

  // When the separate grab-arm overlay is stacked on the armless body, ANY
  // body drop-shadow (edge, ground, cool rim) rasterizes under the arm and
  // bleeds through the flipper's AA fringe — reads as a dark "shadow seam"
  // around the shoulder join (worst on light/white bodies). Kill dark
  // cut-out shadows on the body in those poses; the oval PlayerShadow still
  // grounds them. Status-color rims can still layer on with an empty base.
  const grabArmComposited =
    props.$inClinch ||
    props.$isGrabbing ||
    props.$isClinchPlanting ||
    props.$isAttemptingGrabThrow ||
    props.$isAttemptingPull ||
    props.$isGrabBellyFlopping ||
    props.$isBeingGrabBellyFlopped ||
    props.$isGrabFrontalForceOut ||
    props.$isBeingGrabFrontalForceOut ||
    (props.$isBeingGrabbed && props.$hasGrip);

  // Body under a composited arm drops dark cut-out shadows so they don't seam.
  const base = grabArmComposited ? "" : `${edge} ${ground}`;

  // Kill-throw victim: skip the soft ground drop-shadow. On a spinning / prone
  // body it reads as a second translucent penguin (the "ghost frame" in the
  // crash trail). Keep only the tight edge cut so they still separate from BG.
  if (props.$isClinchKillThrowVictim) {
    return edge;
  }

  if (props.$isAtTheRopes) {
    return `${base} drop-shadow(0 0 3px rgba(255, 55, 55, 0.9)) drop-shadow(0 0 1px rgba(255, 120, 120, 0.95))`;
  }
  // Clinch balance danger (<15 — every throw/pull is now a kill): the
  // SAME red rim as at-the-ropes, deliberately. Both mean "you can die right
  // now", so they share one visual grammar instead of inventing a new color.
  if (props.$inClinch && props.$balanceDanger) {
    return `${base} drop-shadow(0 0 3px rgba(255, 55, 55, 0.9)) drop-shadow(0 0 1px rgba(255, 120, 120, 0.95))`;
  }
  if (props.$isGrabBreaking) {
    return `${base} drop-shadow(0 0 8px rgba(0, 255, 128, 0.85))`;
  }
  // Perfect raw parry: tight ELECTRIC cyan rim — matches the hotter perfect
  // burst (regular hold stance keeps the deeper blue rim below).
  if (props.$isPerfectRawParrySuccess) {
    return `${base} drop-shadow(0 0 4px rgba(0, 230, 255, 0.95)) drop-shadow(0 0 1px rgba(200, 250, 255, 1))`;
  }
  // MATADOR: no body rim — sold by ash cape particles + pull pose, not glow.
  if (props.$isRawParrying) {
    return `${base} drop-shadow(0 0 6px rgba(0,130,255,0.9))`;
  }
  // Perfect Brace flash — bright cream flash on the defender who timed it.
  if (props.$isClinchPerfectBracing) {
    return `${base} drop-shadow(0 0 6px rgba(255, 236, 170, 0.95)) drop-shadow(0 0 2px rgba(255, 220, 120, 1))`;
  }
  // Deep grip holder: a subtle burnished-gold rim for the clinch's earned
  // advantage. Persistent (not a flash), so it stays quieter than the
  // perfect-parry electric cyan flash — "who holds the grip" at a glance.
  // Danger red above still outranks it: "you can die" always wins the rim.
  if (props.$inClinch && props.$hasDeepGrip) {
    return `${base} drop-shadow(0 0 5px rgba(255, 194, 71, 0.55))`;
  }
  // Committed Drive — slightly hotter push rim than light poke pressure.
  if (props.$inClinch && props.$isClinchCommittedDrive) {
    return `${base} drop-shadow(0 0 4px rgba(255, 140, 60, 0.55))`;
  }
  // MASTERY Phase 2 (2.1): broken posture no longer uses a colored rim —
  // the openable tell is the feet-planted teeter (see postureBrokenTeeter
  // on StyledImage / AnimatedFighterContainer). Keeping filter neutral here
  // so "vulnerable" reads as body language, not a status-glow.
  if (props.$isGrabPushing) {
    return `${base} drop-shadow(0 0 4px rgba(255, 150, 50, 0.5))`;
  }
  if (props.$isBeingGrabPushed) {
    return `${base} drop-shadow(0 0 4px rgba(255, 100, 50, 0.4))`;
  }
  if (props.$isGrabBellyFlopping || props.$isGrabFrontalForceOut) {
    return `${base} drop-shadow(0 0 8px rgba(255, 50, 50, 0.7))`;
  }
  if (props.$isBeingGrabBellyFlopped || props.$isBeingGrabFrontalForceOut) {
    return `${base} drop-shadow(0 0 6px rgba(255, 50, 50, 0.5))`;
  }
  // Attacker-side hit-confirm flash (A1 — Phase 3).
  // Layered ON TOP of the base outline rather than replacing it, so the player's
  // sprite never loses its standard rim while flashing. Tier scales the glow
  // radius/intensity — cinematic is roughly 3x a slap.
  // Color is warm gold/cream rather than red so it reads "I scored" not
  // "I'm injured" — and won't be confused with the at-the-ropes red glow.
  if (props.$attackerConfirmTier) {
    const tier = props.$attackerConfirmTier;
    const glow =
      tier === "cinematic" ? "drop-shadow(0 0 18px rgba(255, 220, 100, 1)) drop-shadow(0 0 32px rgba(255, 200, 80, 0.55))"
      : tier === "charged" ? "drop-shadow(0 0 12px rgba(255, 235, 160, 0.9))"
      : tier === "burst"   ? "drop-shadow(0 0 9px rgba(255, 230, 140, 0.78))"
      // Tip spacing — cooler white/ice rim so a clean tip confirm reads sharper
      // than a deep mash slap without borrowing charged's warm gold weight.
      : tier === "tip"     ? "drop-shadow(0 0 8px rgba(230, 248, 255, 0.85)) drop-shadow(0 0 14px rgba(160, 220, 255, 0.4))"
      :                       "drop-shadow(0 0 6px rgba(255, 245, 220, 0.62))";
    return `${base} ${glow}`;
  }
  // With arm overlay: no dark drop-shadow under the join (see grabArmComposited).
  if (grabArmComposited) {
    return "none";
  }
  // Neutral state: a WHISPER of cool steel-blue right on the silhouette edge,
  // layered over the dark cut-out contour. Kept extremely tight + low-alpha —
  // at any larger radius/opacity it reads as a cheesy glowing halo (the exact
  // thing the warm rim was killed for). This is just enough cold edge light to
  // hint the penguin is lit by the icy arena, not a rim you consciously notice.
  const coolRim =
    "drop-shadow(0 0 clamp(0.3px, 0.035cqw, 0.8px) rgba(160, 206, 236, 0.26))";
  return `${base} ${coolRim}`;
};

// Grab-arm overlay back/down nudge → appended AFTER scaleX so X is local
// (symmetric "back" per facing) and Y is screen-down. Values come from rAF
// (--grab-arm-nudge-*) with prop fallbacks for the first paint.
// Pace the Throw/Pull windup over the technique's authoritative startup so the
// tell completes on the impact frame. These animations were authored at 1.0s /
// 0.6s against a 220ms / 250ms startup, so they only ever played the first
// quarter of their motion — the wind-up barely moved, which is what made the
// tell hard to read. The server sends the committed duration (clinchThrowAnimMs)
// so a Deep Grip technique with a different startup stays in sync for free.
const techniqueTellDuration = (props, fallbackSeconds) => {
  const ms = props.$clinchThrowAnimMs;
  if (!Number.isFinite(ms) || ms <= 0) return `${fallbackSeconds}s`;
  return `${(ms / 1000).toFixed(3)}s`;
};

const grabArmNudge = (props) => {
  const x = props.$grabArmNudgeXPct || 0;
  const y = props.$grabArmNudgeYPct || 0;
  return (
    ` translateX(var(--grab-arm-nudge-x, ${x}%))` +
    ` translateY(var(--grab-arm-nudge-y, ${y}%))`
  );
};

// Body-hold pose: rest sheet is belt-aligned; rotate around the shoulder so
// the flipper tip swings UP toward the torso (+deg). Shoulder ≈ (56%, 42%)
// on sheet. Degree is a CSS var so the rAF loop can snap belt↔body on local
// M2 without waiting for a React re-render / server delta.
const GRAB_ARM_SHOULDER_DX_PCT = 6; // 56 - 50
const GRAB_ARM_SHOULDER_DY_PCT = -58; // 42 - 100
// Appended after body jolt/motion transforms in arm keyframes so CSS
// animation doesn't wipe the shoulder pivot (animated `transform` replaces
// the attrs transform that normally carries grabArmExtra).
const GRAB_ARM_PIVOT_AFTER_MOTION =
  ` translate(${GRAB_ARM_SHOULDER_DX_PCT}%, ${GRAB_ARM_SHOULDER_DY_PCT}%)` +
  ` rotate(var(--grab-arm-body-hold-deg, 0deg))` +
  ` scale(var(--grab-arm-body-hold-len, 1), 1)` +
  ` translate(${-GRAB_ARM_SHOULDER_DX_PCT}%, ${-GRAB_ARM_SHOULDER_DY_PCT}%)` +
  ` translateY(var(--grab-arm-body-hold-y, 0%))` +
  ` translateX(var(--grab-arm-nudge-x, 0%))` +
  ` translateY(var(--grab-arm-nudge-y, 0%))`;
const grabArmBodyHoldMotion = (props) => {
  const dx = GRAB_ARM_SHOULDER_DX_PCT;
  const dy = GRAB_ARM_SHOULDER_DY_PCT;
  // Per-frame vars (rAF): deg / y / len for grab-arm pose tweaks; len shortens
  // reach from the shoulder WITHOUT thinning (scaleX after rotate).
  return (
    ` translate(${dx}%, ${dy}%)` +
    ` rotate(var(--grab-arm-body-hold-deg, 0deg))` +
    ` scale(var(--grab-arm-body-hold-len, 1), 1)` +
    ` translate(${-dx}%, ${-dy}%)` +
    ` translateY(var(--grab-arm-body-hold-y, 0%))` +
    grabArmNudge(props)
  );
};

const grabArmExtra = (props) => {
  if (props.$grabArmBodyHoldActive) return grabArmBodyHoldMotion(props);
  return grabArmNudge(props);
};

// CSS animation string for the grab-arm overlay (and any motion twin that must
// stay glued to it — e.g. Deep Grip tip glow). Kept as one resolver so the arm
// img and the glow never drift onto different keyframes.
export const resolveGrabArmAnimation = (props) => {
  if (!props.$grabArmLayer) return null;
  if (props.$isGrabBellyFlopping) {
    return "grabBellyFlopLungeArm 0.4s cubic-bezier(0.25, 0.1, 0.25, 1) forwards";
  }
  if (props.$isBeingGrabBellyFlopped) {
    return "grabBellyFlopVictimArm 0.4s cubic-bezier(0.25, 0.1, 0.25, 1) forwards";
  }
  if (props.$isGrabFrontalForceOut) {
    return "grabFrontalForceOutArm 0.3s ease-out forwards";
  }
  if (props.$isBeingGrabFrontalForceOut) {
    return "grabFrontalForceOutVictimArm 0.3s ease-out forwards";
  }
  if (props.$isGrabSeparating) return "grabSeparatePushArm 0.3s ease-out";
  if (props.$isAttemptingPull || props.$isMatadorSuccess) {
    return `attemptingPullTugArm ${techniqueTellDuration(
      props,
      0.6
    )} cubic-bezier(0.4, 0.0, 0.6, 1.0) forwards`;
  }
  if (props.$isGrabPushing) return "grabPushStrainArm 0.3s ease-in-out infinite";
  if (props.$isBeingGrabPushed) {
    return "grabPushResistArm 0.3s ease-in-out infinite";
  }
  if (props.$isAttemptingGrabThrow) {
    return `attemptingGrabThrowPullArm ${techniqueTellDuration(
      props,
      1.0
    )} cubic-bezier(0.4, 0.0, 0.6, 1.0) forwards`;
  }
  if (props.$isGrabBreaking || props.$isGrabBreakCountered) {
    return "grabBreakShakeArm 0.1s ease-in-out infinite";
  }
  if (props.$isClinchJoltClashing) return "clinchJoltClashArm 0.25s ease-out";
  if (props.$isClinchJolting) {
    return "clinchJoltLungeArm 0.25s ease-out forwards";
  }
  if (props.$isBeingClinchJolted) return "clinchJoltRecoilArm 0.3s ease-out";
  if (props.$isClinchClashing || props.$isGrabTeching) {
    return "grabTechShakeArm 0.25s ease-in-out infinite";
  }
  if (props.$isClinchOpen || props.$clinchThrowFailStagger) {
    return "clinchOpenWobbleArm 0.42s ease-in-out infinite";
  }
  if (props.$inClinch && props.$balanceDanger) {
    return "clinchTeeterHeavyArm 0.95s ease-in-out infinite";
  }
  if (props.$inClinch && props.$balanceWobble) {
    return "clinchTeeterArm 1.5s ease-in-out infinite";
  }
  return "none";
};

// Flipper HAND center on belt-grab-arm-only.png (960²) — opaque centroid of
// the distal pad (along the shoulder→tip axis), not the tip extremity.
export const GRAB_ARM_HAND_X_PCT = 20.6;
export const GRAB_ARM_HAND_Y_PCT = 73.2;

// Smoky static bomb — overlapping soft blobs (same family as particle
// puffs). No hard disc / ring edges; white heat melts into orange smoke.
function bakeDeepGripOrb(size, seed) {
  if (typeof document === "undefined") return "";
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  const half = size / 2;
  let s = seed;
  const srand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  // Soft circular orange body — silhouette is a soft circle. Texture lives
  // INSIDE (no rim beads / circumference dots).
  {
    const base = ctx.createRadialGradient(half, half, 0, half, half, half * 0.88);
    base.addColorStop(0, "rgba(255,165,40,0.72)");
    base.addColorStop(0.4, "rgba(255,130,20,0.58)");
    base.addColorStop(0.7, "rgba(240,95,8,0.3)");
    base.addColorStop(0.88, "rgba(200,70,0,0.1)");
    base.addColorStop(1, "rgba(160,40,0,0)");
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.arc(half, half, half * 0.88, 0, Math.PI * 2);
    ctx.fill();
  }

  // Interior + near-edge smoke mottling — soft, subtle patches.
  const midBlobs = 10 + Math.floor(srand() * 4);
  for (let i = 0; i < midBlobs; i++) {
    const ang = srand() * Math.PI * 2;
    const dist = size * Math.sqrt(srand()) * 0.3;
    const bx = half + Math.cos(ang) * dist;
    const by = half + Math.sin(ang) * dist;
    const br = size * (0.06 + srand() * 0.08);
    const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    grad.addColorStop(0, "rgba(255,210,90,0.38)");
    grad.addColorStop(0.5, "rgba(255,150,30,0.16)");
    grad.addColorStop(1, "rgba(255,120,20,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  // Light outer haze wisps — sparse and quiet.
  const hazeBlobs = 4 + Math.floor(srand() * 2);
  for (let i = 0; i < hazeBlobs; i++) {
    const ang = srand() * Math.PI * 2;
    const dist = size * (0.28 + srand() * 0.1);
    const bx = half + Math.cos(ang) * dist;
    const by = half + Math.sin(ang) * dist;
    const br = size * (0.09 + srand() * 0.07);
    const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    grad.addColorStop(0, "rgba(255,150,30,0.14)");
    grad.addColorStop(0.55, "rgba(255,110,10,0.06)");
    grad.addColorStop(1, "rgba(200,60,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  // White-hot core — soft clustered blobs + a guaranteed centered wash so
  // orange smoke never eats the bottom of the core.
  {
    const coreWash = ctx.createRadialGradient(
      half, half, 0, half, half, size * 0.16
    );
    coreWash.addColorStop(0, "rgba(255,255,255,1)");
    coreWash.addColorStop(0.45, "rgba(255,252,240,0.92)");
    coreWash.addColorStop(0.78, "rgba(255,230,160,0.35)");
    coreWash.addColorStop(1, "rgba(255,200,80,0)");
    ctx.fillStyle = coreWash;
    ctx.beginPath();
    ctx.arc(half, half, size * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }
  const coreBlobs = 5 + Math.floor(srand() * 3);
  for (let i = 0; i < coreBlobs; i++) {
    const ang = srand() * Math.PI * 2;
    const dist = size * srand() * 0.05;
    const bx = half + Math.cos(ang) * dist;
    const by = half + Math.sin(ang) * dist;
    const br = size * (0.06 + srand() * 0.06);
    const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.4, "rgba(255,255,245,0.85)");
    grad.addColorStop(1, "rgba(255,200,80,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  // Static speckles — quiet crackle outside the core
  const flecks = 12 + Math.floor(srand() * 6);
  for (let i = 0; i < flecks; i++) {
    const ang = srand() * Math.PI * 2;
    const dist = size * (0.14 + Math.sqrt(srand()) * 0.3);
    const fx = half + Math.cos(ang) * dist;
    const fy = half + Math.sin(ang) * dist;
    const fr = size * (0.007 + srand() * 0.012);
    const a = 0.18 + srand() * 0.28;
    const grad = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr);
    grad.addColorStop(0, `rgba(255,255,255,${a})`);
    grad.addColorStop(1, "rgba(255,180,60,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(fx, fy, fr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soft circular alpha mask — round silhouette, slight room for outer haze.
  ctx.globalCompositeOperation = "destination-in";
  const mask = ctx.createRadialGradient(half, half, 0, half, half, half * 0.92);
  mask.addColorStop(0, "rgba(0,0,0,1)");
  mask.addColorStop(0.68, "rgba(0,0,0,1)");
  mask.addColorStop(0.86, "rgba(0,0,0,0.5)");
  mask.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = mask;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = "source-over";

  return c.toDataURL("image/png");
}

const DEEP_GRIP_ORB_A =
  typeof document !== "undefined" ? bakeDeepGripOrb(160, 11) : "";
const DEEP_GRIP_ORB_B =
  typeof document !== "undefined" ? bakeDeepGripOrb(160, 29) : "";

const deepGripSmokeBreath = keyframes`
  0%, 100% {
    transform: translate(-50%, -50%) scale(1) rotate(0deg);
  }
  35% {
    transform: translate(-50%, -50%) scale(1.08) rotate(3deg);
  }
  65% {
    transform: translate(-50%, -50%) scale(1.03) rotate(-2deg);
  }
`;

// Crackly crossfade between two baked smoke frames.
const deepGripStaticA = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.15; }
`;
const deepGripStaticB = keyframes`
  0%, 100% { opacity: 0.15; }
  50% { opacity: 1; }
`;

// Motion twin of the grab-arm overlay: same footprint / facing / shoulder
// pivot / nudges / arm keyframes / z-index as the arm img. Smoky static
// bomb on the flipper pad — baked blob cloud, not layered CSS circles.
export const DeepGripArmGlow = styled.div
  .withConfig({
    shouldForwardProp: (prop) => !prop.startsWith("$"),
  })
  .attrs((props) => ({
    style: {
      position: "absolute",
      left:
        props.$isAtTheRopes && props.$fighter === "player 1"
          ? `${((props.$x + (props.$x < 640 ? -5 : 5)) / 1280) * 100}%`
          : `${(props.$x / 1280) * 100}%`,
      bottom: `${(props.$y / 720) * 100}%`,
      translate: "-50%",
      "--facing": props.$facing === 1 ? "1" : "-1",
      width:
        props.$isAtTheRopes && props.$fighter === "player 1"
          ? "min(11.56%, 356px)"
          : "min(12.30%, 379px)",
      aspectRatio: "1 / 1",
      height: "auto",
      pointerEvents: "none",
      transformOrigin: FIGHTER_SOLE_TRANSFORM_ORIGIN,
      transform:
        props.$facing === 1
          ? `scaleX(1)${grabArmExtra(props)}`
          : `scaleX(-1)${grabArmExtra(props)}`,
      // Match the holder arm exactly — facing===1 wins at 106 over 105, so
      // the underhook arm's glow stays under the overhook flipper.
      zIndex:
        props.$grabArmLayer && !isOutsideDohyo(props.$x, props.$y)
          ? props.$grabArmLayer
          : 0,
      animation: resolveGrabArmAnimation(props) || "none",
      willChange: "transform",
      transition: "none",
    },
  }))`
  > i {
    position: absolute;
    left: ${GRAB_ARM_HAND_X_PCT}%;
    top: ${GRAB_ARM_HAND_Y_PCT}%;
    width: 21%;
    height: 21%;
    pointer-events: none;
    transform: translate(-50%, -50%);
    animation: ${deepGripSmokeBreath} 1.35s ease-in-out infinite;
  }

  > i::before,
  > i::after {
    content: "";
    position: absolute;
    inset: 0;
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
  }

  > i::before {
    background-image: url(${DEEP_GRIP_ORB_A});
    animation: ${deepGripStaticA} 0.28s steps(2, end) infinite;
  }

  > i::after {
    background-image: url(${DEEP_GRIP_ORB_B});
    animation: ${deepGripStaticB} 0.28s steps(2, end) infinite;
  }
`;

export const StyledImage = styled("img")
  .withConfig({
    shouldForwardProp: (prop) =>
      validProps.includes(prop) ||
      ![
        "fighter",
        "isJumping",
        "isDiving",
        "isAttacking",
        "isAttackCooldown",
        "isDodging",
        "isStrafing",
        "isRawParrying",
        "isMatadorParrying",
        "isMatadorSuccess",
        "isGuarding",
        "isGuardBlockSuccess",
        "isGrabBreaking",
        "isReady",
        "readyIntroComplete",
        "isHit",
        "lastHitType",
        "isDead",
        "x",
        "y",
        "facing",
        "yVelocity",
        "attackEndTime",
        "knockbackVelocity",
        "dodgeEndTime",
        "isAlreadyHit",
        "attackStartTime",
        "isSpaceBarPressed",
        "isThrowing",
        "throwStartTime",
        "throwEndTime",
        "throwOpponent",
        "throwingFacingDirection",
        "throwFacingDirection",
        "beingThrownFacingDirection",
        "isBeingThrown",
        "isGrabbing",
        "isBeingGrabbed",
        "isSlapAttack",
        "slapAnimation",
        "isBowing",
        "isThrowTeching",
        "isBeingPulled",
        "isBeingPushed",
        "grabState",
        "grabAttemptType",
        "throwCooldown",
        "grabCooldown",
        "isChargingAttack",
        "chargeStartTime",
        "chargeMaxDuration",
        "chargeAttackPower",
        "chargingFacingDirection",
        "isThrowingSalt",
        "isThrowingSnowball",
        "isSpawningPumoArmy",
        "saltCooldown",
        "grabStartTime",
        "grabbedOpponent",
        "grabAttemptStartTime",
        "throwTechCooldown",
        "isSlapParrying",
        "lastThrowAttemptTime",
        "lastGrabAttemptTime",
        "dodgeDirection",
        "justLandedFromDodge",
        "speedFactor",
        "sizeMultiplier",
        "isRecovering",
        "isRawParryStun",
        "isRawParrySuccess",
        "isPerfectRawParrySuccess",
        "isAtTheRopes",
        "isCrouchStance",
        "isCrouchStrafing",
        "isPowerSliding",
        "isGrabBreakCountered",
        "isAttemptingGrabThrow",
        "ritualAnimationSrc",
        "isLocalPlayer",
        "overrideSrc",
        "isCinematicKillAttacker",
        "isRopeJumping",
        "ropeJumpPhase",
        "isClinchKillThrowVictim",
        "isClinchKillPullVictim",
        "attackerConfirmTier",
      ].includes(prop),
  })
  .attrs((props) => ({
    src:
      props.$overrideSrc ||
      getImageSrc(
        props.$fighter,
        props.$isDiving,
        props.$isJumping,
        props.$isAttacking,
        props.$isDodging,
        props.$isStrafing,
        props.$isRawParrying || props.$isMatadorParrying,
        props.$isGrabBreaking,
        props.$isReady,
        props.$readyIntroComplete ?? true,
        props.$isHit,
        props.$isDead,
        props.$isSlapAttack,
        props.$isThrowing,
        props.$isGrabbing,
        props.$isGrabbingMovement,
        props.$isBeingGrabbed,
        props.$isThrowingSalt,
        props.$slapAnimation,
        props.$isBowing,
        props.$isThrowTeching,
        props.$isBeingPulled,
        props.$isBeingPushed,
        props.$grabState,
        props.$grabAttemptType,
        props.$isRecovering,
        props.$isRawParryStun,
        props.$isRawParrySuccess,
        props.$isPerfectRawParrySuccess,
        props.$isThrowingSnowball,
        props.$isSpawningPumoArmy,
        props.$isAtTheRopes,
        props.$isCrouchStance,
        props.$isCrouchStrafing,
        props.$isPowerSliding,
        props.$isGrabBreakCountered,
        props.$isGrabbingMovement,
        false, // dead positional slot — used to be props.$isGrabClashActive
        props.$isAttemptingGrabThrow,
        props.$ritualAnimationSrc,
        props.$isGrabPushing,
        props.$isBeingGrabPushed,
        // MATADOR success = pull yank pose (not AP success frames).
        props.$isAttemptingPull || props.$isMatadorSuccess,
        props.$isBeingPullReversaled,
        props.$isGrabSeparating,
        props.$isGrabBellyFlopping,
        props.$isBeingGrabBellyFlopped,
        props.$isGrabFrontalForceOut,
        props.$isBeingGrabFrontalForceOut,
        props.$isGrabTeching,
        props.$grabTechRole,
        props.$isGrabWhiffRecovery,
        props.$isRopeJumping,
        props.$ropeJumpPhase,
        props.$isDodgeRecovery,
        props.$isSidestepping,
        props.$isSidestepRecovery,
        props.$isChargingAttack,
        props.$hasGrip,
        props.$isClinchClashing,
        props.$isClinchPushing,
        props.$isClinchPlanting,
        props.$isResistingThrow,
        props.$isResistingPull,
        props.$isClinchKillThrowVictim,
        props.$isClinchKillPullVictim,
        props.$isClinchJolting,
        props.$isBeingClinchJolted,
        props.$isClinchJoltClashing,
        props.$clinchJoltRecovery,
        undefined, // isFlapping
        undefined, // flapPhase
        undefined, // flapFrame
        undefined, // flapUseDodgePose
        undefined, // isPalmThrust
        2, // palmThrustFrame
        props.$isLowKick || false,
        props.$isBeingThrown && !props.$showClinchKillThrowLanding,
        undefined, // slapFrame
        props.$isGuarding,
        props.$isGuardBlockSuccess,
        undefined, // rawParrySuccessFrame
        undefined // isApWhiffRecovering (GameFighter animated path owns this)
      ),
    style: {
      position: "absolute",
      left:
        props.$isAtTheRopes && props.$fighter === "player 1"
          ? `${((props.$x + (props.$x < 640 ? -5 : 5)) / 1280) * 100}%`
          : `${(props.$x / 1280) * 100}%`,
      bottom: `${(props.$y / 720) * 100}%`,
      translate: "-50%",
      "--facing": props.$facing === 1 ? "1" : "-1",
      "--charge-shake": props.$isChargingAttack
        ? `${Math.min(1 + (props.$chargeAttackPower || 0) / 100 * 5, 6)}px`
        : "0px",
      // PROCEDURAL ANIMATION: per-hit reaction amplitude (set from the
      // player_hit payload — attack type / counter / punish / momentum).
      // The hitSquash-family keyframes multiply every deviation from the
      // identity pose by this, so a counter charged slam visibly deforms
      // the victim far more than a poke. 1 = the legacy fixed squash.
      "--impact-amp": props.$impactAmp ?? 1,
      transform:
        props.$isAtTheRopes && props.$fighter === "player 1"
          ? props.$facing === 1
            ? "scaleX(1) scaleY(0.95)"
            : "scaleX(-1) scaleY(0.95)"
          // Pull-kill belly-laying: small nudge onto the ice.
          : props.$isClinchKillPullVictim
          ? props.$facing === 1
            ? "scaleX(1) translateY(5%)"
            : "scaleX(-1) translateY(5%)"
          // Throw-kill landing art has more bottom padding — push further down.
          : props.$showClinchKillThrowLanding
          ? props.$facing === 1
            ? "scaleX(1) translateY(10%)"
            : "scaleX(-1) translateY(10%)"
          : props.$facing === 1
          ? `scaleX(1)${grabArmExtra(props)}`
          : `scaleX(-1)${grabArmExtra(props)}`,
      // Grab-arm overlay: rides above BOTH locked bodies (which sit at ~98–99
      // during a grab). $grabArmLayer carries the resolved z (facing decides
      // which of the two arms wins). Still sinks with the body when outside the
      // ring, so fall through to the normal formula (→ 0) in that case.
      // Strike layering:
      //  • Extending slap/palm attacker rises above the opponent so the limb
      //    paints on top even before hit-confirm (no separate arm art yet).
      //  • Strike victim sinks under so the limb stays readable on connect.
      // Parry never sets isHit — defense stays equal-layer.
      zIndex: props.$grabArmLayer && !isOutsideDohyo(props.$x, props.$y)
        ? props.$grabArmLayer
        : props.$isClinchKillPullVictim
        ? (isOutsideDohyo(props.$x, props.$y) ? 0 : 102)
        : isOutsideDohyo(props.$x, props.$y)
        ? 0
        : props.$isCinematicKillAttacker
        ? 100
        : props.$isRopeJumping || props.$isSlideJumping
        ? 101
        : props.$isThrowing || props.$isDodging || props.$isGrabbing
        ? 98
        : props.$isHit &&
          (props.$lastHitType === "slap" ||
            props.$lastHitType === "charged" ||
            props.$lastHitType === "flap" ||
            props.$lastHitType === "lowKick") &&
          !props.$isBeingThrown
        ? 97
        : props.$isStrikeExtending
        ? 100
        : 99,
      // Grab-arm: no rim/status glows (getFighterPopFilter early-outs to none).
      filter: getFighterPopFilter(props),
      // Kill-throw spin only while airborne (pre-landing pose). On true impact
      // (!isBeingThrown) play a heavy ground-plant squash — dead weight into the
      // ice with a short jiggle settle, no bounce arc.
      // Grab-arm overlay: any body transform anim must be mirrored here (with
      // shoulder pivot appended) or the flipper detaches mid-wobble / jolt.
      animation: props.$grabArmLayer
        ? resolveGrabArmAnimation(props)
        : props.$isClinchKillThrowVictim
        ? props.$showClinchKillThrowLanding
          ? props.$isBeingThrown
            ? "none"
            : "clinchKillThrowLandSquash 0.58s cubic-bezier(0.22, 0.55, 0.3, 1) forwards"
          : "clinchKillThrowSpin 0.9s ease-in forwards"
        : props.$isClinchKillPullVictim
        // Pull kill uses the belly-laying pose (already a flat-on-ice image) and
        // the server drives the heavy bounce/slide via Y position — so no CSS
        // rotation/transform here, just hold the sprite.
        ? "none"
        : props.$isAtTheRopes
        ? "atTheRopesWobble 0.3s ease-in-out infinite"
        : props.$isRopeJumping && props.$ropeJumpPhase === "landing"
        ? "ropeJumpLandBounce 0.18s ease-out forwards"
        : props.$isRopeJumping
        ? "none"
        : props.$isGrabBellyFlopping
        ? "grabBellyFlopLunge 0.4s cubic-bezier(0.25, 0.1, 0.25, 1) forwards"
        : props.$isBeingGrabBellyFlopped
        ? "grabBellyFlopVictim 0.4s cubic-bezier(0.25, 0.1, 0.25, 1) forwards"
        : props.$isGrabFrontalForceOut
        ? "grabFrontalForceOut 0.3s ease-out forwards"
        : props.$isBeingGrabFrontalForceOut
        ? "grabFrontalForceOutVictim 0.3s ease-out forwards"
        : props.$isBeingPullReversaled
        ? "none"
        : props.$isGrabSeparating
        ? "grabSeparatePush 0.3s ease-out"
        : props.$isAttemptingPull || props.$isMatadorSuccess
        ? `attemptingPullTug ${techniqueTellDuration(
            props,
            0.6
          )} cubic-bezier(0.4, 0.0, 0.6, 1.0) forwards`
        : props.$isGrabPushing
        ? "grabPushStrain 0.3s ease-in-out infinite"
        : props.$isBeingGrabPushed
        ? "grabPushResist 0.3s ease-in-out infinite"
        : props.$isAttemptingGrabThrow
        ? `attemptingGrabThrowPull ${techniqueTellDuration(
            props,
            1.0
          )} cubic-bezier(0.4, 0.0, 0.6, 1.0) forwards`
        : props.$isSlapParryRecovering
        ? "slapParryRecoil 0.2s cubic-bezier(0.22, 1, 0.36, 1)"
        : props.$isRawParrySuccess || props.$isPerfectRawParrySuccess
        ? "rawParryRecoil 0.5s ease-out"
        : props.$isGrabBreaking
        ? "grabBreakShake 0.1s ease-in-out infinite"
        : props.$isGrabBreakCountered
        ? "grabBreakShake 0.1s ease-in-out infinite"
        : props.$isRawParrying
        ? "parryActivationFlash 0.22s ease-out forwards"
        : props.$isClinchJoltClashing
        ? "clinchJoltClash 0.25s ease-out"
        : props.$isClinchJolting
        ? "clinchJoltLunge 0.25s ease-out forwards"
        : props.$isBeingClinchJolted
        ? "clinchJoltRecoil 0.3s ease-out"
        : props.$isClinchClashing
        ? "grabTechShake 0.25s ease-in-out infinite"
        : props.$isGrabTeching
        ? "grabTechShake 0.25s ease-in-out infinite"
        : props.$isClinchOpen || props.$clinchThrowFailStagger
        ? "clinchOpenWobble 0.42s ease-in-out infinite"
        // Brace attempt cycle. Sits below every higher-priority combat pose
        // above (throw, jolt, clash, tech, Open) so it never fights them, and
        // above the idle teeter so a spent Brace is still readable. This is what
        // makes baiting a Brace legible: you can SEE the weight go down and
        // reset, which is the window to strike.
        : props.$inClinch && props.$clinchBracePhase === "active"
        ? "clinchBraceSet 0.27s cubic-bezier(0.2, 0.8, 0.3, 1) forwards"
        : props.$inClinch && props.$clinchBracePhase === "settle"
        ? "clinchBraceSettle 0.22s ease-out forwards"
        : props.$inClinch && props.$balanceDanger
        ? "clinchTeeterHeavy 0.95s ease-in-out infinite"
        : props.$inClinch && props.$balanceWobble
        ? "clinchTeeter 1.5s ease-in-out infinite"
        // Hit reaction: amp-scaled contact squash only (no post-squash stagger).
        : props.$isHit
        ? "hitSquash 0.28s cubic-bezier(0.22, 0.6, 0.35, 1)"
        // Attacker contact recoil: their own body jolts back a beat when a
        // strike CONNECTS (impact resistance — the target has mass). Sits
        // above slapRush/attackPunch so it briefly interrupts the swing loop.
        : props.$attackerRecoil
        ? "attackerContactRecoil 0.18s cubic-bezier(0.25, 0.9, 0.4, 1)"
        : props.$isSlideJumping
        ? "slideJumpPop 0.22s cubic-bezier(0.15, 0.85, 0.25, 1) forwards"
        : props.$isDodging
        ? "dashJump 0.26s linear forwards"
        : props.$justLandedFromDodge &&
          !props.$isPowerSliding &&
          !props.$isBraking
        ? "dashLanding 0.2s ease-out forwards"
        : props.$isPowerSliding &&
          !props.$isBeingGrabbed &&
          !props.$isBeingThrown &&
          !props.$isThrowing &&
          !props.$isGrabbing &&
          !props.$isDead
        ? "powerSlide 0.15s ease-in-out infinite"
        : props.$isChargingAttack && !props.$isReady
        ? "chargeShake 0.08s linear infinite"
        : props.$isAttacking && !props.$isSlapAttack
        ? "attackPunch 0.2s ease-out"
        : props.$isSlapAttack
        ? "slapRush 0.12s ease-in-out infinite"
        // MASTERY Phase 2: broken-posture teeter is an IDLE tell only.
        // It used to sit above dodge/charge and stole dashJump + chargeShake
        // whenever balance was broken — flat dashes and silent charge holds.
        : props.$isPostureBroken &&
          !props.$isAttacking &&
          !props.$isDodging &&
          !props.$isRopeJumping &&
          !props.$isThrowing &&
          !props.$isGrabbing &&
          !props.$isBeingGrabbed &&
          !props.$isBeingPulled &&
          !props.$isBeingPushed &&
          !props.$isThrowTeching &&
          !props.$isRecovering &&
          !props.$isChargingAttack &&
          !props.$isThrowingSalt &&
          !props.$isThrowingSnowball &&
          !props.$isSpawningPumoArmy &&
          !props.$isBowing &&
          !props.$isGrabPushing &&
          !props.$isBeingGrabPushed &&
          !props.$isAttemptingPull &&
          !props.$isBeingPullReversaled &&
          !props.$isGrabSeparating &&
          !props.$isGrabBellyFlopping &&
          !props.$isBeingGrabBellyFlopped &&
          !props.$isGrabFrontalForceOut &&
          !props.$isBeingGrabFrontalForceOut
        ? "postureBrokenTeeter 2.1s linear infinite"
        : !props.$isAttacking &&
          !props.$isDodging &&
          !props.$isRopeJumping &&
          !props.$isThrowing &&
          !props.$isGrabbing &&
          !props.$isBeingGrabbed &&
          !props.$isBeingPulled &&
          !props.$isBeingPushed &&
          !props.$isThrowTeching &&
          !props.$isRecovering &&
          !props.$isThrowingSalt &&
          !props.$isThrowingSnowball &&
          !props.$isSpawningPumoArmy &&
          !props.$isBowing &&
          !props.$isGrabPushing &&
          !props.$isBeingGrabPushed &&
          !props.$isAttemptingPull &&
          !props.$isBeingPullReversaled &&
          !props.$isGrabSeparating &&
          !props.$isGrabBellyFlopping &&
          !props.$isBeingGrabBellyFlopped &&
          !props.$isGrabFrontalForceOut &&
          !props.$isBeingGrabFrontalForceOut
        ? "breathe 1.5s ease-in-out infinite"
        : "none",
      width:
        // Clinch kill-throw landing art reads small at the default fighter
        // footprint (extra transparent padding in the PNG). Bump ONLY that
        // pose — spin / pull-kill / everyone else stay on the standard size.
        props.$showClinchKillThrowLanding
          ? "min(12.75%, 393px)"
          : props.$isAtTheRopes && props.$fighter === "player 1"
          ? "min(11.56%, 356px)"
          : "min(12.30%, 379px)",
      height: "auto",
      // Kill-throw promotes/demotes layers hard (spin → landing). Leaving
      // will-change:transform on promotes a compositor layer that can smear a
      // translucent "ghost" of the old pose into the smoke trail.
      willChange: props.$isClinchKillThrowVictim ? "auto" : "transform",
      pointerEvents: "none",
      transformOrigin:
        props.$isClinchKillThrowVictim && !props.$showClinchKillThrowLanding
          ? "center center"
          : props.$poseSoleOrigin || FIGHTER_SOLE_TRANSFORM_ORIGIN,
      transition: "none",
    },
  }))`
  @keyframes parryActivationFlash {
    0% { filter: drop-shadow(0 0 clamp(1px, 0.08cqw, 2.5px) #000) drop-shadow(0 0 12px rgba(100,200,255,1)); }
    35% { filter: drop-shadow(0 0 clamp(1px, 0.08cqw, 2.5px) #000) drop-shadow(0 0 8px rgba(0,150,255,0.95)); }
    100% { filter: drop-shadow(0 0 clamp(1px, 0.08cqw, 2.5px) #000) drop-shadow(0 0 6px rgba(0,130,255,0.9)); }
  }
  @keyframes grabBreakFlash {
    0% { filter: drop-shadow(0 0 clamp(1px, 0.08cqw, 2.5px) #000) drop-shadow(0 0 2px rgba(0, 255, 128, 0.45)); }
    25% { filter: drop-shadow(0 0 clamp(1px, 0.08cqw, 2.5px) #000) drop-shadow(0 0 12px rgba(0, 255, 128, 0.95)); }
    50% { filter: drop-shadow(0 0 clamp(1px, 0.08cqw, 2.5px) #000) drop-shadow(0 0 8px rgba(0, 255, 128, 0.75)); }
    75% { filter: drop-shadow(0 0 clamp(1px, 0.08cqw, 2.5px) #000) drop-shadow(0 0 12px rgba(0, 255, 128, 0.95)); }
    100% { filter: drop-shadow(0 0 clamp(1px, 0.08cqw, 2.5px) #000) drop-shadow(0 0 2px rgba(0, 255, 128, 0.45)); }
  }
  /* FEET RULE: procedural juice never moves sole Y. Pivot at sole origin
     (not box-bottom). Lean with skewX — rotate lifts a foot corner into ice.
     translateY is reserved for intentional airborne / ground-plant poses. */
  /* Every deviation from the identity pose scales with --impact-amp (see the
     attrs var above) — same shape at amp 1, ~2x deformation on a max hit. */
  @keyframes hitSquash {
    0% { transform: scaleX(var(--facing, 1)) scaleY(1) translateX(0) skewX(0deg); }
    6% { transform: scaleX(calc(var(--facing, 1) * (1 + 0.25 * var(--impact-amp, 1)))) scaleY(calc(1 - 0.25 * var(--impact-amp, 1))) translateX(calc(var(--facing, 1) * -3% * var(--impact-amp, 1))) skewX(calc(var(--facing, 1) * 2deg * var(--impact-amp, 1))); }
    18% { transform: scaleX(calc(var(--facing, 1) * (1 - 0.12 * var(--impact-amp, 1)))) scaleY(calc(1 + 0.12 * var(--impact-amp, 1))) translateX(calc(var(--facing, 1) * -5% * var(--impact-amp, 1))) skewX(calc(var(--facing, 1) * -4deg * var(--impact-amp, 1))); }
    35% { transform: scaleX(calc(var(--facing, 1) * (1 + 0.08 * var(--impact-amp, 1)))) scaleY(calc(1 - 0.08 * var(--impact-amp, 1))) translateX(calc(var(--facing, 1) * -2% * var(--impact-amp, 1))) skewX(calc(var(--facing, 1) * 1.5deg * var(--impact-amp, 1))); }
    55% { transform: scaleX(calc(var(--facing, 1) * (1 - 0.04 * var(--impact-amp, 1)))) scaleY(calc(1 + 0.04 * var(--impact-amp, 1))) translateX(calc(var(--facing, 1) * -0.5% * var(--impact-amp, 1))) skewX(calc(var(--facing, 1) * -0.5deg * var(--impact-amp, 1))); }
    100% { transform: scaleX(var(--facing, 1)) scaleY(1) translateX(0) skewX(0deg); }
  }
  /* Attacker-side contact recoil — a short backward jolt + settle when their
     strike lands. Fixed amplitude (the ATTACKER's mass doesn't change with
     hit strength; the victim's --impact-amp carries the grading). */
  @keyframes attackerContactRecoil {
    0% { transform: scaleX(var(--facing, 1)) scaleY(1) translateX(0) skewX(0deg); }
    30% { transform: scaleX(calc(var(--facing, 1) * 1.05)) scaleY(0.96) translateX(calc(var(--facing, 1) * -1.5%)) skewX(calc(var(--facing, 1) * -1.5deg)); }
    65% { transform: scaleX(calc(var(--facing, 1) * 0.99)) scaleY(1.008) translateX(calc(var(--facing, 1) * -0.35%)) skewX(calc(var(--facing, 1) * 0.35deg)); }
    100% { transform: scaleX(var(--facing, 1)) scaleY(1) translateX(0) skewX(0deg); }
  }
  @keyframes attackPunch {
    0% { transform: scaleX(var(--facing, 1)) scaleY(1); }
    25% { transform: scaleX(calc(var(--facing, 1) * 0.9)) scaleY(1.1); }
    55% { transform: scaleX(calc(var(--facing, 1) * 1.12)) scaleY(0.92); }
    100% { transform: scaleX(var(--facing, 1)) scaleY(1); }
  }
  @keyframes chargeShake {
    0%, 100% { transform: scaleX(var(--facing, 1)) translateX(var(--charge-shake, 0px)); }
    50% { transform: scaleX(var(--facing, 1)) translateX(calc(var(--charge-shake, 0px) * -1)); }
  }
  /* Idle breath — scaleY from soles so only torso/head rises; feet stay planted. */
  @keyframes breathe {
    0%, 100% { transform: scaleX(var(--facing, 1)) scaleY(1); }
    50% { transform: scaleX(var(--facing, 1)) scaleY(1.03); }
  }
  @keyframes powerSlide {
    0%, 100% { transform: scaleX(calc(var(--facing, 1) * 1.06)) scaleY(0.92); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    50% { transform: scaleX(calc(var(--facing, 1) * 1.08)) scaleY(0.88); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
  }
  /* Rope land: settle onto the ice — never translateY(+) below the plant. */
  @keyframes ropeJumpLandBounce {
    0% { transform: scaleX(var(--facing, 1)) translateY(-8%) scaleY(1); }
    35% { transform: scaleX(var(--facing, 1)) translateY(0%) scaleY(0.94); }
    65% { transform: scaleX(var(--facing, 1)) translateY(0%) scaleY(1.02); }
    100% { transform: scaleX(var(--facing, 1)) translateY(0%) scaleY(1); }
  }
  /* Ropes lean — skewX + lateral only. No rotate / translateY (those dipped soles). */
  @keyframes atTheRopesWobble {
    0%, 100% { transform: scaleX(var(--facing, 1)) scaleY(0.95) skewX(0deg) translateX(0); }
    25% { transform: scaleX(var(--facing, 1)) scaleY(0.95) skewX(calc(var(--facing, 1) * -4deg)) translateX(-2px); }
    50% { transform: scaleX(var(--facing, 1)) scaleY(0.95) skewX(calc(var(--facing, 1) * 2deg)) translateX(1px); }
    75% { transform: scaleX(var(--facing, 1)) scaleY(0.95) skewX(calc(var(--facing, 1) * -2deg)) translateX(-1px); }
  }
  /* Clinch balance teeter — skewX shear anchored at the soles. Unlike
     rotation, a shear leaves the ENTIRE sole line pinned in place: the feet
     never lift or slide, only the upper body sways sideways over the planted
     base. That's the physical "losing my footing" read. Asymmetric angles
     sell weight. */
  @keyframes clinchTeeter {
    0%, 100% { transform: scaleX(var(--facing, 1)) skewX(0deg); }
    32% { transform: scaleX(var(--facing, 1)) skewX(-1.7deg); }
    68% { transform: scaleX(var(--facing, 1)) skewX(1.2deg); }
  }
  @keyframes clinchTeeterHeavy {
    0%, 100% { transform: scaleX(var(--facing, 1)) skewX(0deg); }
    30% { transform: scaleX(var(--facing, 1)) skewX(-4deg); }
    55% { transform: scaleX(var(--facing, 1)) skewX(2.2deg); }
    78% { transform: scaleX(var(--facing, 1)) skewX(-2.4deg); }
  }
  /* Open-field broken-posture tell — feet pinned (sole origin).
     Mostly still, with short tremor bursts so it reads "shaken / open"
     instead of a constant drunk sway. Tiny skew + micro lateral jitter. */
  @keyframes postureBrokenTeeter {
    0%, 12%, 38%, 62%, 100% { transform: scaleX(var(--facing, 1)) skewX(0deg) translateX(0); }
    /* burst 1 */
    14% { transform: scaleX(var(--facing, 1)) skewX(-1.1deg) translateX(-0.6px); }
    17% { transform: scaleX(var(--facing, 1)) skewX(0.9deg) translateX(0.5px); }
    20% { transform: scaleX(var(--facing, 1)) skewX(-0.5deg) translateX(-0.3px); }
    23% { transform: scaleX(var(--facing, 1)) skewX(0deg) translateX(0); }
    /* burst 2 — slightly later / softer */
    64% { transform: scaleX(var(--facing, 1)) skewX(0.8deg) translateX(0.4px); }
    67% { transform: scaleX(var(--facing, 1)) skewX(-0.7deg) translateX(-0.4px); }
    70% { transform: scaleX(var(--facing, 1)) skewX(0.35deg) translateX(0.2px); }
    73% { transform: scaleX(var(--facing, 1)) skewX(0deg) translateX(0); }
  }
  /* Failed clinch throw/pull — one-shot stuffed feel (kept for reference /
     non-loop call sites). Live Open uses clinchOpenWobble below. */
  @keyframes clinchFailStumble {
    0% { transform: scaleX(var(--facing, 1)) scaleY(1); }
    22% { transform: scaleX(calc(var(--facing, 1) * 1.14)) scaleY(0.86); }
    55% { transform: scaleX(calc(var(--facing, 1) * 0.97)) scaleY(1.03); }
    100% { transform: scaleX(var(--facing, 1)) scaleY(1); }
  }
  /* OPEN — looping readable vulnerability for the whole Open window.
     Soft sway + squash so stars aren't the only tell. */
  @keyframes clinchOpenWobble {
    0%, 100% {
      transform: scaleX(var(--facing, 1)) translateX(0) scaleY(1) skewX(0deg);
      filter: brightness(1);
    }
    35% {
      transform: scaleX(calc(var(--facing, 1) * 1.06)) translateX(calc(var(--facing, 1) * -3px))
        scaleY(0.94) skewX(calc(var(--facing, 1) * -2deg));
      filter: brightness(1.18);
    }
    70% {
      transform: scaleX(calc(var(--facing, 1) * 0.98)) translateX(calc(var(--facing, 1) * 2px))
        scaleY(1.02) skewX(calc(var(--facing, 1) * 1.5deg));
      filter: brightness(1.08);
    }
  }
  /* BRACE ATTEMPT — weight dropping into the hold. Compression + a small lean
     away from the opponent, settling into a wide planted stance. Deliberately
     quiet: it is a stance read, not a status effect, and it must not compete
     with Open's wobble or the throw/jolt poses that outrank it. */
  @keyframes clinchBraceSet {
    0% {
      transform: scaleX(var(--facing, 1)) translateX(0) scaleY(1);
    }
    40% {
      transform: scaleX(calc(var(--facing, 1) * 1.07)) translateX(calc(var(--facing, 1) * -4px))
        scaleY(0.9);
    }
    100% {
      transform: scaleX(calc(var(--facing, 1) * 1.04)) translateX(calc(var(--facing, 1) * -2px))
        scaleY(0.95);
    }
  }
  /* SETTLE — the weight coming back up. This is the readable "spent" beat: the
     window where an attacker can punish a fished Brace. */
  @keyframes clinchBraceSettle {
    0% {
      transform: scaleX(calc(var(--facing, 1) * 1.04)) translateX(calc(var(--facing, 1) * -2px))
        scaleY(0.95);
    }
    55% {
      transform: scaleX(calc(var(--facing, 1) * 0.985)) translateX(calc(var(--facing, 1) * 1px))
        scaleY(1.025);
    }
    100% {
      transform: scaleX(var(--facing, 1)) translateX(0) scaleY(1);
    }
  }
  @keyframes grabTechShake {
    0% { transform: scaleX(var(--facing, 1)) translateX(0px); }
    12% { transform: scaleX(var(--facing, 1)) translateX(-7px); }
    25% { transform: scaleX(var(--facing, 1)) translateX(7px); }
    37% { transform: scaleX(var(--facing, 1)) translateX(-6px); }
    50% { transform: scaleX(var(--facing, 1)) translateX(6px); }
    62% { transform: scaleX(var(--facing, 1)) translateX(-4px); }
    75% { transform: scaleX(var(--facing, 1)) translateX(4px); }
    87% { transform: scaleX(var(--facing, 1)) translateX(-2px); }
    100% { transform: scaleX(var(--facing, 1)) translateX(0px); }
  }
  /* Grab-arm wobble twin — same motion + brightness flash as the body.
     Brightness only (no drop-shadow/rim): arm filter stays "none" so we
     don't paint a backdrop halo around the flipper. */
  @keyframes clinchOpenWobbleArm {
    0%, 100% {
      transform: scaleX(var(--facing, 1)) translateX(0) scaleY(1) skewX(0deg)${GRAB_ARM_PIVOT_AFTER_MOTION};
      filter: brightness(1);
    }
    35% {
      transform: scaleX(calc(var(--facing, 1) * 1.06)) translateX(calc(var(--facing, 1) * -3px))
        scaleY(0.94) skewX(calc(var(--facing, 1) * -2deg))${GRAB_ARM_PIVOT_AFTER_MOTION};
      filter: brightness(1.18);
    }
    70% {
      transform: scaleX(calc(var(--facing, 1) * 0.98)) translateX(calc(var(--facing, 1) * 2px))
        scaleY(1.02) skewX(calc(var(--facing, 1) * 1.5deg))${GRAB_ARM_PIVOT_AFTER_MOTION};
      filter: brightness(1.08);
    }
  }
  @keyframes clinchTeeterArm {
    0%, 100% { transform: scaleX(var(--facing, 1)) skewX(0deg)${GRAB_ARM_PIVOT_AFTER_MOTION}; }
    32% { transform: scaleX(var(--facing, 1)) skewX(-1.7deg)${GRAB_ARM_PIVOT_AFTER_MOTION}; }
    68% { transform: scaleX(var(--facing, 1)) skewX(1.2deg)${GRAB_ARM_PIVOT_AFTER_MOTION}; }
  }
  @keyframes clinchTeeterHeavyArm {
    0%, 100% { transform: scaleX(var(--facing, 1)) skewX(0deg)${GRAB_ARM_PIVOT_AFTER_MOTION}; }
    30% { transform: scaleX(var(--facing, 1)) skewX(-4deg)${GRAB_ARM_PIVOT_AFTER_MOTION}; }
    55% { transform: scaleX(var(--facing, 1)) skewX(2.2deg)${GRAB_ARM_PIVOT_AFTER_MOTION}; }
    78% { transform: scaleX(var(--facing, 1)) skewX(-2.4deg)${GRAB_ARM_PIVOT_AFTER_MOTION}; }
  }
  @keyframes grabTechShakeArm {
    0% { transform: scaleX(var(--facing, 1)) translateX(0px)${GRAB_ARM_PIVOT_AFTER_MOTION}; }
    12% { transform: scaleX(var(--facing, 1)) translateX(-7px)${GRAB_ARM_PIVOT_AFTER_MOTION}; }
    25% { transform: scaleX(var(--facing, 1)) translateX(7px)${GRAB_ARM_PIVOT_AFTER_MOTION}; }
    37% { transform: scaleX(var(--facing, 1)) translateX(-6px)${GRAB_ARM_PIVOT_AFTER_MOTION}; }
    50% { transform: scaleX(var(--facing, 1)) translateX(6px)${GRAB_ARM_PIVOT_AFTER_MOTION}; }
    62% { transform: scaleX(var(--facing, 1)) translateX(-4px)${GRAB_ARM_PIVOT_AFTER_MOTION}; }
    75% { transform: scaleX(var(--facing, 1)) translateX(4px)${GRAB_ARM_PIVOT_AFTER_MOTION}; }
    87% { transform: scaleX(var(--facing, 1)) translateX(-2px)${GRAB_ARM_PIVOT_AFTER_MOTION}; }
    100% { transform: scaleX(var(--facing, 1)) translateX(0px)${GRAB_ARM_PIVOT_AFTER_MOTION}; }
  }
  @keyframes grabBreakShakeArm {
    0%   { transform: scaleX(var(--facing, 1)) translateX(0px)${GRAB_ARM_PIVOT_AFTER_MOTION}; }
    25%  { transform: scaleX(var(--facing, 1)) translateX(-5px)${GRAB_ARM_PIVOT_AFTER_MOTION}; }
    50%  { transform: scaleX(var(--facing, 1)) translateX(5px)${GRAB_ARM_PIVOT_AFTER_MOTION}; }
    75%  { transform: scaleX(var(--facing, 1)) translateX(-4px)${GRAB_ARM_PIVOT_AFTER_MOTION}; }
    100% { transform: scaleX(var(--facing, 1)) translateX(0px)${GRAB_ARM_PIVOT_AFTER_MOTION}; }
  }
  @keyframes attemptingGrabThrowPullArm {
    0% { transform: scaleX(var(--facing, 1)) scaleY(1)${GRAB_ARM_PIVOT_AFTER_MOTION}; transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    15% { transform: scaleX(calc(var(--facing, 1) * 0.95)) scaleY(1.08)${GRAB_ARM_PIVOT_AFTER_MOTION}; transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    40% { transform: scaleX(calc(var(--facing, 1) * 0.93)) scaleY(1.10)${GRAB_ARM_PIVOT_AFTER_MOTION}; transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    70% { transform: scaleX(calc(var(--facing, 1) * 0.96)) scaleY(1.06)${GRAB_ARM_PIVOT_AFTER_MOTION}; transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    100% { transform: scaleX(var(--facing, 1)) scaleY(1)${GRAB_ARM_PIVOT_AFTER_MOTION}; transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
  }
  @keyframes grabPushStrainArm {
    0%, 100% { transform: scaleX(var(--facing, 1)) translateX(0) scaleY(1)${GRAB_ARM_PIVOT_AFTER_MOTION}; transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    50% { transform: scaleX(calc(var(--facing, 1) * 1.03)) translateX(calc(var(--facing, 1) * -2px)) scaleY(0.97)${GRAB_ARM_PIVOT_AFTER_MOTION}; transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
  }
  @keyframes grabPushResistArm {
    0%, 100% { transform: scaleX(var(--facing, 1)) translateX(0) scaleY(1)${GRAB_ARM_PIVOT_AFTER_MOTION}; transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    30% { transform: scaleX(calc(var(--facing, 1) * 0.97)) translateX(calc(var(--facing, 1) * 1px)) scaleY(1.02)${GRAB_ARM_PIVOT_AFTER_MOTION}; transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    70% { transform: scaleX(calc(var(--facing, 1) * 0.98)) translateX(calc(var(--facing, 1) * 2px)) scaleY(1.01)${GRAB_ARM_PIVOT_AFTER_MOTION}; transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
  }
  @keyframes attemptingPullTugArm {
    0% { transform: scaleX(var(--facing, 1)) scaleY(1)${GRAB_ARM_PIVOT_AFTER_MOTION}; transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    12% { transform: scaleX(var(--facing, 1)) scaleY(0.95)${GRAB_ARM_PIVOT_AFTER_MOTION}; transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    28% { transform: scaleX(var(--facing, 1)) scaleY(0.94)${GRAB_ARM_PIVOT_AFTER_MOTION}; transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    45% { transform: scaleX(var(--facing, 1)) scaleY(1)${GRAB_ARM_PIVOT_AFTER_MOTION}; transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    62% { transform: scaleX(var(--facing, 1)) scaleY(0.94)${GRAB_ARM_PIVOT_AFTER_MOTION}; transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    78% { transform: scaleX(var(--facing, 1)) scaleY(0.96)${GRAB_ARM_PIVOT_AFTER_MOTION}; transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    92% { transform: scaleX(var(--facing, 1)) scaleY(1)${GRAB_ARM_PIVOT_AFTER_MOTION}; transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    100% { transform: scaleX(var(--facing, 1)) scaleY(0.97)${GRAB_ARM_PIVOT_AFTER_MOTION}; transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
  }
  @keyframes grabSeparatePushArm {
    0% { transform: scaleX(var(--facing, 1)) translateX(0) scaleY(1)${GRAB_ARM_PIVOT_AFTER_MOTION}; transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    40% { transform: scaleX(calc(var(--facing, 1) * 1.04)) translateX(calc(var(--facing, 1) * 3px)) scaleY(0.97)${GRAB_ARM_PIVOT_AFTER_MOTION}; transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    100% { transform: scaleX(var(--facing, 1)) translateX(0) scaleY(1)${GRAB_ARM_PIVOT_AFTER_MOTION}; transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
  }
  @keyframes grabBellyFlopLungeArm {
    0% { transform: scaleX(var(--facing, 1)) scaleY(1) translateY(0)${GRAB_ARM_PIVOT_AFTER_MOTION}; transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    40% { transform: scaleX(calc(var(--facing, 1) * 1.15)) scaleY(0.85) translateY(0)${GRAB_ARM_PIVOT_AFTER_MOTION}; transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    70% { transform: scaleX(calc(var(--facing, 1) * 1.2)) scaleY(0.75) translateY(2px)${GRAB_ARM_PIVOT_AFTER_MOTION}; transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    100% { transform: scaleX(calc(var(--facing, 1) * 1.25)) scaleY(0.7) translateY(4px)${GRAB_ARM_PIVOT_AFTER_MOTION}; transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
  }
  @keyframes grabBellyFlopVictimArm {
    0% { transform: scaleX(var(--facing, 1)) scaleY(1) translateY(0)${GRAB_ARM_PIVOT_AFTER_MOTION}; transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    30% { transform: scaleX(calc(var(--facing, 1) * 0.85)) scaleY(1.1) translateY(-4px)${GRAB_ARM_PIVOT_AFTER_MOTION}; transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    70% { transform: scaleX(calc(var(--facing, 1) * 1.15)) scaleY(0.8) translateY(2px)${GRAB_ARM_PIVOT_AFTER_MOTION}; transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    100% { transform: scaleX(calc(var(--facing, 1) * 1.3)) scaleY(0.65) translateY(5px)${GRAB_ARM_PIVOT_AFTER_MOTION}; transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
  }
  @keyframes grabFrontalForceOutArm {
    0% { transform: scaleX(var(--facing, 1)) scaleY(1) translateY(0)${GRAB_ARM_PIVOT_AFTER_MOTION}; transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    50% { transform: scaleX(calc(var(--facing, 1) * 1.1)) scaleY(0.92) translateX(calc(var(--facing, 1) * -3px))${GRAB_ARM_PIVOT_AFTER_MOTION}; transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    100% { transform: scaleX(calc(var(--facing, 1) * 1.05)) scaleY(0.95) translateX(calc(var(--facing, 1) * -5px))${GRAB_ARM_PIVOT_AFTER_MOTION}; transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
  }
  @keyframes grabFrontalForceOutVictimArm {
    0% { transform: scaleX(var(--facing, 1)) scaleY(1) translateY(0)${GRAB_ARM_PIVOT_AFTER_MOTION}; transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    40% { transform: scaleX(calc(var(--facing, 1) * 0.9)) scaleY(1.05) translateY(-2px)${GRAB_ARM_PIVOT_AFTER_MOTION}; transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    100% { transform: scaleX(calc(var(--facing, 1) * 0.85)) scaleY(0.9) translateY(3px)${GRAB_ARM_PIVOT_AFTER_MOTION}; transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
  }
  /* 250ms telegraphed startup — coil, then lunge into contact as impact resolves */
  @keyframes clinchJoltLunge {
    0% { transform: scaleX(var(--facing, 1)) translateX(0) scaleY(1); }
    35% { transform: scaleX(calc(var(--facing, 1) * 1.12)) translateX(calc(var(--facing, 1) * -18px)) scaleY(0.88); }
    75% { transform: scaleX(calc(var(--facing, 1) * 1.18)) translateX(calc(var(--facing, 1) * 22px)) scaleY(0.92); }
    100% { transform: scaleX(calc(var(--facing, 1) * 1.1)) translateX(calc(var(--facing, 1) * 14px)) scaleY(0.96); }
  }
  @keyframes clinchJoltRecoil {
    0% { transform: scaleX(var(--facing, 1)) translateX(0) skewX(0deg) scaleY(1); }
    20% { transform: scaleX(var(--facing, 1)) translateX(calc(var(--facing, 1) * 14px)) skewX(calc(var(--facing, 1) * -6deg)) scaleY(0.92); }
    50% { transform: scaleX(var(--facing, 1)) translateX(calc(var(--facing, 1) * 8px)) skewX(calc(var(--facing, 1) * -3deg)) scaleY(0.96); }
    100% { transform: scaleX(var(--facing, 1)) translateX(0) skewX(0deg) scaleY(1); }
  }
  @keyframes clinchJoltClash {
    0% { transform: scaleX(var(--facing, 1)) translateX(0) scaleY(1); }
    20% { transform: scaleX(calc(var(--facing, 1) * 0.88)) translateX(calc(var(--facing, 1) * -10px)) scaleY(0.90); }
    50% { transform: scaleX(calc(var(--facing, 1) * 1.06)) translateX(calc(var(--facing, 1) * 3px)) scaleY(0.96); }
    100% { transform: scaleX(var(--facing, 1)) translateX(0) scaleY(1); }
  }
  /* Grab-arm twins — same body motion, then shoulder pivot / nudge so the
     flipper stays glued through the lunge (plain jolt keyframes would wipe it). */
  @keyframes clinchJoltLungeArm {
    0% { transform: scaleX(var(--facing, 1)) translateX(0) scaleY(1)${GRAB_ARM_PIVOT_AFTER_MOTION}; }
    35% { transform: scaleX(calc(var(--facing, 1) * 1.12)) translateX(calc(var(--facing, 1) * -18px)) scaleY(0.88)${GRAB_ARM_PIVOT_AFTER_MOTION}; }
    75% { transform: scaleX(calc(var(--facing, 1) * 1.18)) translateX(calc(var(--facing, 1) * 22px)) scaleY(0.92)${GRAB_ARM_PIVOT_AFTER_MOTION}; }
    100% { transform: scaleX(calc(var(--facing, 1) * 1.1)) translateX(calc(var(--facing, 1) * 14px)) scaleY(0.96)${GRAB_ARM_PIVOT_AFTER_MOTION}; }
  }
  @keyframes clinchJoltRecoilArm {
    0% { transform: scaleX(var(--facing, 1)) translateX(0) skewX(0deg) scaleY(1)${GRAB_ARM_PIVOT_AFTER_MOTION}; }
    20% { transform: scaleX(var(--facing, 1)) translateX(calc(var(--facing, 1) * 14px)) skewX(calc(var(--facing, 1) * -6deg)) scaleY(0.92)${GRAB_ARM_PIVOT_AFTER_MOTION}; }
    50% { transform: scaleX(var(--facing, 1)) translateX(calc(var(--facing, 1) * 8px)) skewX(calc(var(--facing, 1) * -3deg)) scaleY(0.96)${GRAB_ARM_PIVOT_AFTER_MOTION}; }
    100% { transform: scaleX(var(--facing, 1)) translateX(0) skewX(0deg) scaleY(1)${GRAB_ARM_PIVOT_AFTER_MOTION}; }
  }
  @keyframes clinchJoltClashArm {
    0% { transform: scaleX(var(--facing, 1)) translateX(0) scaleY(1)${GRAB_ARM_PIVOT_AFTER_MOTION}; }
    20% { transform: scaleX(calc(var(--facing, 1) * 0.88)) translateX(calc(var(--facing, 1) * -10px)) scaleY(0.90)${GRAB_ARM_PIVOT_AFTER_MOTION}; }
    50% { transform: scaleX(calc(var(--facing, 1) * 1.06)) translateX(calc(var(--facing, 1) * 3px)) scaleY(0.96)${GRAB_ARM_PIVOT_AFTER_MOTION}; }
    100% { transform: scaleX(var(--facing, 1)) translateX(0) scaleY(1)${GRAB_ARM_PIVOT_AFTER_MOTION}; }
  }
  @keyframes grabBreakShake {
    0%   { transform: scaleX(var(--facing, 1)) translateX(0px); }
    25%  { transform: scaleX(var(--facing, 1)) translateX(-5px); }
    50%  { transform: scaleX(var(--facing, 1)) translateX(5px); }
    75%  { transform: scaleX(var(--facing, 1)) translateX(-4px); }
    100% { transform: scaleX(var(--facing, 1)) translateX(0px); }
  }
  @keyframes slapRush {
    0%, 100% { transform: scaleX(var(--facing, 1)); filter: drop-shadow(0 0 clamp(1px, 0.08cqw, 2.5px) #000); }
    50% { transform: scaleX(var(--facing, 1)); filter: drop-shadow(0 0 clamp(1px, 0.08cqw, 2.5px) #000); }
  }
  @keyframes slapParryRecoil {
    /* Clean single-impulse lean-back — no squash/stretch, no oscillation. The
       body snaps back from the impact (away from the opponent) then smoothly
       settles. Reads as a crisp recoil rather than a rubbery jiggle. The real
       gain/lose ground travel is the server knockback slide underneath this. */
    0% { transform: scaleX(var(--facing, 1)) translateX(0); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    30% { transform: scaleX(var(--facing, 1)) translateX(calc(var(--facing, 1) * -7px)); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    100% { transform: scaleX(var(--facing, 1)) translateX(0); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
  }
  /* Throw pull strain — stretch from soles only (no translateY hop). */
  @keyframes attemptingGrabThrowPull {
    0% { transform: scaleX(var(--facing, 1)) scaleY(1); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    15% { transform: scaleX(calc(var(--facing, 1) * 0.95)) scaleY(1.08); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    40% { transform: scaleX(calc(var(--facing, 1) * 0.93)) scaleY(1.10); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    70% { transform: scaleX(calc(var(--facing, 1) * 0.96)) scaleY(1.06); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    100% { transform: scaleX(var(--facing, 1)) scaleY(1); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
  }
  @keyframes grabPushStrain {
    0%, 100% { transform: scaleX(var(--facing, 1)) translateX(0) scaleY(1); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    50% { transform: scaleX(calc(var(--facing, 1) * 1.03)) translateX(calc(var(--facing, 1) * -2px)) scaleY(0.97); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
  }
  @keyframes grabPushResist {
    0%, 100% { transform: scaleX(var(--facing, 1)) translateX(0) scaleY(1); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    30% { transform: scaleX(calc(var(--facing, 1) * 0.97)) translateX(calc(var(--facing, 1) * 1px)) scaleY(1.02); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    70% { transform: scaleX(calc(var(--facing, 1) * 0.98)) translateX(calc(var(--facing, 1) * 2px)) scaleY(1.01); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
  }
  @keyframes attemptingPullTug {
    0% { transform: scaleX(var(--facing, 1)) scaleY(1); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    12% { transform: scaleX(var(--facing, 1)) scaleY(0.95); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    28% { transform: scaleX(var(--facing, 1)) scaleY(0.94); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    45% { transform: scaleX(var(--facing, 1)) scaleY(1); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    62% { transform: scaleX(var(--facing, 1)) scaleY(0.94); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    78% { transform: scaleX(var(--facing, 1)) scaleY(0.96); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    92% { transform: scaleX(var(--facing, 1)) scaleY(1); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    100% { transform: scaleX(var(--facing, 1)) scaleY(0.97); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
  }
  @keyframes grabSeparatePush {
    0% { transform: scaleX(var(--facing, 1)) translateX(0) scaleY(1); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    40% { transform: scaleX(calc(var(--facing, 1) * 1.04)) translateX(calc(var(--facing, 1) * 3px)) scaleY(0.97); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    100% { transform: scaleX(var(--facing, 1)) translateX(0) scaleY(1); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
  }
  /* Belly flop / force-out: intentional body-plant into ice — translateY kept. */
  @keyframes grabBellyFlopLunge {
    0% { transform: scaleX(var(--facing, 1)) scaleY(1) translateY(0); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    40% { transform: scaleX(calc(var(--facing, 1) * 1.15)) scaleY(0.85) translateY(0); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    70% { transform: scaleX(calc(var(--facing, 1) * 1.2)) scaleY(0.75) translateY(2px); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    100% { transform: scaleX(calc(var(--facing, 1) * 1.25)) scaleY(0.7) translateY(4px); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
  }
  @keyframes grabBellyFlopVictim {
    0% { transform: scaleX(var(--facing, 1)) scaleY(1) translateY(0); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    30% { transform: scaleX(calc(var(--facing, 1) * 0.85)) scaleY(1.1) translateY(-4px); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    70% { transform: scaleX(calc(var(--facing, 1) * 1.15)) scaleY(0.8) translateY(2px); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    100% { transform: scaleX(calc(var(--facing, 1) * 1.3)) scaleY(0.65) translateY(5px); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
  }
  @keyframes grabFrontalForceOut {
    0% { transform: scaleX(var(--facing, 1)) scaleY(1) translateY(0); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    50% { transform: scaleX(calc(var(--facing, 1) * 1.1)) scaleY(0.92) translateX(calc(var(--facing, 1) * -3px)); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    100% { transform: scaleX(calc(var(--facing, 1) * 1.05)) scaleY(0.95) translateX(calc(var(--facing, 1) * -5px)); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
  }
  @keyframes grabFrontalForceOutVictim {
    0% { transform: scaleX(var(--facing, 1)) scaleY(1) translateY(0); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    40% { transform: scaleX(calc(var(--facing, 1) * 0.9)) scaleY(1.05) translateY(-2px); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    100% { transform: scaleX(calc(var(--facing, 1) * 0.85)) scaleY(0.9) translateY(3px); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
  }
  /* ── Dash jump, split into three real beats (see GameFighter sprite swap) ──
     The dodge is now a proper jump with bookend frames:
       - dashWindup  plays during isDodgeStartup on the braced recovering pose:
         a quick crouch that gathers before the leap (anticipation).
       - dashJump    plays during the active phase on the tucked dodging pose:
         an explosive pushoff off the crouch, a real apex with hang time, then
         a gravity-accelerated fall. Linear timing so the height values (not the
         easing curve) shape the arc.
       - dashLanding plays on justLandedFromDodge back on the recovering pose:
         an impact squash that catches the landing before the ice slide.
     All squash is VERTICAL only (scaleY, sole origin) so scaleX stays
     locked to facing and the character never stretches horizontally. */
  /* Intentional hop — translateY is the jump. Crouch squash uses sole origin. */
  @keyframes slideJumpPop {
    0% {
      transform: scaleX(var(--facing, 1)) scaleY(0.82) translateY(0);
      transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN};
    }
    35% {
      transform: scaleX(calc(var(--facing, 1) * 0.92)) scaleY(1.14)
        translateY(-4%);
      transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN};
    }
    100% {
      transform: scaleX(var(--facing, 1)) scaleY(1) translateY(0);
      transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN};
    }
  }

  @keyframes dashJump {
    /* One continuous animation over the whole dodge (startup + active), driven
       by the single predicted isDodging flag so it never restarts mid-air.
       0-19% (~50ms) = grounded windup crouch; 19-100% (~210ms) = the jump arc.
       The arc peak is deliberately LOW (~15%) so it stays proportional to the
       ~118px of forward travel — a tall arc over a short distance reads as
       fake/sped-up. This is a low forward hop, not a vertical pop. */
    0%   { transform: scaleX(var(--facing, 1)) translateY(0)    scaleY(1);    transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; } /* windup start */
    11%  { transform: scaleX(var(--facing, 1)) translateY(0)    scaleY(0.92); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; } /* crouching */
    19%  { transform: scaleX(var(--facing, 1)) translateY(0)    scaleY(0.9);  transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; } /* crouch bottom (leaving ground) */
    33%  { transform: scaleX(var(--facing, 1)) translateY(-9%)  scaleY(1);    transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; } /* pushoff */
    52%  { transform: scaleX(var(--facing, 1)) translateY(-14%) scaleY(1);    transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; } /* rising */
    60%  { transform: scaleX(var(--facing, 1)) translateY(-15%) scaleY(1);    transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; } /* apex */
    68%  { transform: scaleX(var(--facing, 1)) translateY(-13%) scaleY(1);    transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; } /* hang */
    86%  { transform: scaleX(var(--facing, 1)) translateY(-6%)  scaleY(1);    transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; } /* falling */
    100% { transform: scaleX(var(--facing, 1)) translateY(0)    scaleY(1);    transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; } /* touchdown */
  }
  @keyframes dashLanding {
    0%   { transform: scaleX(var(--facing, 1)) translateY(0) scaleY(0.9);  transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; } /* impact */
    40%  { transform: scaleX(var(--facing, 1)) translateY(0) scaleY(1.01); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; } /* rebound */
    100% { transform: scaleX(var(--facing, 1)) translateY(0) scaleY(1);    transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; } /* settle */
  }
  @keyframes dashInvincibilityFlash {
    0% { filter: drop-shadow(0 0 clamp(1px, 0.08cqw, 2.5px) #000) brightness(2.5) saturate(0.2); }
    40% { filter: drop-shadow(0 0 clamp(1px, 0.08cqw, 2.5px) #000) brightness(2.2) saturate(0.3); }
    70% { filter: drop-shadow(0 0 clamp(1px, 0.08cqw, 2.5px) #000) brightness(1.3) saturate(0.7); }
    100% { filter: drop-shadow(0 0 clamp(1px, 0.08cqw, 2.5px) #000) brightness(1) saturate(1); }
  }
  /* Impact juice only — no translateX. Horizontal slide read as "walking
     in the parry-success pose" while feet should stay planted. */
  @keyframes rawParryRecoil {
    0% { transform: scaleX(var(--facing, 1)) scaleY(1); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    10% { transform: scaleX(calc(var(--facing, 1) * 1.05)) scaleY(0.95); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    25% { transform: scaleX(calc(var(--facing, 1) * 0.92)) scaleY(1.08); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    45% { transform: scaleX(calc(var(--facing, 1) * 1.03)) scaleY(0.97); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    65% { transform: scaleX(calc(var(--facing, 1) * 0.98)) scaleY(1.02); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    85% { transform: scaleX(calc(var(--facing, 1) * 1.01)) scaleY(0.99); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    100% { transform: scaleX(var(--facing, 1)) scaleY(1); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
  }
  @keyframes clinchKillThrowSpin {
    0% { transform: scaleX(var(--facing, 1)) rotate(0deg); transform-origin: center center; }
    30% { transform: scaleX(var(--facing, 1)) rotate(30deg); transform-origin: center center; }
    100% { transform: scaleX(var(--facing, 1)) rotate(90deg); transform-origin: center center; }
  }
  /* Heavy body-slam plant: intentional flatten into ice (art padding + plant). */
  @keyframes clinchKillThrowLandSquash {
    0%   { transform: scaleX(calc(var(--facing, 1) * 1.42)) scaleY(0.42) translateY(22%); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    16%  { transform: scaleX(calc(var(--facing, 1) * 1.18)) scaleY(0.72) translateY(14%); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    34%  { transform: scaleX(calc(var(--facing, 1) * 0.94)) scaleY(1.06) translateY(9%);  transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    48%  { transform: scaleX(calc(var(--facing, 1) * 1.08)) scaleY(0.9)  translateY(12%); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    62%  { transform: scaleX(calc(var(--facing, 1) * 0.97)) scaleY(1.03) translateY(9.5%); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    78%  { transform: scaleX(calc(var(--facing, 1) * 1.03)) scaleY(0.97) translateY(10.5%); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
    100% { transform: scaleX(var(--facing, 1)) scaleY(1) translateY(10%); transform-origin: ${FIGHTER_SOLE_TRANSFORM_ORIGIN}; }
  }
`;

export const RitualSpriteContainer = styled.div.attrs((props) => ({
  style: {
    position: "absolute",
    width: "min(12.30%, 379px)",
    aspectRatio: "1",
    left: `${(props.$x / 1280) * 100}%`,
    bottom: `${(props.$y / 720) * 100}%`,
    translate: "-50%",
    transform: props.$facing === 1 ? "scaleX(1)" : "scaleX(-1)",
    overflow: "hidden",
    zIndex: 99,
    pointerEvents: "none",
    clipPath: "inset(0 1.5% 0 1.5%)",
  },
}))``;

export const RitualSpriteImage = styled.img.attrs((props) => {
  const safeFrame = Math.max(0, Math.min(props.$frame, props.$frameCount - 1));
  const offsetPercent = (safeFrame / props.$frameCount) * 100;
  return {
    style: {
      position: "relative",
      display: "block",
      height: "100%",
      width: "auto",
      transform: `translate3d(-${offsetPercent}%, 0, 0)`,
      willChange: "transform",
      backfaceVisibility: "hidden",
      filter: "drop-shadow(0 0 clamp(1px, 0.08cqw, 2.5px) #000)",
    },
  };
})``;

export const AnimatedFighterContainer = styled.div
  .withConfig({
    shouldForwardProp: (prop) =>
      ![
        "x", "y", "facing", "fighter", "isThrowing", "isDodging",
        "isGrabbing", "isRingOutThrowCutscene", "isAtTheRopes", "isHit", "isBurstKnockback",
        "isRawParryStun", "isCinematicKillAttacker", "isSidestepping",
        "attackerConfirmTier", "isPostureBroken",
      ].includes(prop),
  })
  .attrs((props) => {
    const sidestepping = props.$isSidestepping;
    const sidestepScale = sidestepping ? 1.07 : 1;
    const baseScaleX = props.$facing === 1
      ? (props.$isRawParryStun ? 1.08 : 1)
      : (props.$isRawParryStun ? -1.08 : -1);
    const finalScaleX = baseScaleX * (baseScaleX > 0 ? sidestepScale : sidestepScale);

    return {
      style: {
        position: "absolute",
        width: "min(12.30%, 379px)",
        aspectRatio: "1",
        left:
          props.$isAtTheRopes && props.$fighter === "player 1"
            ? `${((props.$x + (props.$x < 640 ? -5 : 5)) / 1280) * 100}%`
            : `${(props.$x / 1280) * 100}%`,
        bottom: `${(props.$y / 720) * 100}%`,
        translate: "-50%",
        "--facing": props.$facing === 1 ? "1" : "-1",
        // Per-hit reaction amplitude — same contract as StyledImage's var
        // (hitSquashContainer / burstHitSquash keyframes scale with it).
        "--impact-amp": props.$impactAmp ?? 1,
        transform: `scaleX(${finalScaleX}) scaleY(${sidestepScale})`,
        overflow: "hidden",
        zIndex: isOutsideDohyo(props.$x, props.$y)
          ? 0
          : props.$isCinematicKillAttacker
          ? 100
          : sidestepping
          ? 101
          : props.$isThrowing || props.$isDodging || props.$isGrabbing
          ? 98
          : 99,
        pointerEvents: "none",
        clipPath: "inset(0 0.5% 0 0.5%)",
        // Sole origin so sidestep scaleY / hit squash never lift painted feet.
        transformOrigin: FIGHTER_SOLE_TRANSFORM_ORIGIN,
        animation: props.$isBurstKnockback
          ? "burstHitSquash 0.35s cubic-bezier(0.22, 0.6, 0.35, 1)"
          : props.$isHit
          ? "hitSquashContainer 0.28s cubic-bezier(0.22, 0.6, 0.35, 1)"
          // MASTERY Phase 2 (2.1): feet-pinned openable teeter on spritesheet
          // path too (hit squash still outranks — impact feedback wins).
          : props.$isPostureBroken
          ? "postureBrokenTeeter 2.1s linear infinite"
          : "none",
      },
    };
  })`
  @keyframes postureBrokenTeeter {
    0%, 12%, 38%, 62%, 100% { transform: scaleX(var(--facing, 1)) skewX(0deg) translateX(0); }
    14% { transform: scaleX(var(--facing, 1)) skewX(-1.1deg) translateX(-0.6px); }
    17% { transform: scaleX(var(--facing, 1)) skewX(0.9deg) translateX(0.5px); }
    20% { transform: scaleX(var(--facing, 1)) skewX(-0.5deg) translateX(-0.3px); }
    23% { transform: scaleX(var(--facing, 1)) skewX(0deg) translateX(0); }
    64% { transform: scaleX(var(--facing, 1)) skewX(0.8deg) translateX(0.4px); }
    67% { transform: scaleX(var(--facing, 1)) skewX(-0.7deg) translateX(-0.4px); }
    70% { transform: scaleX(var(--facing, 1)) skewX(0.35deg) translateX(0.2px); }
    73% { transform: scaleX(var(--facing, 1)) skewX(0deg) translateX(0); }
  }
  /* Amp-scaled like StyledImage's hitSquash — sole-pivoted, skewX lean (no rotate). */
  @keyframes hitSquashContainer {
    0% { transform: scaleX(var(--facing, 1)) scaleY(1) translateX(0) skewX(0deg); }
    6% { transform: scaleX(calc(var(--facing, 1) * (1 + 0.25 * var(--impact-amp, 1)))) scaleY(calc(1 - 0.25 * var(--impact-amp, 1))) translateX(calc(var(--facing, 1) * -3% * var(--impact-amp, 1))) skewX(calc(var(--facing, 1) * 2deg * var(--impact-amp, 1))); }
    18% { transform: scaleX(calc(var(--facing, 1) * (1 - 0.12 * var(--impact-amp, 1)))) scaleY(calc(1 + 0.12 * var(--impact-amp, 1))) translateX(calc(var(--facing, 1) * -5% * var(--impact-amp, 1))) skewX(calc(var(--facing, 1) * -4deg * var(--impact-amp, 1))); }
    35% { transform: scaleX(calc(var(--facing, 1) * (1 + 0.08 * var(--impact-amp, 1)))) scaleY(calc(1 - 0.08 * var(--impact-amp, 1))) translateX(calc(var(--facing, 1) * -2% * var(--impact-amp, 1))) skewX(calc(var(--facing, 1) * 1.5deg * var(--impact-amp, 1))); }
    55% { transform: scaleX(calc(var(--facing, 1) * (1 - 0.04 * var(--impact-amp, 1)))) scaleY(calc(1 + 0.04 * var(--impact-amp, 1))) translateX(calc(var(--facing, 1) * -0.5% * var(--impact-amp, 1))) skewX(calc(var(--facing, 1) * -0.5deg * var(--impact-amp, 1))); }
    100% { transform: scaleX(var(--facing, 1)) scaleY(1) translateX(0) skewX(0deg); }
  }

  /* Burst keyframes start bigger than hitSquash; the amp for burst hits is
     kept near 1 in GameFighter's grading so max deformation stays sane. */
  @keyframes burstHitSquash {
    0% { transform: scaleX(var(--facing, 1)) scaleY(1) translateX(0) skewX(0deg); }
    5% { transform: scaleX(calc(var(--facing, 1) * (1 + 0.35 * var(--impact-amp, 1)))) scaleY(calc(1 - 0.35 * var(--impact-amp, 1))) translateX(calc(var(--facing, 1) * -4% * var(--impact-amp, 1))) skewX(calc(var(--facing, 1) * 3deg * var(--impact-amp, 1))); }
    15% { transform: scaleX(calc(var(--facing, 1) * (1 - 0.18 * var(--impact-amp, 1)))) scaleY(calc(1 + 0.18 * var(--impact-amp, 1))) translateX(calc(var(--facing, 1) * -7% * var(--impact-amp, 1))) skewX(calc(var(--facing, 1) * -5deg * var(--impact-amp, 1))); }
    30% { transform: scaleX(calc(var(--facing, 1) * (1 + 0.12 * var(--impact-amp, 1)))) scaleY(calc(1 - 0.12 * var(--impact-amp, 1))) translateX(calc(var(--facing, 1) * -3% * var(--impact-amp, 1))) skewX(calc(var(--facing, 1) * 2deg * var(--impact-amp, 1))); }
    50% { transform: scaleX(calc(var(--facing, 1) * (1 - 0.06 * var(--impact-amp, 1)))) scaleY(calc(1 + 0.06 * var(--impact-amp, 1))) translateX(calc(var(--facing, 1) * -1% * var(--impact-amp, 1))) skewX(calc(var(--facing, 1) * -1deg * var(--impact-amp, 1))); }
    100% { transform: scaleX(var(--facing, 1)) scaleY(1) translateX(0) skewX(0deg); }
  }
`;

export const AnimatedFighterImage = styled.img
  .withConfig({
    shouldForwardProp: (prop) =>
      ![
        "frameCount", "fps", "loop", "isLocalPlayer", "isAtTheRopes",
        "isGrabBreaking", "isRawParrying", "isMatadorParrying", "isMatadorSuccess",
        "isPerfectRawParrySuccess", "isHit", "isChargingAttack",
        "animationKey", "noFilter", "overlayLayer",
      ].includes(prop),
  })
  .attrs((props) => {
    const frameCount = props.$frameCount || 1;
    const fps = props.$fps || 30;
    const duration = frameCount / fps;
    const totalOffset = ((frameCount - 1) / frameCount) * 100;
    const isOverlay = !!props.$overlayLayer;

    return {
      style: {
        // Overlay hats share the container box: stack on top of the body strip.
        position: isOverlay ? "absolute" : "relative",
        left: isOverlay ? 0 : undefined,
        top: isOverlay ? 0 : undefined,
        display: "block",
        height: "100%",
        width: isOverlay ? "auto" : "auto",
        backfaceVisibility: "hidden",
        filter: props.$noFilter ? "none" : getFighterPopFilter(props),
        zIndex: isOverlay ? 2 : 1,
        pointerEvents: "none",
        animation:
          frameCount > 1
            ? `spritesheet-${frameCount} ${duration}s steps(${
                frameCount - 1
              }) ${props.$loop !== false ? "infinite" : "forwards"}`
            : "none",
        animationName: frameCount > 1 ? `spritesheet-${frameCount}` : "none",
      },
    };
  })`
  ${Array.from({ length: 24 }, (_, i) => {
    const n = i + 2;
    const pct = ((n - 1) / n * 100).toFixed(3).replace(/\.?0+$/, '');
    return `@keyframes spritesheet-${n} { from { transform: translate3d(0%, 0, 0); } to { transform: translate3d(-${pct}%, 0, 0); } }`;
  }).join('\n  ')}
`;

export const CountdownTimer = styled.div`
  position: absolute;
  opacity: 0;
  font-family: ${FONT_DISPLAY};
  font-size: clamp(1rem, 3cqw, 2.5rem);
  color: #ffd700;
  -webkit-text-stroke: clamp(1.5px, 0.15cqw, 3px) #1a0a08;
  paint-order: stroke fill;
  text-shadow: ${TEXT_SHADOW_COMBAT_HEAVY}, 0 0 8px rgba(255, 215, 0, 0.2);
  pointer-events: none;
  bottom: 80.5%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
`;

export const SaltBasket = styled.img
  .withConfig({
    shouldForwardProp: (prop) => !["isVisible", "index"].includes(prop),
  })
  .attrs((props) => ({
    style: {
      position: "absolute",
      width: "3.37%",
      height: "auto",
      bottom: `${((GROUND_LEVEL + 100) / 720) * 150}%`,
      left: props.$index === 0 ? "25.3%" : "auto",
      right: props.$index === 1 ? "25.3%" : "auto",
      transform: props.$index === 1 ? "scaleX(-1)" : "none",
      zIndex: 1,
      pointerEvents: "none",
      opacity: props.$isVisible ? 1 : 0,
      transition: "opacity 0.3s ease",
    },
  }))``;

const youBob = keyframes`
  0%, 100% { transform: translateX(-50%) translateY(0); }
  50% { transform: translateX(-50%) translateY(-4px); }
`;

export const YouLabel = styled.div
  .withConfig({
    shouldForwardProp: (prop) => !["x", "y"].includes(prop),
  })
  .attrs((props) => ({
    style: {
      position: "absolute",
      bottom: `${(props.y / 720) * 100 + 21}%`,
      left: `${(props.x / 1280) * 100}%`,
    },
  }))`
  z-index: 1000;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  animation: ${youBob} 1.8s ease-in-out infinite;

  &::before {
    content: "You";
    font-family: ${FONT_UI};
    font-weight: ${FONT_WEIGHT.bold};
    font-size: clamp(12px, 1.2cqw, 18px);
    letter-spacing: ${TRACK.label};
    line-height: 1;
    color: #ffffff;
    -webkit-text-stroke: 1.5px rgba(0, 0, 0, 0.7);
    paint-order: stroke fill;
    text-shadow: ${TEXT_SHADOW_UI};
  }

  &::after {
    content: "";
    width: 0;
    height: 0;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 6px solid #ffffff;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8));
  }
`;

const snowballSpin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

export const SnowballWrapper = styled.div
  .withConfig({
    shouldForwardProp: (prop) => !["$x", "$y", "$vx"].includes(prop),
  })
  .attrs((props) => ({
    style: {
      position: "absolute",
      width: "3.37%",
      left: `${(props.$x / 1280) * 100}%`,
      bottom: `${(props.$y / 720) * 100 + 11}%`,
      translate: "-50%",
      zIndex: 95,
      pointerEvents: "none",
      filter: "drop-shadow(0 0 5px rgba(200,230,255,0.7))",
    },
  }))``;

export const SnowballProjectileImg = styled.img`
  width: 100%;
  height: auto;
  display: block;
  animation: ${snowballSpin} 0.3s linear infinite;
`;

export const PumoClone = styled.img
  .withConfig({
    shouldForwardProp: (prop) =>
      !["$x", "$y", "$facing", "$size", "$lane"].includes(prop),
  })
  .attrs((props) => {
    const offScreen = props.$x < -20 || props.$x > 1075 || props.$y < GROUND_LEVEL - 55;
    const laneZ = props.$lane === 'top' ? 90 : 100;
    return {
      style: {
        position: "absolute",
        width: `${(props.$size || 0.6) * 14.47}%`,
        height: "auto",
        left: `${(props.$x / 1280) * 100}%`,
        bottom: `${(props.$y / 720) * 100}%`,
        translate: "-50%",
        transform: `scaleX(${props.$facing * -1})`,
        zIndex: offScreen ? 0 : laneZ,
        pointerEvents: "none",
        filter: "drop-shadow(0 0 clamp(1px, 0.08cqw, 2.5px) #000)",
      },
    };
  })``;

export const AnimatedPumoCloneContainer = styled.div
  .withConfig({
    shouldForwardProp: (prop) =>
      !["$x", "$y", "$facing", "$size", "$lane"].includes(prop),
  })
  .attrs((props) => {
    const offScreen = props.$x < -20 || props.$x > 1075 || props.$y < GROUND_LEVEL - 55;
    const laneZ = props.$lane === 'top' ? 90 : 100;
    return {
      style: {
        position: "absolute",
        width: `${(props.$size || 0.6) * 14.47}%`,
        aspectRatio: "1",
        left: `${(props.$x / 1280) * 100}%`,
        bottom: `${(props.$y / 720) * 100}%`,
        translate: "-50%",
        transform: `scaleX(${props.$facing * -1})`,
        zIndex: offScreen ? 0 : laneZ,
        pointerEvents: "none",
        overflow: "hidden",
        clipPath: "inset(0 0.5% 0 0.5%)",
      },
    };
  })``;

export const AnimatedPumoCloneImage = styled.img
  .withConfig({
    shouldForwardProp: (prop) => !["$frameCount", "$fps"].includes(prop),
  })
  .attrs((props) => {
    const frameCount = props.$frameCount || 1;
    const fps = props.$fps || 30;
    const duration = frameCount / fps;
    return {
      style: {
        position: "relative",
        display: "block",
        height: "100%",
        width: "auto",
        backfaceVisibility: "hidden",
        filter: "drop-shadow(0 0 clamp(1px, 0.08cqw, 2.5px) #000)",
        animation:
          frameCount > 1
            ? `spritesheet-${frameCount} ${duration}s steps(${
                frameCount - 1
              }) infinite`
            : "none",
      },
    };
  })``;

export const OpponentDisconnectedOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  backdrop-filter: blur(5px);
`;

export const DisconnectedModal = styled.div`
  background: linear-gradient(
    135deg,
    rgba(28, 28, 28, 0.95),
    rgba(18, 18, 18, 0.95)
  );
  border: 2px solid #8b4513;
  border-radius: 12px;
  padding: 2rem;
  text-align: center;
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.5);
  min-width: 400px;
`;

export const DisconnectedTitle = styled.h2`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.black};
  font-size: 1.8rem;
  color: #d4af37;
  margin: 0 0 1rem 0;
  text-shadow: ${TEXT_SHADOW_DISPLAY};
`;

export const DisconnectedMessage = styled.p`
  font-family: ${FONT_UI};
  font-size: 1.2rem;
  color: #ffffff;
  margin: 0 0 2rem 0;
  font-weight: ${FONT_WEIGHT.medium};
`;
