import styled, { keyframes } from "styled-components";
import { isOutsideDohyo } from "../constants";
import getImageSrc from "./getImageSrc";
import { GROUND_LEVEL } from "./fighterAssets";

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
  const base = "drop-shadow(0 0 clamp(1px, 0.08vw, 2.5px) #000)";

  if (props.$isAtTheRopes) {
    return `${base} drop-shadow(0 0 8px rgba(255, 50, 50, 0.7))`;
  }
  if (props.$isGrabBreaking) {
    return `${base} drop-shadow(0 0 8px rgba(0, 255, 128, 0.85))`;
  }
  if (props.$isRawParrying) {
    return `${base} drop-shadow(0 0 8px rgba(0, 150, 255, 0.8))`;
  }
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
  return base;
};

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
        "isGrabBreaking",
        "isReady",
        "isHit",
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
        "isDodgeCancelling",
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
        "isGrabClashActive",
        "isAttemptingGrabThrow",
        "ritualAnimationSrc",
        "isLocalPlayer",
        "overrideSrc",
        "isCinematicKillAttacker",
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
        props.$isRawParrying,
        props.$isGrabBreaking,
        props.$isReady,
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
        props.$isGrabClashActive,
        props.$isAttemptingGrabThrow,
        props.$ritualAnimationSrc,
        props.$isGrabPushing,
        props.$isBeingGrabPushed,
        props.$isAttemptingPull,
        props.$isBeingPullReversaled,
        props.$isGrabSeparating,
        props.$isGrabBellyFlopping,
        props.$isBeingGrabBellyFlopped,
        props.$isGrabFrontalForceOut,
        props.$isBeingGrabFrontalForceOut,
        props.$isGrabTeching,
        props.$grabTechRole,
        props.$isGrabWhiffRecovery
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
      transform:
        props.$isAtTheRopes && props.$fighter === "player 1"
          ? props.$facing === 1
            ? "scaleX(1) scaleY(0.95)"
            : "scaleX(-1) scaleY(0.95)"
          : props.$facing === 1
          ? "scaleX(1)"
          : "scaleX(-1)",
      zIndex: isOutsideDohyo(props.$x, props.$y)
        ? 0
        : props.$isCinematicKillAttacker
        ? 100
        : props.$isThrowing || props.$isDodging || props.$isGrabbing
        ? 98
        : 99,
      filter: getFighterPopFilter(props),
      animation: props.$isAtTheRopes
        ? "atTheRopesWobble 0.3s ease-in-out infinite"
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
        : props.$isAttemptingPull
        ? "attemptingPullTug 0.6s cubic-bezier(0.4, 0.0, 0.6, 1.0)"
        : props.$isGrabPushing
        ? "grabPushStrain 0.3s ease-in-out infinite"
        : props.$isBeingGrabPushed
        ? "grabPushResist 0.3s ease-in-out infinite"
        : props.$isAttemptingGrabThrow
        ? "attemptingGrabThrowPull 1.0s cubic-bezier(0.4, 0.0, 0.6, 1.0)"
        : props.$isRawParrySuccess || props.$isPerfectRawParrySuccess
        ? "rawParryRecoil 0.5s ease-out"
        : props.$isGrabBreaking
        ? "grabBreakShake 0.1s ease-in-out infinite"
        : props.$isGrabBreakCountered
        ? "grabBreakShake 0.1s ease-in-out infinite"
        : props.$isRawParrying
        ? "rawParryFlash 1.2s ease-in-out infinite"
        : props.$isGrabTeching
        ? "grabTechShake 0.25s ease-in-out infinite"
        : props.$isGrabClashActive
        ? "grabClashStruggle 0.15s ease-in-out infinite"
        : props.$isHit
        ? "hitSquash 0.28s cubic-bezier(0.22, 0.6, 0.35, 1)"
        : props.$justLandedFromDodge && !props.$isPowerSliding
        ? "dodgeLanding 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards"
        : props.$isDodging
        ? "dodgeTakeoff 0.2s cubic-bezier(0.25, 0.1, 0.25, 1) forwards, dodgeInvincibilityFlash 0.2s ease-out forwards"
        : props.$isPowerSliding &&
          !props.$isBeingGrabbed &&
          !props.$isBeingThrown &&
          !props.$isThrowing &&
          !props.$isGrabbing &&
          !props.$isDead
        ? "powerSlide 0.15s ease-in-out infinite"
        : props.$isBraking &&
          !props.$isBeingGrabbed &&
          !props.$isBeingThrown &&
          !props.$isThrowing &&
          !props.$isGrabbing &&
          !props.$isRecovering &&
          !props.$isDead
        ? "iceBrake 0.2s ease-in-out infinite"
        : props.$isChargingAttack && !props.$isReady
        ? "chargePulse 0.6s ease-in-out infinite"
        : props.$isAttacking && !props.$isSlapAttack
        ? "attackPunch 0.2s ease-out"
        : props.$isSlapAttack
        ? "slapRush 0.12s ease-in-out infinite"
        : !props.$isAttacking &&
          !props.$isDodging &&
          !props.$isJumping &&
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
          !props.$isReady &&
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
        props.$isAtTheRopes && props.$fighter === "player 1"
          ? "min(11.56%, 356px)"
          : "min(12.30%, 379px)",
      height: "auto",
      willChange: "transform",
      pointerEvents: "none",
      transformOrigin: "center bottom",
      transition: "none",
    },
  }))`
  @keyframes rawParryFlash {
    0% { filter: drop-shadow(0 0 clamp(1px, 0.08vw, 2.5px) #000) drop-shadow(0 0 2px rgba(0, 150, 255, 0.4)); }
    25% { filter: drop-shadow(0 0 clamp(1px, 0.08vw, 2.5px) #000) drop-shadow(0 0 12px rgba(0, 150, 255, 0.9)); }
    50% { filter: drop-shadow(0 0 clamp(1px, 0.08vw, 2.5px) #000) drop-shadow(0 0 8px rgba(0, 150, 255, 0.7)); }
    75% { filter: drop-shadow(0 0 clamp(1px, 0.08vw, 2.5px) #000) drop-shadow(0 0 12px rgba(0, 150, 255, 0.9)); }
    100% { filter: drop-shadow(0 0 clamp(1px, 0.08vw, 2.5px) #000) drop-shadow(0 0 2px rgba(0, 150, 255, 0.4)); }
  }
  @keyframes grabBreakFlash {
    0% { filter: drop-shadow(0 0 clamp(1px, 0.08vw, 2.5px) #000) drop-shadow(0 0 2px rgba(0, 255, 128, 0.45)); }
    25% { filter: drop-shadow(0 0 clamp(1px, 0.08vw, 2.5px) #000) drop-shadow(0 0 12px rgba(0, 255, 128, 0.95)); }
    50% { filter: drop-shadow(0 0 clamp(1px, 0.08vw, 2.5px) #000) drop-shadow(0 0 8px rgba(0, 255, 128, 0.75)); }
    75% { filter: drop-shadow(0 0 clamp(1px, 0.08vw, 2.5px) #000) drop-shadow(0 0 12px rgba(0, 255, 128, 0.95)); }
    100% { filter: drop-shadow(0 0 clamp(1px, 0.08vw, 2.5px) #000) drop-shadow(0 0 2px rgba(0, 255, 128, 0.45)); }
  }
  @keyframes hitSquash {
    0% { transform: scaleX(var(--facing, 1)) scaleY(1) translateX(0) rotate(0deg); }
    6% { transform: scaleX(calc(var(--facing, 1) * 1.25)) scaleY(0.75) translateX(calc(var(--facing, 1) * -3%)) rotate(calc(var(--facing, 1) * 2deg)); }
    18% { transform: scaleX(calc(var(--facing, 1) * 0.88)) scaleY(1.12) translateX(calc(var(--facing, 1) * -5%)) rotate(calc(var(--facing, 1) * -4deg)); }
    35% { transform: scaleX(calc(var(--facing, 1) * 1.08)) scaleY(0.92) translateX(calc(var(--facing, 1) * -2%)) rotate(calc(var(--facing, 1) * 1.5deg)); }
    55% { transform: scaleX(calc(var(--facing, 1) * 0.96)) scaleY(1.04) translateX(calc(var(--facing, 1) * -0.5%)) rotate(calc(var(--facing, 1) * -0.5deg)); }
    100% { transform: scaleX(var(--facing, 1)) scaleY(1) translateX(0) rotate(0deg); }
  }
  @keyframes attackPunch {
    0% { transform: scaleX(var(--facing, 1)) scaleY(1); }
    25% { transform: scaleX(calc(var(--facing, 1) * 0.9)) scaleY(1.1); }
    55% { transform: scaleX(calc(var(--facing, 1) * 1.12)) scaleY(0.92); }
    100% { transform: scaleX(var(--facing, 1)) scaleY(1); }
  }
  @keyframes chargePulse {
    0%, 100% { transform: scaleX(var(--facing, 1)) scaleY(1); }
    50% { transform: scaleX(var(--facing, 1)) scaleY(1.02); }
  }
  @keyframes breathe {
    0%, 100% { transform: scaleX(var(--facing, 1)) scaleY(1); }
    50% { transform: scaleX(var(--facing, 1)) scaleY(1.03); }
  }
  @keyframes iceBrake {
    0%, 100% { transform: scaleX(var(--facing, 1)) scaleY(0.96) rotate(calc(var(--facing, 1) * 3deg)); }
    50% { transform: scaleX(var(--facing, 1)) scaleY(0.94) rotate(calc(var(--facing, 1) * 5deg)); }
  }
  @keyframes powerSlide {
    0%, 100% { transform: scaleX(var(--facing, 1)) translateY(6px); }
    50% { transform: scaleX(var(--facing, 1)) translateY(8px); }
  }
  @keyframes atTheRopesWobble {
    0%, 100% { transform: scaleX(var(--facing, 1)) scaleY(0.95) rotate(0deg) translateX(0); }
    25% { transform: scaleX(var(--facing, 1)) scaleY(0.95) rotate(-4deg) translateX(-2px) translateY(1px); }
    50% { transform: scaleX(var(--facing, 1)) scaleY(0.95) rotate(2deg) translateX(1px) translateY(-1px); }
    75% { transform: scaleX(var(--facing, 1)) scaleY(0.95) rotate(-2deg) translateX(-1px) translateY(1px); }
  }
  @keyframes grabClashStruggle {
    0% { transform: scaleX(var(--facing, 1)) translateX(0px); }
    25% { transform: scaleX(var(--facing, 1)) translateX(-3px); }
    50% { transform: scaleX(var(--facing, 1)) translateX(0px); }
    75% { transform: scaleX(var(--facing, 1)) translateX(3px); }
    100% { transform: scaleX(var(--facing, 1)) translateX(0px); }
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
  @keyframes grabBreakShake {
    0%   { transform: scaleX(var(--facing, 1)) translateX(0px); }
    25%  { transform: scaleX(var(--facing, 1)) translateX(-5px); }
    50%  { transform: scaleX(var(--facing, 1)) translateX(5px); }
    75%  { transform: scaleX(var(--facing, 1)) translateX(-4px); }
    100% { transform: scaleX(var(--facing, 1)) translateX(0px); }
  }
  @keyframes slapRush {
    0%, 100% { transform: scaleX(var(--facing, 1)); filter: drop-shadow(0 0 clamp(1px, 0.08vw, 2.5px) #000) blur(0.3px); }
    50% { transform: scaleX(var(--facing, 1)); filter: drop-shadow(0 0 clamp(1px, 0.08vw, 2.5px) #000) blur(0.6px); }
  }
  @keyframes attemptingGrabThrowPull {
    0% { transform: scaleX(var(--facing, 1)) scaleY(1) translateY(0); transform-origin: center bottom; }
    15% { transform: scaleX(calc(var(--facing, 1) * 0.95)) scaleY(1.08) translateY(-3px); transform-origin: center bottom; }
    40% { transform: scaleX(calc(var(--facing, 1) * 0.93)) scaleY(1.10) translateY(-5px); transform-origin: center bottom; }
    70% { transform: scaleX(calc(var(--facing, 1) * 0.96)) scaleY(1.06) translateY(-3px); transform-origin: center bottom; }
    100% { transform: scaleX(var(--facing, 1)) scaleY(1) translateY(0); transform-origin: center bottom; }
  }
  @keyframes grabPushStrain {
    0%, 100% { transform: scaleX(var(--facing, 1)) translateX(0) scaleY(1); transform-origin: center bottom; }
    50% { transform: scaleX(calc(var(--facing, 1) * 1.03)) translateX(calc(var(--facing, 1) * -2px)) scaleY(0.97); transform-origin: center bottom; }
  }
  @keyframes grabPushResist {
    0%, 100% { transform: scaleX(var(--facing, 1)) translateX(0) scaleY(1); transform-origin: center bottom; }
    30% { transform: scaleX(calc(var(--facing, 1) * 0.97)) translateX(calc(var(--facing, 1) * 1px)) scaleY(1.02); transform-origin: center bottom; }
    70% { transform: scaleX(calc(var(--facing, 1) * 0.98)) translateX(calc(var(--facing, 1) * 2px)) scaleY(1.01); transform-origin: center bottom; }
  }
  @keyframes attemptingPullTug {
    0% { transform: scaleX(var(--facing, 1)) scaleY(1); transform-origin: 50% 100%; }
    12% { transform: scaleX(var(--facing, 1)) scaleY(0.95); transform-origin: 50% 100%; }
    28% { transform: scaleX(var(--facing, 1)) scaleY(0.94); transform-origin: 50% 100%; }
    45% { transform: scaleX(var(--facing, 1)) scaleY(1); transform-origin: 50% 100%; }
    62% { transform: scaleX(var(--facing, 1)) scaleY(0.94); transform-origin: 50% 100%; }
    78% { transform: scaleX(var(--facing, 1)) scaleY(0.96); transform-origin: 50% 100%; }
    92% { transform: scaleX(var(--facing, 1)) scaleY(1); transform-origin: 50% 100%; }
    100% { transform: scaleX(var(--facing, 1)) scaleY(0.97); transform-origin: 50% 100%; }
  }
  @keyframes grabSeparatePush {
    0% { transform: scaleX(var(--facing, 1)) translateX(0) scaleY(1); transform-origin: center bottom; }
    40% { transform: scaleX(calc(var(--facing, 1) * 1.04)) translateX(calc(var(--facing, 1) * 3px)) scaleY(0.97); transform-origin: center bottom; }
    100% { transform: scaleX(var(--facing, 1)) translateX(0) scaleY(1); transform-origin: center bottom; }
  }
  @keyframes grabBellyFlopLunge {
    0% { transform: scaleX(var(--facing, 1)) scaleY(1) translateY(0); transform-origin: center bottom; }
    40% { transform: scaleX(calc(var(--facing, 1) * 1.15)) scaleY(0.85) translateY(0); transform-origin: center bottom; }
    70% { transform: scaleX(calc(var(--facing, 1) * 1.2)) scaleY(0.75) translateY(2px); transform-origin: center bottom; }
    100% { transform: scaleX(calc(var(--facing, 1) * 1.25)) scaleY(0.7) translateY(4px); transform-origin: center bottom; }
  }
  @keyframes grabBellyFlopVictim {
    0% { transform: scaleX(var(--facing, 1)) scaleY(1) translateY(0); transform-origin: center bottom; }
    30% { transform: scaleX(calc(var(--facing, 1) * 0.85)) scaleY(1.1) translateY(-4px); transform-origin: center bottom; }
    70% { transform: scaleX(calc(var(--facing, 1) * 1.15)) scaleY(0.8) translateY(2px); transform-origin: center bottom; }
    100% { transform: scaleX(calc(var(--facing, 1) * 1.3)) scaleY(0.65) translateY(5px); transform-origin: center bottom; }
  }
  @keyframes grabFrontalForceOut {
    0% { transform: scaleX(var(--facing, 1)) scaleY(1) translateY(0); transform-origin: center bottom; }
    50% { transform: scaleX(calc(var(--facing, 1) * 1.1)) scaleY(0.92) translateX(calc(var(--facing, 1) * -3px)); transform-origin: center bottom; }
    100% { transform: scaleX(calc(var(--facing, 1) * 1.05)) scaleY(0.95) translateX(calc(var(--facing, 1) * -5px)); transform-origin: center bottom; }
  }
  @keyframes grabFrontalForceOutVictim {
    0% { transform: scaleX(var(--facing, 1)) scaleY(1) translateY(0); transform-origin: center bottom; }
    40% { transform: scaleX(calc(var(--facing, 1) * 0.9)) scaleY(1.05) translateY(-2px); transform-origin: center bottom; }
    100% { transform: scaleX(calc(var(--facing, 1) * 0.85)) scaleY(0.9) translateY(3px); transform-origin: center bottom; }
  }
  @keyframes dodgeTakeoff {
    0% { transform: scaleX(var(--facing, 1)) scaleY(1) translateY(0); }
    20% { transform: scaleX(calc(var(--facing, 1) * 1.08)) scaleY(0.88) translateY(0); }
    50% { transform: scaleX(calc(var(--facing, 1) * 0.94)) scaleY(1.08) translateY(-2px); }
    80% { transform: scaleX(calc(var(--facing, 1) * 0.97)) scaleY(1.04) translateY(-1px); }
    100% { transform: scaleX(var(--facing, 1)) scaleY(1) translateY(0); }
  }
  @keyframes dodgeInvincibilityFlash {
    0% { filter: drop-shadow(0 0 clamp(1px, 0.08vw, 2.5px) #000) brightness(2.5) saturate(0.2); }
    40% { filter: drop-shadow(0 0 clamp(1px, 0.08vw, 2.5px) #000) brightness(2.2) saturate(0.3); }
    70% { filter: drop-shadow(0 0 clamp(1px, 0.08vw, 2.5px) #000) brightness(1.3) saturate(0.7); }
    100% { filter: drop-shadow(0 0 clamp(1px, 0.08vw, 2.5px) #000) brightness(1) saturate(1); }
  }
  @keyframes dodgeCancelSlam {
    0% { transform: scaleX(var(--facing, 1)) scaleY(1) translateY(0); }
    40% { transform: scaleX(calc(var(--facing, 1) * 0.94)) scaleY(1.08) translateY(1px); }
    70% { transform: scaleX(calc(var(--facing, 1) * 1.12)) scaleY(0.82) translateY(0); }
    90% { transform: scaleX(calc(var(--facing, 1) * 0.98)) scaleY(1.03) translateY(0); }
    100% { transform: scaleX(var(--facing, 1)) scaleY(1) translateY(0); }
  }
  @keyframes dodgeLanding {
    0% { transform: scaleX(var(--facing, 1)) scaleY(1) translateY(0); transform-origin: center bottom; }
    25% { transform: scaleX(calc(var(--facing, 1) * 1.06)) scaleY(0.88) translateY(0); transform-origin: center bottom; }
    55% { transform: scaleX(calc(var(--facing, 1) * 0.98)) scaleY(1.04) translateY(0); transform-origin: center bottom; }
    80% { transform: scaleX(calc(var(--facing, 1) * 1.02)) scaleY(0.99) translateY(0); transform-origin: center bottom; }
    100% { transform: scaleX(var(--facing, 1)) scaleY(1) translateY(0); transform-origin: center bottom; }
  }
  @keyframes rawParryRecoil {
    0% { transform: scaleX(var(--facing, 1)) scaleY(1) translateX(0); transform-origin: center bottom; }
    10% { transform: scaleX(calc(var(--facing, 1) * 1.05)) scaleY(0.95) translateX(calc(var(--facing, 1) * -8px)); transform-origin: center bottom; }
    25% { transform: scaleX(calc(var(--facing, 1) * 0.92)) scaleY(1.08) translateX(calc(var(--facing, 1) * -5px)); transform-origin: center bottom; }
    45% { transform: scaleX(calc(var(--facing, 1) * 1.03)) scaleY(0.97) translateX(calc(var(--facing, 1) * 3px)); transform-origin: center bottom; }
    65% { transform: scaleX(calc(var(--facing, 1) * 0.98)) scaleY(1.02) translateX(calc(var(--facing, 1) * -2px)); transform-origin: center bottom; }
    85% { transform: scaleX(calc(var(--facing, 1) * 1.01)) scaleY(0.99) translateX(calc(var(--facing, 1) * 1px)); transform-origin: center bottom; }
    100% { transform: scaleX(var(--facing, 1)) scaleY(1) translateX(0); transform-origin: center bottom; }
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
      filter: "drop-shadow(0 0 clamp(1px, 0.08vw, 2.5px) #000)",
    },
  };
})``;

export const AnimatedFighterContainer = styled.div
  .withConfig({
    shouldForwardProp: (prop) =>
      ![
        "x", "y", "facing", "fighter", "isThrowing", "isDodging",
        "isGrabbing", "isRingOutThrowCutscene", "isAtTheRopes", "isHit", "isRawParryStun",
        "isCinematicKillAttacker",
      ].includes(prop),
  })
  .attrs((props) => ({
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
      transform:
        props.$facing === 1
          ? `scaleX(${props.$isRawParryStun ? 1.08 : 1})`
          : `scaleX(${props.$isRawParryStun ? -1.08 : -1})`,
      overflow: "hidden",
      zIndex: isOutsideDohyo(props.$x, props.$y)
        ? 0
        : props.$isCinematicKillAttacker
        ? 100
        : props.$isThrowing || props.$isDodging || props.$isGrabbing
        ? 98
        : 99,
      pointerEvents: "none",
      clipPath: "inset(0 0.5% 0 0.5%)",
      transformOrigin: "center bottom",
      animation: props.$isHit
        ? "hitSquashContainer 0.28s cubic-bezier(0.22, 0.6, 0.35, 1)"
        : "none",
    },
  }))`
  @keyframes hitSquashContainer {
    0% { transform: scaleX(var(--facing, 1)) scaleY(1) translateX(0) rotate(0deg); }
    6% { transform: scaleX(calc(var(--facing, 1) * 1.25)) scaleY(0.75) translateX(calc(var(--facing, 1) * -3%)) rotate(calc(var(--facing, 1) * 2deg)); }
    18% { transform: scaleX(calc(var(--facing, 1) * 0.88)) scaleY(1.12) translateX(calc(var(--facing, 1) * -5%)) rotate(calc(var(--facing, 1) * -4deg)); }
    35% { transform: scaleX(calc(var(--facing, 1) * 1.08)) scaleY(0.92) translateX(calc(var(--facing, 1) * -2%)) rotate(calc(var(--facing, 1) * 1.5deg)); }
    55% { transform: scaleX(calc(var(--facing, 1) * 0.96)) scaleY(1.04) translateX(calc(var(--facing, 1) * -0.5%)) rotate(calc(var(--facing, 1) * -0.5deg)); }
    100% { transform: scaleX(var(--facing, 1)) scaleY(1) translateX(0) rotate(0deg); }
  }
`;

export const AnimatedFighterImage = styled.img
  .withConfig({
    shouldForwardProp: (prop) =>
      ![
        "frameCount", "fps", "loop", "isLocalPlayer", "isAtTheRopes",
        "isGrabBreaking", "isRawParrying", "isHit", "isChargingAttack",
        "isGrabClashActive", "animationKey",
      ].includes(prop),
  })
  .attrs((props) => {
    const frameCount = props.$frameCount || 1;
    const fps = props.$fps || 30;
    const duration = frameCount / fps;
    const totalOffset = ((frameCount - 1) / frameCount) * 100;

    return {
      style: {
        position: "relative",
        display: "block",
        height: "100%",
        width: "auto",
        backfaceVisibility: "hidden",
        filter: getFighterPopFilter(props),
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
  font-family: "Bungee";
  font-size: clamp(1rem, 3vw, 2.5rem);
  color: rgb(255, 0, 0);
  text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000,
    1px 1px 0 #000;
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

const youLabelGlow = keyframes`
  0%, 100% { opacity: 0.85; }
  50% { opacity: 1; }
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
      transform: "translateX(-50%)",
    },
  }))`
  z-index: 1000;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  animation: ${youLabelGlow} 2.5s ease-in-out infinite;

  &::before {
    content: "YOU";
    font-family: "Bungee", cursive;
    font-size: clamp(8px, 0.7vw, 10px);
    letter-spacing: 0.05em;
    line-height: 1;
    color: #fff;
    background: rgba(0, 0, 0, 0.6);
    padding: clamp(2px, 0.2vw, 3px) clamp(5px, 0.45vw, 7px);
    border-radius: 3px;
    border: 1px solid rgba(0, 230, 255, 0.5);
    text-shadow: 0 0 6px rgba(0, 230, 255, 0.9);
  }

  &::after {
    content: "";
    width: 0;
    height: 0;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 5px solid rgba(0, 230, 255, 0.8);
    filter: drop-shadow(0 0 3px rgba(0, 230, 255, 0.5));
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
      !["$x", "$y", "$facing", "$size"].includes(prop),
  })
  .attrs((props) => ({
    style: {
      position: "absolute",
      width: `${(props.$size || 0.6) * 14.47}%`,
      height: "auto",
      left: `${(props.$x / 1280) * 100}%`,
      bottom: `${(props.$y / 720) * 100}%`,
      translate: "-50%",
      transform: `scaleX(${props.$facing * -1})`,
      zIndex:
        props.$x < -20 || props.$x > 1075 || props.$y < GROUND_LEVEL - 35
          ? 0
          : 98,
      pointerEvents: "none",
      filter: "drop-shadow(0 0 clamp(1px, 0.08vw, 2.5px) #000)",
    },
  }))``;

export const AnimatedPumoCloneContainer = styled.div
  .withConfig({
    shouldForwardProp: (prop) =>
      !["$x", "$y", "$facing", "$size"].includes(prop),
  })
  .attrs((props) => ({
    style: {
      position: "absolute",
      width: `${(props.$size || 0.6) * 14.47}%`,
      aspectRatio: "1",
      left: `${(props.$x / 1280) * 100}%`,
      bottom: `${(props.$y / 720) * 100}%`,
      translate: "-50%",
      transform: `scaleX(${props.$facing * -1})`,
      zIndex:
        props.$x < -20 || props.$x > 1075 || props.$y < GROUND_LEVEL - 35
          ? 0
          : 98,
      pointerEvents: "none",
      overflow: "hidden",
      clipPath: "inset(0 0.5% 0 0.5%)",
    },
  }))``;

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
        filter: "drop-shadow(0 0 clamp(1px, 0.08vw, 2.5px) #000)",
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
  font-family: "Bungee", cursive;
  font-size: 1.8rem;
  color: #d4af37;
  margin: 0 0 1rem 0;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
`;

export const DisconnectedMessage = styled.p`
  font-family: "Noto Sans JP", sans-serif;
  font-size: 1.2rem;
  color: #ffffff;
  margin: 0 0 2rem 0;
  font-weight: 600;
`;
