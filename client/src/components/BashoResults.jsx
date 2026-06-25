import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import PropTypes from "prop-types";
import styled, { keyframes, css } from "styled-components";
import { FONT_DISPLAY, FONT_KANJI, FONT_BODY, C } from "./menuTheme";
import { formatRank } from "../config/bashoConfig";
import { kimariteFor } from "./RoundResult";
import envelopeImg from "../assets/envelope.png";
import {
  playBashoGong,
  playBashoPurseTick,
  playBashoFanfare,
  playBashoSomber,
  playBashoApplause,
  playBashoYusho,
} from "../utils/soundUtils";
import BanzukeBoard from "./BanzukeBoard";

/**
 * BashoResults — the post-basho summary (spec §5.6 / §5.8 / Phase 9).
 *
 * Phase 9 turns this from a single fade-in into a staged "ceremony": the
 * verdict lands, the banzuke movement animates (promotion lifts / demotion
 * sinks), the kenshō purse is itemised and counted up line-by-line, the stat
 * drip stamps in, and each beat fires a tasteful audio stinger. Tapping
 * anywhere skips straight to the finished state.
 *
 * Display-only: MainMenu has already applied the outcome to the persistent
 * career and saved before navigating here, so the reveal animates values that
 * are already banked — no double-spend risk.
 *
 * Single-player BASHO only — never touches PvP/VS CPU.
 */

// Ceremony phases, in order. The scheduler bumps `phase` through these.
const PHASE = {
  HEADER: 1, // verdict + record + rank chips (static side)
  YUSHO: 2, // championship banner (only if won)
  RANK: 3, // banzuke movement animates
  PURSE: 4, // kenshō breakdown + total count-up
  STAT: 5, // stat-point drip / milestone
  DONE: 6, // strip + return enabled
};

const rise = keyframes`
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const glow = keyframes`
  0%, 100% { text-shadow: 0 0 18px rgba(232, 197, 71, 0.35); }
  50%      { text-shadow: 0 0 34px rgba(232, 197, 71, 0.7); }
`;

const stampIn = keyframes`
  0%   { opacity: 0; transform: scale(1.35) rotate(-2deg); }
  60%  { opacity: 1; }
  100% { opacity: 1; transform: scale(1) rotate(0deg); }
`;

const liftUp = keyframes`
  0%   { opacity: 0; transform: translateY(34px) scale(0.92); }
  55%  { opacity: 1; transform: translateY(-8px) scale(1.05); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
`;

const sinkDown = keyframes`
  0%   { opacity: 0; transform: translateY(-34px) scale(0.92); }
  55%  { opacity: 1; transform: translateY(8px) scale(1.05); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
`;

const arrowPulse = keyframes`
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(var(--pulse, 0)); }
`;

// Each envelope drops in from above and settles into its fanned spot in the
// pile. The final resting transform is carried by per-piece CSS vars so one
// keyframe serves the whole fan.
const envDrop = keyframes`
  0%   {
    opacity: 0;
    transform: translate(var(--tx, -50%), calc(var(--ty, 0px) - 54px))
      rotate(var(--rot, 0deg)) scale(0.7);
  }
  65%  { opacity: 1; }
  100% {
    opacity: 1;
    transform: translate(var(--tx, -50%), var(--ty, 0px))
      rotate(var(--rot, 0deg)) scale(1);
  }
`;

const Screen = styled.div`
  position: fixed;
  inset: 0;
  z-index: 12000;
  background:
    radial-gradient(130% 100% at 50% 0%, rgba(40, 32, 16, 0.4) 0%, rgba(0, 0, 0, 0) 60%),
    #060606;
  /* Hard no-scroll: the inner card is auto-scaled (transform) to always fit
     the viewport, so the whole results layout is visible at once on any window
     size. overflow:hidden guarantees scrolling can never happen. */
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${C.cream};
  font-family: ${FONT_BODY};
  text-align: center;
  overflow: hidden;
`;

// The transform target — kept separate from the MEASURED element so offsetSize
// reads are always the natural (untransformed) layout.
const Scaler = styled.div`
  transform-origin: center center;
  transition: transform 0.28s ease;
`;

// Measured content. Two side-by-side columns (verdict | rewards) keep the card
// SHORT and wide so it fits big screens without a tall single column; on narrow
// windows the columns wrap and stack. The day strip + button sit full-width
// underneath.
const Stage = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(0.6rem, 2vh, 1.4rem);
  padding: clamp(0.8rem, 2.5vh, 1.6rem) clamp(1rem, 3vw, 2.2rem);
`;

const Columns = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: clamp(1.4rem, 5vw, 4rem);
`;

const Panel = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(0.3rem, 1.2vh, 0.85rem);
  flex: 0 1 auto;
`;

const PanelDivider = styled.div`
  align-self: stretch;
  width: 1px;
  background: ${C.creamFaint};
  opacity: 0.5;
  @media (max-width: 720px) {
    display: none;
  }
`;

const Kicker = styled.div`
  font-size: clamp(0.7rem, 1.5vh, 0.95rem);
  letter-spacing: 0.42em;
  text-transform: uppercase;
  color: ${C.creamMute};
  animation: ${rise} 0.5s ease both;
`;

const Title = styled.h1`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(1.7rem, 5.5vh, 3.2rem);
  margin: 0;
  color: ${(p) => (p.$kk ? C.gold : C.cream)};
  opacity: 0;
  ${(p) =>
    p.$show &&
    css`
      animation: ${stampIn} 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
    `}
`;

const YushoBanner = styled.div`
  font-family: ${FONT_KANJI};
  font-size: clamp(1.4rem, 4vh, 2.4rem);
  color: ${C.gold};
  letter-spacing: 0.16em;
  opacity: 0;
  ${(p) =>
    p.$show &&
    css`
      animation: ${glow} 2.2s ease-in-out infinite, ${stampIn} 0.6s ease both;
    `}
`;

const Record = styled.div`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(1.9rem, 6.5vh, 3.6rem);
  line-height: 1;
  color: ${C.cream};
  opacity: 0;
  ${(p) =>
    p.$show &&
    css`
      animation: ${rise} 0.6s ease both;
    `}
`;

const Verdict = styled.div`
  font-size: clamp(0.85rem, 1.9vh, 1.15rem);
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: ${(p) => (p.$kk ? C.successBright : C.vermillionBright)};
  opacity: 0;
  ${(p) =>
    p.$show &&
    css`
      animation: ${rise} 0.6s ease both 0.08s;
    `}
`;

const MovementRow = styled.div`
  margin-top: clamp(0.2rem, 0.8vh, 0.5rem);
  display: flex;
  align-items: center;
  gap: clamp(0.8rem, 3vw, 1.8rem);
  opacity: 0;
  ${(p) =>
    p.$show &&
    css`
      animation: ${rise} 0.5s ease both;
    `}
`;

const RankChip = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0.7rem 1.3rem;
  border: 1px solid
    ${(p) =>
      p.$dir === "up"
        ? "rgba(116, 198, 122, 0.6)"
        : p.$dir === "down"
        ? "rgba(214, 90, 78, 0.6)"
        : C.creamFaint};
  border-radius: 10px;
  min-width: 9rem;
  ${(p) =>
    p.$animate &&
    css`
      animation: ${p.$dir === "up"
          ? liftUp
          : p.$dir === "down"
          ? sinkDown
          : rise}
        0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
      box-shadow: ${p.$dir === "up"
        ? "0 0 26px rgba(116, 198, 122, 0.32)"
        : p.$dir === "down"
        ? "0 0 26px rgba(214, 90, 78, 0.28)"
        : "none"};
    `}
`;

const RankWho = styled.span`
  font-size: clamp(0.58rem, 1.2vh, 0.74rem);
  letter-spacing: 0.26em;
  text-transform: uppercase;
  color: ${C.creamMute};
`;

const RankVal = styled.span`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.95rem, 2.4vh, 1.4rem);
  color: ${C.cream};
`;

const Arrow = styled.div`
  font-size: clamp(1.4rem, 4vh, 2.2rem);
  --pulse: ${(p) => (p.$dir === "up" ? "-6px" : p.$dir === "down" ? "6px" : "0")};
  color: ${(p) =>
    p.$dir === "up"
      ? C.successBright
      : p.$dir === "down"
      ? C.vermillionBright
      : C.creamMute};
  opacity: ${(p) => (p.$show ? 1 : 0)};
  transition: opacity 0.4s ease;
  ${(p) =>
    p.$show &&
    css`
      animation: ${arrowPulse} 1.1s ease-in-out 0.4s 2;
    `}
`;

const Note = styled.div`
  font-size: clamp(0.74rem, 1.6vh, 0.98rem);
  color: ${C.iceBright};
  letter-spacing: 0.04em;
  opacity: 0;
  ${(p) =>
    p.$show &&
    css`
      animation: ${rise} 0.5s ease both;
    `}
`;

const PurseBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(0.15rem, 0.5vh, 0.35rem);
  min-width: clamp(13rem, 30vw, 18rem);
`;

const EnvelopeStack = styled.div`
  position: relative;
  width: clamp(130px, 28vw, 210px);
  height: clamp(58px, 12vh, 96px);
  margin-bottom: clamp(0.1rem, 0.6vh, 0.4rem);
`;

const EnvelopePiece = styled.img`
  position: absolute;
  bottom: 0;
  left: 50%;
  width: clamp(34px, 7.5vh, 58px);
  height: auto;
  transform-origin: bottom center;
  filter: drop-shadow(0 5px 7px rgba(0, 0, 0, 0.5));
  opacity: 0;
  will-change: transform, opacity;
  ${(p) =>
    p.$show &&
    css`
      animation: ${envDrop} 0.52s cubic-bezier(0.2, 0.9, 0.3, 1) both;
    `}
`;

const PurseLines = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
  width: 100%;
`;

const PurseLine = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 1.2rem;
  font-size: clamp(0.7rem, 1.5vh, 0.92rem);
  color: ${C.creamMute};
  letter-spacing: 0.04em;
  opacity: 0;
  ${(p) =>
    p.$show &&
    css`
      animation: ${rise} 0.4s ease both;
      animation-delay: ${p.$i * 0.12}s;
    `}

  .amt {
    font-family: ${FONT_DISPLAY};
    color: ${C.cream};
  }
`;

const PurseTotal = styled.div`
  margin-top: clamp(0.25rem, 0.8vh, 0.5rem);
  padding-top: clamp(0.25rem, 0.8vh, 0.5rem);
  border-top: 1px solid ${C.creamFaint};
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1.2rem;
  font-family: ${FONT_DISPLAY};
  font-size: clamp(1rem, 2.4vh, 1.4rem);
  color: ${C.gold};
  letter-spacing: 0.06em;
  opacity: 0;
  ${(p) =>
    p.$show &&
    css`
      animation: ${rise} 0.4s ease both;
    `}

  .label {
    font-family: ${FONT_BODY};
    font-size: 0.6em;
    letter-spacing: 0.26em;
    text-transform: uppercase;
    color: ${C.creamMute};
  }
`;

const StatRow = styled.div`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.92rem, 2.1vh, 1.25rem);
  color: ${C.iceBright};
  letter-spacing: 0.05em;
  opacity: 0;
  ${(p) =>
    p.$show &&
    css`
      animation: ${stampIn} 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
    `}

  .milestone {
    display: block;
    font-family: ${FONT_BODY};
    font-size: 0.58em;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: ${C.gold};
    margin-top: 0.25rem;
  }
`;

const Strip = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.45rem;
  margin-top: clamp(0.4rem, 1.4vh, 1rem);
  max-width: 44rem;
  opacity: 0;
  ${(p) =>
    p.$show &&
    css`
      animation: ${rise} 0.6s ease both;
    `}
`;

const DayCell = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
`;

const Pip = styled.span`
  width: clamp(1.5rem, 4vw, 2rem);
  height: clamp(1.5rem, 4vw, 2rem);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.7rem, 1.6vh, 0.9rem);
  color: ${(p) => (p.$won ? "#06210f" : "#2a0808")};
  background: ${(p) => (p.$won ? C.successBright : C.vermillionBright)};
`;

const Kimarite = styled.span`
  font-family: ${FONT_KANJI};
  font-size: clamp(0.5rem, 1vh, 0.68rem);
  line-height: 1;
  color: ${(p) => (p.$won ? C.creamMute : "rgba(214,90,78,0.7)")};
  max-width: clamp(1.8rem, 4.4vw, 2.4rem);
  text-align: center;
`;

const ButtonRow = styled.div`
  margin-top: clamp(0.7rem, 2.2vh, 1.6rem);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: clamp(0.6rem, 2vw, 1.1rem);
  opacity: 0;
  pointer-events: none;
  ${(p) =>
    p.$show &&
    css`
      opacity: 1;
      pointer-events: auto;
      animation: ${rise} 0.5s ease both;
    `}
`;

const ReturnButton = styled.button`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.95rem, 2.4vh, 1.35rem);
  letter-spacing: 0.06em;
  color: #1a1205;
  background: linear-gradient(160deg, ${C.gold} 0%, ${C.goldDeep} 100%);
  border: none;
  border-radius: 10px;
  padding: clamp(0.65rem, 1.9vh, 1rem) clamp(2rem, 6vw, 3.2rem);
  cursor: pointer;
  box-shadow: 0 10px 28px rgba(232, 197, 71, 0.26);
  transition: transform 0.12s ease, filter 0.12s ease;

  &:hover {
    transform: translateY(-2px);
    filter: brightness(1.06);
  }
`;

const SecondaryButton = styled.button`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.78rem, 2vh, 1.1rem);
  letter-spacing: 0.06em;
  color: ${C.cream};
  background: transparent;
  border: 1px solid ${C.creamFaint};
  border-radius: 10px;
  padding: clamp(0.6rem, 1.8vh, 0.92rem) clamp(1.5rem, 4.5vw, 2.4rem);
  cursor: pointer;
  transition: transform 0.12s ease, border-color 0.12s ease, color 0.12s ease;

  &:hover {
    transform: translateY(-2px);
    border-color: ${C.gold};
    color: ${C.gold};
  }
`;

const SkipHint = styled.div`
  position: absolute;
  bottom: clamp(0.6rem, 2vh, 1.2rem);
  left: 50%;
  transform: translateX(-50%);
  font-size: clamp(0.6rem, 1.2vh, 0.78rem);
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: ${C.creamFaint};
  pointer-events: none;
`;

// Eased count-up. Animates 0 → target once `active` flips true.
function useCountUp(target, active, durationMs = 1000) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    if (!target) {
      setVal(0);
      return undefined;
    }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setVal(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, durationMs]);
  return val;
}

function BashoResults({
  run,
  movement,
  drip = 0,
  earned = 0,
  breakdown = [],
  tier = 1,
  withdrawn = false,
  onReturn,
}) {
  const record = run?.record || { wins: 0, losses: 0 };
  const kk = movement?.kachiKoshi;
  const dir = movement?.promoted ? "up" : movement?.demoted ? "down" : "flat";
  const yusho = !!movement?.yusho;

  const movementNote = movement?.promoted
    ? "Promoted"
    : movement?.demoted
    ? "Demoted"
    : "Holds rank";

  const [phase, setPhase] = useState(0);
  const [showBoard, setShowBoard] = useState(false);
  const timersRef = useRef([]);
  const fitRef = useRef(null);
  const [scale, setScale] = useState(1);

  // Auto-scale the card to always fit the viewport — no scrolling, ever. We
  // measure the inner column's natural (untransformed) size and shrink it with
  // a CSS transform if it would exceed the screen. offsetWidth/Height ignore
  // transforms, so there's no measure→scale feedback loop.
  const recompute = useCallback(() => {
    const el = fitRef.current;
    if (!el) return;
    const natH = el.offsetHeight;
    const natW = el.offsetWidth;
    if (!natH || !natW) return;
    const s = Math.min(
      1,
      (window.innerHeight - 20) / natH,
      (window.innerWidth - 20) / natW,
    );
    setScale(s > 0 ? s : 1);
  }, []);

  // Re-fit on resize and on any layout change of the card (ResizeObserver
  // catches content the ceremony reveals over time).
  useLayoutEffect(() => {
    recompute();
    const el = fitRef.current;
    const ro = new ResizeObserver(() => recompute());
    if (el) ro.observe(el);
    window.addEventListener("resize", recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [recompute]);

  // Belt-and-suspenders: re-fit after each ceremony beat once the browser has
  // painted the newly-revealed content, so a tall window→short content→tall
  // content sequence can never leave a stale (too-large) scale behind.
  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => recompute());
    return () => cancelAnimationFrame(id);
  }, [phase, recompute]);

  // Schedule the ceremony beats. Yūshō/stat steps are skipped when absent so
  // the pacing stays tight. Each beat fires its stinger as it lands.
  useEffect(() => {
    const timers = timersRef.current;
    let t = 0;
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));

    t += 220;
    at(t, () => {
      setPhase(PHASE.HEADER);
      if (kk) playBashoGong();
      else playBashoSomber();
    });

    if (yusho) {
      t += 1100;
      at(t, () => {
        setPhase(PHASE.YUSHO);
        playBashoYusho();
      });
    }

    t += 1300;
    at(t, () => {
      setPhase(PHASE.RANK);
      if (dir === "up") playBashoApplause();
      else if (dir === "down") playBashoSomber();
    });

    t += 1300;
    at(t, () => {
      setPhase(PHASE.PURSE);
      // Light ticks as the itemised lines stagger in.
      breakdown.forEach((_, i) =>
        at(i * 130, () => playBashoPurseTick()),
      );
      if (earned > 0) at(breakdown.length * 130 + 120, () => playBashoFanfare());
    });

    if (drip > 0) {
      t += 1500;
      at(t, () => {
        setPhase(PHASE.STAT);
        playBashoPurseTick();
      });
    }

    t += 1100;
    at(t, () => setPhase(PHASE.DONE));

    return () => {
      timers.forEach(clearTimeout);
      timersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skip = () => {
    if (phase >= PHASE.DONE) return;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setPhase(PHASE.DONE);
  };

  // hasPurse/hasStat decide whether the element is MOUNTED (so its space is
  // reserved from frame 1 → no layout shift); the phase decides when it REVEALS.
  const hasPurse = earned > 0;
  const purseRevealed = phase >= PHASE.PURSE;
  const purseTotal = useCountUp(earned, hasPurse && purseRevealed, 950);
  const displayTotal = phase >= PHASE.DONE ? earned : purseTotal;

  // Build a fanned pile of envelopes that cascades in over the purse. Count
  // scales with the purse (one envelope ≈ 25 kenshō) but is clamped to a tidy
  // 3–9 so the fan stays legible at any reward size.
  const stackCount = Math.max(3, Math.min(9, Math.round(earned / 25)));
  const center = (stackCount - 1) / 2;
  const envelopes = Array.from({ length: stackCount }, (_, i) => {
    const off = i - center;
    return {
      i,
      tx: `calc(-50% + ${(off * 16).toFixed(1)}px)`,
      ty: `${(Math.abs(off) * 5).toFixed(1)}px`,
      rot: `${(off * 9).toFixed(1)}deg`,
      // When skipping, drop the cascade delay so the pile is instantly settled.
      delay: phase >= PHASE.DONE ? 0 : i * 0.08,
    };
  });

  // The banzuke-board payoff: from the finished ceremony, climb the full
  // ladder from the old rank to the new one before heading back to the heya.
  if (showBoard) {
    return (
      <BanzukeBoard
        fromRank={run?.startRank}
        toRank={movement?.newRank}
        title="Banzuke"
        subtitle={movement?.divisionChanged ? "New Division" : "Career Ladder"}
        buttonLabel="Return to Heya →"
        onReturn={onReturn}
      />
    );
  }

  return (
    <Screen onClick={skip}>
      <Scaler style={{ transform: `scale(${scale})` }}>
        <Stage ref={fitRef}>
          <Columns>
            {/* LEFT — verdict + banzuke movement. Everything is mounted up
                front (space reserved) and only the $show flag fades each beat
                in place, so nothing ever re-flows as the ceremony plays. */}
            <Panel>
              <Kicker>
                {withdrawn ? "Kyūjō — Withdrawn" : "Basho Complete"}
              </Kicker>

              <Title $kk={kk} $show={phase >= PHASE.HEADER}>
                {kk ? "Kachi-koshi" : "Make-koshi"}
              </Title>
              <Record $show={phase >= PHASE.HEADER}>
                {record.wins}–{record.losses}
              </Record>
              <Verdict $kk={kk} $show={phase >= PHASE.HEADER}>
                {kk ? "Winning Record" : "Losing Record"}
              </Verdict>

              {yusho && (
                <YushoBanner $show={phase >= PHASE.YUSHO}>
                  優勝 · Yūshō — Champion
                </YushoBanner>
              )}

              <MovementRow $show={phase >= PHASE.RANK}>
                <RankChip>
                  <RankWho>Before</RankWho>
                  <RankVal>{formatRank(run?.startRank)}</RankVal>
                </RankChip>
                <Arrow $dir={dir} $show={phase >= PHASE.RANK}>
                  {dir === "up" ? "↑" : dir === "down" ? "↓" : "→"}
                </Arrow>
                <RankChip $dir={dir} $animate={phase >= PHASE.RANK}>
                  <RankWho>After</RankWho>
                  <RankVal>{formatRank(movement?.newRank)}</RankVal>
                </RankChip>
              </MovementRow>
              <Note $show={phase >= PHASE.RANK}>
                {movementNote}
                {movement?.divisionChanged ? " · new division" : ""}
              </Note>
            </Panel>

            {hasPurse && <PanelDivider />}

            {/* RIGHT — kenshō purse + stat reward */}
            {hasPurse && (
              <Panel>
                <PurseBox>
                  <EnvelopeStack aria-hidden>
                    {envelopes.map((e) => (
                      <EnvelopePiece
                        key={e.i}
                        src={envelopeImg}
                        alt=""
                        $show={purseRevealed}
                        style={{
                          "--tx": e.tx,
                          "--ty": e.ty,
                          "--rot": e.rot,
                          zIndex: e.i,
                          animationDelay: `${e.delay}s`,
                        }}
                      />
                    ))}
                  </EnvelopeStack>
                  {breakdown.length > 0 && (
                    <PurseLines>
                      {breakdown.map((b, i) => (
                        <PurseLine key={b.key} $i={i} $show={purseRevealed}>
                          <span>{b.label}</span>
                          <span className="amt">
                            +{b.amount.toLocaleString()}
                          </span>
                        </PurseLine>
                      ))}
                    </PurseLines>
                  )}
                  <PurseTotal $show={purseRevealed}>
                    <span className="label">
                      Kenshō{tier > 1 ? ` · ×${tier}` : ""}
                    </span>
                    <span>+{displayTotal.toLocaleString()}</span>
                  </PurseTotal>
                </PurseBox>

                {drip > 0 && (
                  <StatRow $show={phase >= PHASE.STAT}>
                    +{drip} stat point{drip > 1 ? "s" : ""}
                    {movement?.divisionChanged && (
                      <span className="milestone">
                        New personal best division
                      </span>
                    )}
                  </StatRow>
                )}
              </Panel>
            )}
          </Columns>

          {run?.results?.length > 0 && (
            <Strip $show={phase >= PHASE.DONE}>
              {run.results.map((r) => {
                const km = kimariteFor(r.winType);
                return (
                  <DayCell key={r.day}>
                    <Pip $won={r.won}>{r.won ? "○" : "●"}</Pip>
                    <Kimarite $won={r.won}>{km.japanese}</Kimarite>
                  </DayCell>
                );
              })}
            </Strip>
          )}

          <ButtonRow $show={phase >= PHASE.DONE}>
            <ReturnButton
              onClick={(e) => {
                e.stopPropagation();
                onReturn?.();
              }}
            >
              Return to Heya →
            </ReturnButton>
            <SecondaryButton
              onClick={(e) => {
                e.stopPropagation();
                setShowBoard(true);
              }}
            >
              View Banzuke
            </SecondaryButton>
          </ButtonRow>
        </Stage>
      </Scaler>

      {phase < PHASE.DONE && <SkipHint>Tap to skip</SkipHint>}
    </Screen>
  );
}

BashoResults.propTypes = {
  run: PropTypes.shape({
    record: PropTypes.shape({
      wins: PropTypes.number,
      losses: PropTypes.number,
    }),
    startRank: PropTypes.object,
    results: PropTypes.arrayOf(PropTypes.object),
  }),
  movement: PropTypes.shape({
    kachiKoshi: PropTypes.bool,
    promoted: PropTypes.bool,
    demoted: PropTypes.bool,
    yusho: PropTypes.bool,
    newRank: PropTypes.object,
    divisionChanged: PropTypes.bool,
  }),
  drip: PropTypes.number,
  earned: PropTypes.number,
  breakdown: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string,
      label: PropTypes.string,
      amount: PropTypes.number,
    }),
  ),
  tier: PropTypes.number,
  withdrawn: PropTypes.bool,
  onReturn: PropTypes.func,
};

export default BashoResults;
