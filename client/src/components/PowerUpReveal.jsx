import { useState, useEffect, useContext, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import styled, { keyframes, css } from "styled-components";
import PropTypes from "prop-types";
import { SocketContext } from "../SocketContext";
import { C, FONT_DISPLAY, FONT_UI, FONT_WEIGHT, TRACK } from "./menuTheme";
import SumoGameAnnouncement from "./SumoGameAnnouncement";
import {
  HYPE_RAIL_TOP,
  HYPE_RAIL_TOP_MOBILE,
} from "./SumoHypeStamp";
import powerWaterIcon from "../assets/power-water.png";
import snowballImage from "../assets/snowball.png";
import pumoArmyIcon from "./pumo-army-icon.png";
import happyFeetIcon from "../assets/happy-feet.png";
import thickBlubberIcon from "../assets/thick-blubber-icon.png";
import flapIcon from "../assets/flap-icon.png";
import shatterPalmIcon from "../assets/shatter-palm-icon.png";

/*
 * PowerUpReveal — printed mini-card pickup per side.
 *
 * THE FOURTH PASS (vs. the previous "colored tile + floating
 *   stencil text above and below" pass):
 *
 *   The previous pass had three loose elements per cluster
 *   stacked vertically:
 *
 *       YOU             (stencil label, floating)
 *       [colored tile]  (icon on type-color)
 *       POWER WATER     (stencil name, floating)
 *
 *   The icon tile read fine as a physical object, but the
 *   YOU/OPP label above and the power-up name below both
 *   floated as raw stencil text with no anchor. Three
 *   disconnected pieces stacked vertically reads as
 *   "unfinished mockup" — the eye expects a single printed
 *   object since the moment is a single beat (your opponent
 *   committed; here is what they picked).
 *
 *   This pass merges everything into ONE printed object per
 *   side, reusing the same printed-program vocabulary as
 *   PowerUpSelection's cards but at smaller scale:
 *
 *     - Outer card: cream washi paper, sharp corners, 1.5px
 *       sumi border, 1px inner frame (the double-border that
 *       reads "printed card" rather than "div with a stroke").
 *     - Top zone: colored type-band with icon centered — same
 *       inset-bevel and dropshadow as the selection card's
 *       header so the reveal cards feel like the selection
 *       cards minified, not like a separate UI element.
 *     - Bottom zone: cream strip holding the power-up NAME in
 *       Bungee, sumi ink, centered. Name now sits ON the card,
 *       not floating below it. No stencil/outline treatment
 *       needed since it has its own paper backing.
 *     - YOU/OPP becomes a small printed TAB pinned to the top
 *       of the card, overhanging the colored band by a couple
 *       pixels. Sumi cardstock with cream Bungee text, mirrored
 *       across the centerline (P1's tab on the left edge, P2's
 *       tab on the right edge) so the pair faces each other
 *       like name plates at a sumo broadcast desk.
 *
 * STRUCTURE per cluster:
 *
 *       ┌────────────┐
 *       │ YOU ┐      │ ← tab pinned top edge, overhanging
 *       │ [colored]  │
 *       │  [icon]    │ ← colored art panel
 *       ├────────────┤
 *       │ POWER WATER│ ← cream name strip
 *       └────────────┘
 *
 *   P1 card on the left rail, P2 on the right — same edge as
 *   PERFECT / MATADOR, seated just above that stamp.
 *
 * MOTION:
 *   Local cluster slides in from the LEFT edge (west-side
 *   wrestler entrance), opponent cluster from the RIGHT (east-
 *   side). Pure translateX + opacity, no rotation, no
 *   overshoot. After ~2.4s both fade up off-screen as a single
 *   beat. The versus ROUND callout mounts and exits on this
 *   same clock.
 *
 * COLOR BUDGET:
 *   Cream washi cardstock + sumi ink (borders, name text, tab
 *   plate) + cream text inside the tab + the two functional
 *   power-type colors on the art panels. The tab is the same
 *   sumi-on-cream contrast the in-game HUD chrome uses, so
 *   the reveal card feels printed on the same paper stock as
 *   the prematch program and the rank plaques.
 */

// ============================================
// POWER-TYPE COLORS
// ============================================

/*
 * Same five-color set PowerUpSelection's card-header bands
 * use, plus a deep variant per color for the tile's bottom-
 * edge bevel. The player learns "this color = this power"
 * once during selection; the tile color here pays off that
 * learning during the reveal.
 */
const TYPE_COLORS = {
  speed: { main: "#00d2ff", deep: "#005f80" },
  power: { main: "#ff4444", deep: "#7a1c1c" },
  snowball: { main: "#74b9ff", deep: "#2a4a78" },
  pumo_army: { main: "#ffaa44", deep: "#8a5418" },
  thick_blubber: { main: "#ff5087", deep: "#a01f4a" },
  flap: { main: "#34e0c0", deep: "#15705f" },
  shatter_palm: { main: "#ffe566", deep: "#c99200" },
};

const FALLBACK_TYPE = { main: C.gold, deep: C.goldDeep };

const getTypeColor = (type) => TYPE_COLORS[type] || FALLBACK_TYPE;

// ============================================
// ANIMATIONS
// ============================================

const enterFromLeft = keyframes`
  from {
    opacity: 0;
    transform: translateX(-44px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
`;

const enterFromRight = keyframes`
  from {
    opacity: 0;
    transform: translateX(44px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
`;

const exitUp = keyframes`
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-14px);
  }
`;

// ============================================
// LAYOUT
// ============================================

const RevealOverlay = styled.div`
  position: absolute;
  inset: 0;
  /* Inside #game-hud: above HudShell (1000), below SumoGameAnnouncement
     impact layers (~1003+) so ritual callouts still pop over if overlapping. */
  z-index: 1002;
  pointer-events: none;
`;

/* Sit the card a step below the hype line — still above the combat rail. */
const REVEAL_BELOW_HYPE = "clamp(24px, 3.6cqh, 40px)";
/* In from the bezel — past the hype edge, still on each wrestler's side. */
const REVEAL_RAIL_INSET = "clamp(36px, 4.4cqw, 60px)";

/*
 * One card per side, a step below the PERFECT / MATADOR line,
 * inset toward the dohyo. `$isLeft` is P1. `$isLocal` is the tab.
 */
const Cluster = styled.div`
  position: absolute;
  bottom: calc(100% - ${HYPE_RAIL_TOP} - ${REVEAL_BELOW_HYPE});
  ${(p) =>
    p.$isLeft
      ? css`left: ${REVEAL_RAIL_INSET};`
      : css`right: ${REVEAL_RAIL_INSET};`}
  display: flex;
  flex-direction: column;
  align-items: ${(p) => (p.$isLeft ? "flex-start" : "flex-end")};
  width: max-content;
  box-sizing: border-box;
  opacity: 0;
  animation: ${(p) => (p.$isLeft ? enterFromLeft : enterFromRight)}
    0.4s cubic-bezier(0.2, 0.7, 0.2, 1) forwards;
  animation-delay: ${(p) => (p.$isLeft ? "0.05s" : "0.18s")};
  will-change: transform, opacity;

  ${(p) =>
    p.$isExiting &&
    css`
      animation: ${exitUp} 0.32s ease-in forwards;
      animation-delay: 0s;
    `}

  @media (max-width: 900px) {
    bottom: calc(100% - ${HYPE_RAIL_TOP_MOBILE} - ${REVEAL_BELOW_HYPE});
  }
`;

/*
 * The unified mini-card.
 *
 * Construction:
 *   - cream washi paper background with a 1.5px sumi outer
 *     border (sharp corners), and a 1px inner frame inset 3px
 *     via ::after for the double-border read-as-printed-card
 *     effect. Same recipe as PowerUpSelection's PowerCard so
 *     the reveal card feels like the selection card minified.
 *   - chunky 3px solid drop shadow in near-black plus a softer
 *     12px ambient shadow — keeps the card reading as physical
 *     cardstock on top of the arena rather than as a flat UI
 *     plate floating in front of it.
 *   - the card itself does NOT animate (only the parent
 *     Cluster wrapper handles the slide-in). Inner structure
 *     stays GPU-stable during entry.
 */
const RevealCard = styled.div`
  width: clamp(96px, 11cqw, 132px);
  display: flex;
  flex-direction: column;
  background: ${C.cream};
  border: 1.5px solid ${C.sumi};
  box-shadow:
    0 3px 0 rgba(0, 0, 0, 0.45),
    0 7px 14px rgba(0, 0, 0, 0.5);
  position: relative;

  /* Inner frame — faint sumi rule inset a few pixels in from
     the outer border. The two-rule sandwich is what turns the
     edge from "div stroke" into "printed card border." */
  &::after {
    content: "";
    position: absolute;
    inset: 3px;
    border: 1px solid rgba(60, 40, 20, 0.22);
    pointer-events: none;
  }

  @media (max-width: 700px) {
    width: clamp(80px, 14cqw, 108px);
  }
`;

/*
 * Top art panel — colored type-band with the icon centered.
 *
 *   - same inset top-cream highlight + inset bottom deep-color
 *     bevel as PowerUpSelection's CardHeader for a chunky
 *     pressed-color slab feel.
 *   - 1.5px sumi bottom border separates the colored zone from
 *     the cream name strip below, mirroring the hairline rule
 *     between the selection card's art panel and info zone.
 *   - aspect-ratio 1 / 0.7 — wider than tall, matching the
 *     PowerUpSelection CardHeader proportions (5/7 card × 48%
 *     header flex = roughly 1.49:1 W:H). Earlier passes used
 *     1 / 0.85 which read as "too square" with the icon
 *     floating in too much empty colored space. Tightening the
 *     aspect plus scaling the icon (below) makes the reveal
 *     card read as a true minified version of the selection
 *     card, not as a separate UI element.
 */
const CardArt = styled.div`
  width: 100%;
  aspect-ratio: 1 / 0.7;
  background: ${(p) => getTypeColor(p.$type).main};
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1.5px solid ${C.sumi};
  box-shadow:
    inset 0 -2px 0 ${(p) => getTypeColor(p.$type).deep},
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  position: relative;
`;

/* Icon, centered in the colored art panel.
 *
 * The previous pass jumped from clamp(36-50px) to clamp(52-72px)
 * which over-corrected — the icon felt slightly oversized and
 * crowded the colored panel. Pulling it back to clamp(44-62px)
 * keeps the visual share of the panel similar to the selection
 * card's icon-in-header proportion (~40% width, ~60% height) but
 * leaves a touch more breathing room on the colored surround,
 * which reads as "icon resting on a paint chip" rather than
 * "icon barely contained by a paint chip." */
const CardIcon = styled.img`
  width: clamp(44px, 5.6cqw, 62px);
  height: clamp(44px, 5.6cqw, 62px);
  object-fit: contain;
  filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.45));
  position: relative;
  z-index: 1;

  @media (max-width: 700px) {
    width: clamp(36px, 7cqw, 50px);
    height: clamp(36px, 7cqw, 50px);
  }
`;

/*
 * Bottom cream strip holding the power-up name. Sumi ink on
 * cream paper, Bungee uppercase, hairline horizontal padding.
 * No outline/stencil treatment needed since it has its own
 * paper backing now.
 *
 * Washi grain matches the selection card's ::before recipe
 * (verticals at 90deg + horizontals at 0deg, low alpha) so
 * cream reads as printed paper rather than as a paint chip.
 */
const CardName = styled.div`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.5rem, 0.78cqw, 0.66rem);
  color: ${C.inkText};
  text-transform: uppercase;
  letter-spacing: ${TRACK.display};
  line-height: 1.1;
  text-align: center;
  padding: clamp(5px, 0.7cqh, 8px) clamp(4px, 0.5cqw, 6px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  position: relative;
  background-image:
    repeating-linear-gradient(
      90deg,
      transparent 0,
      transparent 2px,
      rgba(60, 40, 20, 0.05) 2px,
      rgba(60, 40, 20, 0.05) 3px
    ),
    repeating-linear-gradient(
      0deg,
      transparent 0,
      transparent 4px,
      rgba(60, 40, 20, 0.035) 4px,
      rgba(60, 40, 20, 0.035) 5px
    );

  @media (max-width: 700px) {
    font-size: clamp(0.42rem, 1.4cqw, 0.56rem);
  }
`;

/*
 * YOU / OPP tab. A small sumi cardstock plate pinned to the
 * top edge of the card, overhanging it by ~4px so it reads as
 * a separate printed tab clipped onto the card rather than as
 * a banner inside it.
 *
 * Mirrored across the centerline: P1's tab lives on the LEFT
 * edge of P1's card, P2's tab on the RIGHT edge of P2's card.
 * The pair faces each other like name plates at a sumo
 * broadcast desk, which sells the "two competitors revealed"
 * symmetry far better than two tabs in the same corner would.
 *
 * Cream Bungee text on sumi plate — same contrast the in-game
 * HUD chrome uses, so the tab feels printed on the same stock
 * as the rank plaques.
 */
const PlayerTab = styled.span`
  position: absolute;
  top: -6px;
  ${(p) => (p.$onLeft ? "left: -2px;" : "right: -2px;")}
  background: ${C.sumi};
  /* YOU stays in cream (the neutral subject — confirmation of
     what you already know). OPP gets vermillion text on the same
     sumi tab — the surprise of the reveal IS what the opponent
     picked, so it earns the loud color treatment. Same tab
     structure on both sides, color does the work. */
  color: ${(p) => (p.$isLocal ? C.cream : C.vermillionBright)};
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.42rem, 0.7cqw, 0.58rem);
  letter-spacing: ${TRACK.label};
  text-transform: uppercase;
  padding: clamp(2px, 0.4cqh, 4px) clamp(5px, 0.7cqw, 8px);
  border: 1px solid rgba(245, 236, 217, 0.18);
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.5);
  z-index: 2;
  pointer-events: none;

  @media (max-width: 700px) {
    font-size: clamp(0.38rem, 1.2cqw, 0.5rem);
    padding: 2px 5px;
  }
`;

// ============================================
// COMPONENT
// ============================================

const REVEAL_HOLD_MS = 2400;
const REVEAL_EXIT_MS = 320;

const PowerUpReveal = ({ roomId, localId }) => {
  const { socket } = useContext(SocketContext);
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [revealData, setRevealData] = useState(null);
  const revealTimeoutsRef = useRef([]);

  const powerUpInfo = useMemo(
    () => ({
      speed: { name: "Happy Feet", icon: happyFeetIcon },
      power: { name: "Power Water", icon: powerWaterIcon },
      snowball: { name: "Snowball", icon: snowballImage },
      pumo_army: { name: "Pumo Army", icon: pumoArmyIcon },
      thick_blubber: { name: "Thick Blubber", icon: thickBlubberIcon },
      flap: { name: "Flap", icon: flapIcon },
      shatter_palm: { name: "Shatter Palm", icon: shatterPalmIcon },
    }),
    []
  );

  useEffect(() => {
    const handlePowerUpsRevealed = (data) => {
      if (!data?.player1 || !data?.player2) return;
      setRevealData({
        player1: data.player1,
        player2: data.player2,
        boutCard: data.boutCard || null,
      });
      setIsVisible(true);
      setIsExiting(false);

      revealTimeoutsRef.current.forEach(clearTimeout);
      revealTimeoutsRef.current = [];

      revealTimeoutsRef.current.push(
        setTimeout(() => {
          setIsExiting(true);
        }, REVEAL_HOLD_MS),
        setTimeout(() => {
          setIsVisible(false);
          setRevealData(null);
        }, REVEAL_HOLD_MS + REVEAL_EXIT_MS)
      );
    };

    const handleGameReset = () => {
      revealTimeoutsRef.current.forEach(clearTimeout);
      revealTimeoutsRef.current = [];
      setIsVisible(false);
      setIsExiting(false);
      setRevealData(null);
    };

    socket.on("power_ups_revealed", handlePowerUpsRevealed);
    socket.on("game_reset", handleGameReset);

    return () => {
      socket.off("power_ups_revealed", handlePowerUpsRevealed);
      socket.off("game_reset", handleGameReset);
      revealTimeoutsRef.current.forEach(clearTimeout);
      revealTimeoutsRef.current = [];
    };
  }, [socket, localId]);

  if (!isVisible || !revealData) return null;

  const hudEl = document.getElementById("game-hud");
  if (!hudEl) return null;

  /* Row order is always P1 left / P2 right; YOU vs OPP follows seat. */
  const isLocalP1 = revealData.player1.playerId === localId;
  const p1Info = powerUpInfo[revealData.player1.powerUpType];
  const p2Info = powerUpInfo[revealData.player2.powerUpType];

  return createPortal(
    <>
      {revealData.boutCard?.label && (
        <SumoGameAnnouncement
          type="boutcard"
          label={revealData.boutCard.label}
          final={!!revealData.boutCard.final}
          exiting={isExiting}
        />
      )}
      <RevealOverlay>
        <Cluster $isLeft={true} $isExiting={isExiting}>
          <RevealCard>
            <PlayerTab $onLeft={true} $isLocal={isLocalP1}>
              {isLocalP1 ? "You" : "Opp"}
            </PlayerTab>
            <CardArt $type={revealData.player1.powerUpType}>
              <CardIcon src={p1Info?.icon} alt={p1Info?.name} />
            </CardArt>
            <CardName>{p1Info?.name}</CardName>
          </RevealCard>
        </Cluster>

        <Cluster $isLeft={false} $isExiting={isExiting}>
          <RevealCard>
            <PlayerTab $onLeft={false} $isLocal={!isLocalP1}>
              {!isLocalP1 ? "You" : "Opp"}
            </PlayerTab>
            <CardArt $type={revealData.player2.powerUpType}>
              <CardIcon src={p2Info?.icon} alt={p2Info?.name} />
            </CardArt>
            <CardName>{p2Info?.name}</CardName>
          </RevealCard>
        </Cluster>
      </RevealOverlay>
    </>,
    hudEl
  );
};

PowerUpReveal.propTypes = {
  roomId: PropTypes.string.isRequired,
  localId: PropTypes.string.isRequired,
};

export default PowerUpReveal;
