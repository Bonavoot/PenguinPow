/**
 * BanzukeBoard — the standalone banzuke (番付) ladder screen.
 *
 * Renders the full division ladder bottom→top (Jonokuchi → Yokozuna) as a
 * vertical climb, with the player's recolored rikishi marked on the spine at
 * their exact rank. Two modes:
 *
 *   - STATIC  (pass `rank`)          : show the current position, no motion.
 *   - MOVEMENT (pass `fromRank`+`toRank`) : drop the marker at the old rank,
 *     then animate it climbing/sinking the spine to the new rank — the
 *     promotion/demotion payoff for the results ceremony (spec §9 pass 2).
 *
 * Self-contained: recolors the preview from PlayerColorContext (same path as
 * the hub) and styles itself as a dark sumi-ink banzuke so it reads the same
 * dramatic way whether it's opened from the hub or the results screen.
 *
 * GUARDRAIL: single-player BASHO presentation only — never touches PvP/VS CPU.
 */

import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import styled, { keyframes, css } from "styled-components";
import { usePlayerColors } from "../context/PlayerColorContext";
import {
  recolorImage,
  BLUE_COLOR_RANGES,
  GREY_BODY_RANGES,
  SPRITE_BASE_COLOR,
} from "../utils/SpriteRecolorizer";
import {
  playButtonHoverSound,
  playButtonPressSound2,
  playBashoGong,
} from "../utils/soundUtils";
import pumo from "../assets/pumo-idle.png";
import { DIVISIONS, getDivision, formatRank } from "../config/bashoConfig";
import { C, FONT_BODY, FONT_DISPLAY, FONT_KANJI } from "./menuTheme";

const N = DIVISIONS.length;

// DIVISIONS is ordered bottom→top (idx 0 = jonokuchi). The board paints
// top→bottom (Yokozuna first), so a band's row index = N-1-divisionIndex.
function divisionIndex(key) {
  return DIVISIONS.findIndex((d) => d.key === key);
}
function bandRowFromTop(key) {
  return N - 1 - divisionIndex(key);
}

/* Tier grouping → accent: lower divisions are subdued, the salaried sekitori
   ranks read in ice, and san'yaku + Yokozuna wear gold (matches the purse
   tier + opponent-name tiers elsewhere). */
function tierOf(idx) {
  if (idx >= 6) return "crown";
  if (idx >= 4) return "salary";
  return "lower";
}

const TIER_COLOR = {
  crown: C.gold,
  salary: C.iceBright,
  lower: C.creamMute,
};

/**
 * Vertical position (% of the ladder height) for a rank's marker center.
 * Equal-height bands make the math exact without measuring the DOM: each
 * band owns a 1/N slice; within a numbered division a low number sits higher
 * in its slice (rank #1 near the top, the max number near the bottom).
 */
function markerPct(rank) {
  const div = getDivision(rank);
  const row = bandRowFromTop(div.key);
  let intra = 0.5;
  if (div.numbered) {
    const max = div.maxNumber || 1;
    const num = rank?.number ?? max;
    const f = max > 1 ? (num - 1) / (max - 1) : 0; // 0 = #1 (top of slice)
    intra = 0.2 + 0.6 * f; // keep off the band edges
  }
  return ((row + intra) / N) * 100;
}

// ============================================
// STYLES
// ============================================

const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

const bandIn = keyframes`
  from { opacity: 0; transform: translateX(-14px); }
  to   { opacity: 1; transform: translateX(0); }
`;

const markerPop = keyframes`
  0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.7); }
  100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
`;

const Screen = styled.div`
  position: fixed;
  inset: 0;
  z-index: 12000;
  background:
    radial-gradient(140% 90% at 50% 0%, rgba(40, 32, 16, 0.45) 0%, rgba(0, 0, 0, 0) 60%),
    #070707;
  display: flex;
  flex-direction: column;
  align-items: center;
  color: ${C.cream};
  font-family: ${FONT_BODY};
  overflow: hidden;
  animation: ${fadeIn} 0.4s ease both;
  padding: clamp(0.8rem, 2.5vh, 1.8rem) clamp(1rem, 4vw, 3rem);
  gap: clamp(0.6rem, 1.6vh, 1.2rem);
`;

const Header = styled.header`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  flex: 0 0 auto;
`;

const HeaderKanji = styled.div`
  font-family: ${FONT_KANJI};
  font-size: clamp(0.85rem, 2vh, 1.2rem);
  letter-spacing: 0.5em;
  color: ${C.gold};
  text-indent: 0.5em;
`;

const HeaderTitle = styled.h1`
  font-family: ${FONT_DISPLAY};
  margin: 0;
  font-size: clamp(1.3rem, 3.6vh, 2.2rem);
  letter-spacing: 0.06em;
  color: ${C.cream};
`;

const HeaderSub = styled.div`
  font-size: clamp(0.6rem, 1.3vh, 0.8rem);
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: ${C.creamMute};
`;

const Ladder = styled.div`
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  width: min(640px, 100%);
  display: flex;
  flex-direction: column;
`;

// The climb spine the marker travels along.
const Spine = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  left: clamp(54px, 11vw, 74px);
  width: 2px;
  background: linear-gradient(
    to bottom,
    rgba(232, 197, 71, 0.55) 0%,
    ${C.creamFaint} 45%,
    ${C.creamFaint} 100%
  );
`;

const Band = styled.div`
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  align-items: center;
  gap: clamp(0.6rem, 2vw, 1.1rem);
  padding-left: clamp(108px, 17vw, 134px);
  padding-right: clamp(0.4rem, 2vw, 1rem);
  border-top: 1px solid
    ${(p) => (p.$top ? "transparent" : "rgba(245, 236, 217, 0.07)")};
  opacity: 0;
  animation: ${bandIn} 0.5s ease both;
  animation-delay: ${(p) => p.$i * 0.045}s;

  /* The destination band glows once the climb resolves. */
  ${(p) =>
    p.$active &&
    css`
      background: linear-gradient(
        90deg,
        ${p.$dir === "down"
            ? "rgba(214, 90, 78, 0.16)"
            : "rgba(232, 197, 71, 0.16)"}
          0%,
        rgba(0, 0, 0, 0) 70%
      );
    `}
`;

// The little node on the spine for each division.
const Node = styled.span`
  position: absolute;
  left: clamp(54px, 11vw, 74px);
  top: 50%;
  transform: translate(-50%, -50%);
  width: ${(p) => (p.$active ? "13px" : "9px")};
  height: ${(p) => (p.$active ? "13px" : "9px")};
  border-radius: 50%;
  background: ${(p) => (p.$active ? p.$accent : "#1a1a1a")};
  border: 2px solid ${(p) => p.$accent};
  box-shadow: ${(p) =>
    p.$active ? `0 0 14px ${p.$accent}` : "none"};
  transition: all 0.3s ease;
  z-index: 2;
`;

const BandBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  min-width: 0;
`;

const BandName = styled.div`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.7rem, 1.9vh, 1.05rem);
  line-height: 1.1;
  color: ${(p) => (p.$active ? C.cream : C.creamWarm)};
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const BandSub = styled.div`
  font-size: clamp(0.5rem, 1.1vh, 0.66rem);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: ${(p) => p.$accent};
  opacity: 0.85;
`;

const BandStep = styled.span`
  margin-left: auto;
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.6rem, 1.4vh, 0.85rem);
  color: ${C.creamFaint};
  opacity: 0.7;
`;

// The "YOU · <rank>" pill that lands on the player's band (right side, where
// the step number sits otherwise) — readable, and never overlaps the names.
const YouChip = styled.span`
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: clamp(0.3rem, 0.8vw, 0.5rem);
  padding: 0.22rem 0.6rem;
  border-radius: 999px;
  border: 1px solid
    ${(p) =>
      p.$dir === "down" ? "rgba(214, 90, 78, 0.7)" : "rgba(232, 197, 71, 0.7)"};
  background: rgba(8, 8, 8, 0.55);
  white-space: nowrap;
  animation: ${markerPop} 0.35s ease both;

  .you {
    font-size: clamp(0.42rem, 1vh, 0.55rem);
    letter-spacing: 0.26em;
    text-transform: uppercase;
    color: ${(p) => (p.$dir === "down" ? C.vermillionBright : C.gold)};
  }
  .rk {
    font-family: ${FONT_DISPLAY};
    font-size: clamp(0.62rem, 1.5vh, 0.9rem);
    color: ${C.cream};
  }
`;

// The travelling rikishi marker — the full recolored penguin standing on the
// spine over a soft glow halo (no hard crop, no overlapping text tag).
const Marker = styled.div`
  position: absolute;
  left: clamp(54px, 11vw, 74px);
  top: ${(p) => p.$pct}%;
  transform: translate(-50%, -50%);
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  /* The headline motion: the climb up / sink down the spine. */
  transition: top 1.2s cubic-bezier(0.66, 0, 0.2, 1);
  will-change: top;
  animation: ${markerPop} 0.45s ease both;
`;

const MarkerHalo = styled.div`
  position: absolute;
  width: clamp(54px, 11vh, 84px);
  height: clamp(54px, 11vh, 84px);
  border-radius: 50%;
  background: radial-gradient(
    circle,
    ${(p) =>
        p.$dir === "down"
          ? "rgba(214, 90, 78, 0.45)"
          : p.$dir === "up"
          ? "rgba(232, 197, 71, 0.5)"
          : "rgba(126, 203, 240, 0.42)"}
      0%,
    rgba(0, 0, 0, 0) 70%
  );
`;

const MarkerPumo = styled.img`
  position: relative;
  height: clamp(46px, 9.5vh, 70px);
  width: auto;
  transform: scaleX(-1);
  filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.6))
    drop-shadow(
      0 0 10px
        ${(p) =>
          p.$dir === "down"
            ? "rgba(214, 90, 78, 0.5)"
            : "rgba(232, 197, 71, 0.45)"}
    );
`;

const Footer = styled.footer`
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const ActionButton = styled.button`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.85rem, 2.1vh, 1.2rem);
  letter-spacing: 0.06em;
  color: #1a1205;
  background: linear-gradient(160deg, ${C.gold} 0%, ${C.goldDeep} 100%);
  border: none;
  border-radius: 10px;
  padding: clamp(0.55rem, 1.7vh, 0.9rem) clamp(1.8rem, 5vw, 2.8rem);
  cursor: pointer;
  box-shadow: 0 10px 28px rgba(232, 197, 71, 0.26);
  transition: transform 0.12s ease, filter 0.12s ease;

  &:hover {
    transform: translateY(-2px);
    filter: brightness(1.06);
  }
`;

const Hint = styled.div`
  font-size: clamp(0.55rem, 1.2vh, 0.72rem);
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: ${C.creamFaint};
`;

// ============================================
// COMPONENT
// ============================================

function BanzukeBoard({
  rank = null,
  fromRank = null,
  toRank = null,
  title = "Banzuke",
  subtitle = "Career Ladder",
  buttonLabel = "Close",
  onReturn,
}) {
  const { player1Color, player1BodyColor } = usePlayerColors();
  const [src, setSrc] = useState(pumo);
  const mountedRef = useRef(true);

  // Is this an animated promotion/demotion reveal, or a static snapshot?
  const animated =
    !!fromRank && !!toRank && formatRank(fromRank) !== formatRank(toRank);
  const finalRank = toRank || rank || fromRank;
  const startRank = fromRank || rank || toRank;

  const fromPct = markerPct(startRank);
  const toPct = markerPct(finalRank);
  const dir = !animated
    ? "flat"
    : toPct < fromPct
    ? "up"
    : "down";

  const [pct, setPct] = useState(animated ? fromPct : toPct);
  const [reached, setReached] = useState(!animated);
  const timersRef = useRef([]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Recolor the marker sprite to the player's colors (shared recolor cache).
  useEffect(() => {
    const needsMawashi = player1Color && player1Color !== SPRITE_BASE_COLOR;
    const needsBody = !!player1BodyColor;
    if (!needsMawashi && !needsBody) {
      setSrc(pumo);
      return;
    }
    const bodyOpts = needsBody
      ? { bodyColorRange: GREY_BODY_RANGES, bodyColorHex: player1BodyColor }
      : {};
    recolorImage(pumo, BLUE_COLOR_RANGES, player1Color || SPRITE_BASE_COLOR, bodyOpts)
      .then((r) => mountedRef.current && setSrc(r))
      .catch(() => mountedRef.current && setSrc(pumo));
  }, [player1Color, player1BodyColor]);

  // Drive the climb: hold at the old rank, then release the marker up/down
  // the spine to the new rank with a stinger on launch.
  useEffect(() => {
    if (!animated) return undefined;
    const timers = timersRef.current;
    timers.push(
      setTimeout(() => {
        setPct(toPct);
        playBashoGong();
      }, 700),
    );
    timers.push(setTimeout(() => setReached(true), 700 + 1250));
    return () => {
      timers.forEach(clearTimeout);
      timersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animated]);

  // Tap anywhere to skip straight to the resolved position.
  const skip = () => {
    if (!animated || reached) return;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setPct(toPct);
    setReached(true);
  };

  const activeDivKey = getDivision(reached ? finalRank : startRank).division;
  const markerRank = reached ? finalRank : startRank;

  // Paint top→bottom (highest division first).
  const rows = [...DIVISIONS].reverse();

  return (
    <Screen onClick={skip}>
      <Header>
        <HeaderKanji aria-hidden>番付</HeaderKanji>
        <HeaderTitle>{title}</HeaderTitle>
        <HeaderSub>{subtitle}</HeaderSub>
      </Header>

      <Ladder>
        <Spine />
        {rows.map((d, i) => {
          const idx = divisionIndex(d.key);
          const tier = tierOf(idx);
          const accent = TIER_COLOR[tier];
          const isActive = d.key === activeDivKey;
          return (
            <Band
              key={d.key}
              $i={i}
              $top={i === 0}
              $active={isActive}
              $dir={dir}
            >
              <Node $active={isActive} $accent={accent} />
              <BandBody>
                <BandName $active={isActive}>{d.label}</BandName>
                <BandSub $accent={accent}>
                  {d.numbered ? `Numbered · #1–${d.maxNumber}` : "Title rank"}
                </BandSub>
              </BandBody>
              {isActive && reached ? (
                <YouChip $dir={dir}>
                  <span className="you">You</span>
                  <span className="rk">{formatRank(markerRank)}</span>
                </YouChip>
              ) : (
                <BandStep>{N - i}</BandStep>
              )}
            </Band>
          );
        })}

        <Marker $pct={pct} $dir={dir}>
          <MarkerHalo $dir={dir} />
          <MarkerPumo $dir={dir} src={src} alt="You" />
        </Marker>
      </Ladder>

      <Footer>
        {animated && !reached ? (
          <Hint>Tap to skip</Hint>
        ) : (
          <ActionButton
            onClick={(e) => {
              e.stopPropagation();
              playButtonPressSound2();
              onReturn?.();
            }}
            onMouseEnter={playButtonHoverSound}
          >
            {buttonLabel}
          </ActionButton>
        )}
      </Footer>
    </Screen>
  );
}

BanzukeBoard.propTypes = {
  rank: PropTypes.object,
  fromRank: PropTypes.object,
  toRank: PropTypes.object,
  title: PropTypes.string,
  subtitle: PropTypes.string,
  buttonLabel: PropTypes.string,
  onReturn: PropTypes.func,
};

export default BanzukeBoard;
