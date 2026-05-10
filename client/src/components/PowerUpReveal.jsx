import { useState, useEffect, useContext, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import styled, { keyframes, css } from "styled-components";
import PropTypes from "prop-types";
import { SocketContext } from "../SocketContext";
import { C } from "./menuTheme";
import { ANNOUNCE_Y } from "./SumoGameAnnouncement";
import powerWaterIcon from "../assets/power-water.png";
import snowballImage from "../assets/snowball.png";
import pumoArmyIcon from "./pumo-army-icon.png";
import happyFeetIcon from "../assets/happy-feet.png";
import thickBlubberIcon from "../assets/thick-blubber-icon.png";

/*
 * PowerUpReveal — colored tile pickup card per side.
 *
 * THE THIRD PASS (vs. the previous "naked icon + colored
 *   underline" pass):
 *
 *   The previous pass put the power-color identity on a thin
 *   underline beneath the power-up name and left the icon
 *   completely naked. Two issues with that:
 *
 *     1. The icon felt orphaned. Asset, drop shadow, then
 *        empty space — there was nothing visually grouping
 *        the icon and the type identity together. The color
 *        was carried entirely by a 3px line several pixels
 *        below the icon, so the icon read as decorative
 *        rather than as the power's primary face.
 *     2. The YOU/OPP caption color choice was inverted from
 *        what the moment actually IS. The previous pass put
 *        YOU in vermillion (the loud color) and OPP in cream
 *        (the quiet color). But the surprise of the reveal
 *        is what your OPPONENT picked — you already know
 *        what you picked. The opponent's pick deserves the
 *        loud color treatment, yours doesn't.
 *
 *   This pass:
 *     - The power-color identity moves OFF the underline and
 *       ONTO the icon's background. Each pick gets a colored
 *       tile (sharp corners, faint inset bevel + drop shadow,
 *       like a physical pickup card resting on the arena)
 *       holding the icon. No more separate underline element
 *       — the tile IS the color identity.
 *     - The YOU/OPP label moves INTO the tile, sitting at
 *       the top with the icon centered in the remaining
 *       space below it. Same vocabulary as PowerUpSelection's
 *       card-header band: a colored zone with a label and
 *       icon, sized smaller and used as a single tile rather
 *       than a card top-stripe.
 *     - YOU is cream (the neutral subject — confirmation of
 *       what you already know). OPP is vermillion-bright
 *       (the loud highlight — the surprise reveal of what
 *       you DIDN'T know).
 *     - Clusters sit in the announcement band (same top anchor
 *       as hakkiyoi / te wo tsuite), centered as a pair with a
 *       controlled gap — under the HUD, above the fighters.
 *
 * STRUCTURE per cluster:
 *
 *       ┌──────────────┐
 *       │     YOU      │   ← label inside tile, top
 *       │              │
 *       │    [icon]    │   ← icon centered in remaining space
 *       │              │
 *       └──────────────┘
 *         POWER WATER     ← name in big Bungee, cream stencil
 *                           stroke, sits BELOW the tile
 *
 *   P1 cluster on the left, P2 on the right in a centered row;
 *   YOU/OPP labels still reflect seat via TileLabel, not position.
 *
 * MOTION:
 *   Local cluster slides in from the LEFT edge (the West-
 *   side wrestler entrance), opponent cluster from the RIGHT
 *   edge (East-side). Pure translateX + opacity, no
 *   rotation, no overshoot. Once they land, nothing loops.
 *   After ~2.4s both fade up off-screen as a single beat.
 *
 * COLOR BUDGET:
 *   Cream Bungee names + sumi stencil strokes + cream YOU
 *   stamp + vermillion OPP stamp + the two functional
 *   power-type tiles. No gold, no dark brown, no panel
 *   chrome, no underline rule.
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
  thick_blubber: { main: "#aa77ff", deep: "#4a2c8a" },
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

/*
 * Full HUD width with the pair centered as a unit. Each cluster uses
 * the same fixed column width so tile midpoints stay on-axis with the
 * screen center (max-content flex skewed that). Tile-to-tile distance
 * is driven by column width — keep columns ~tile-sized, not HUD-wide.
 */
const RevealRow = styled.div`
  position: absolute;
  top: calc(${ANNOUNCE_Y} - clamp(68px, 7.5cqh, 104px));
  left: 0;
  right: 0;
  width: 100%;
  padding-inline: clamp(10px, 2.5cqw, 28px);
  box-sizing: border-box;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: flex-start;
  gap: clamp(12px, 3cqw, 28px);
  pointer-events: none;

  @media (max-width: 700px) {
    gap: clamp(10px, 2.6cqw, 22px);
    padding-inline: clamp(8px, 3cqw, 20px);
  }
`;

/*
 * Cluster order is always P1 then P2 left-to-right in the row.
 * LOCAL/OPP is carried by TileLabel only — if you are P2, YOU is
 * still the right-hand tile.
 *
 * `$isLeft` selects entrance direction (west vs east). `$isLocal`
 * only affects label styling inside the tile.
 */
/* Wide enough for longest Bungee title without overlap; equal cols keep tiles centered on screen. */
const CLUSTER_COL = "clamp(148px, 23cqw, 208px)";

const Cluster = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(8px, 0.95cqh, 12px);
  flex: 0 0 ${CLUSTER_COL};
  width: ${CLUSTER_COL};
  max-width: ${CLUSTER_COL};
  min-width: 0;
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

`;

/*
 * The colored tile. Sharp corners (printed-program canon),
 * filled with the power-type's main color, with:
 *   - inset 1px cream highlight at the top edge (catches
 *     light, gives the tile a "pressed" feel rather than a
 *     flat painted slab)
 *   - inset 2px deep-color shadow at the bottom edge (the
 *     same trick PowerUpSelection's CardHeader uses to mark
 *     a chunky bottom bevel without needing a separate
 *     element)
 *   - a chunky 5px solid drop shadow in near-black, plus a
 *     soft 18px ambient drop shadow — together these make
 *     the tile read as a physical card resting on the arena
 *     rather than as a flat UI plate floating in front of it.
 *
 * Layout inside the tile is column-flex with the label
 * pinned to the top and the icon centered in the remaining
 * space via auto vertical margins on the icon — clean stack
 * without needing intermediate wrapper divs.
 */
const IconTile = styled.div`
  width: clamp(56px, 6.8cqw, 76px);
  height: clamp(66px, 8.2cqh, 86px);
  background: ${(p) => getTypeColor(p.$type).main};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(6px, 0.85cqh, 9px) clamp(4px, 0.5cqw, 6px);
  box-shadow:
    inset 0 -2px 0 ${(p) => getTypeColor(p.$type).deep},
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    0 3px 0 rgba(0, 0, 0, 0.42),
    0 5px 11px rgba(0, 0, 0, 0.5);
  position: relative;

  @media (max-width: 700px) {
    width: clamp(48px, 8.5cqw, 64px);
    height: clamp(58px, 10.5cqh, 72px);
  }
`;

/* YOU / OPP — above the tile; thin ink outline reads cleaner than stacked drops. */
const TileLabel = styled.span`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 800;
  font-size: clamp(0.5rem, 0.85cqw, 0.66rem);
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: ${(p) => (p.$isLocal ? "#fff9f0" : "#ff8f82")};
  -webkit-text-stroke: clamp(0.4px, 0.06cqw, 0.95px) rgba(12, 14, 22, 0.94);
  paint-order: stroke fill;
  white-space: nowrap;

  @media (max-width: 700px) {
    font-size: clamp(0.42rem, 1.3cqw, 0.56rem);
    letter-spacing: 0.22em;
  }
`;

/*
 * Icon, centered inside the colored tile. The tile uses
 * flex centering so no margin tricks needed — the icon just
 * sits in the middle of the colored field with the tile's
 * deep-color bottom-bevel underneath catching it.
 */
const TileIcon = styled.img`
  width: clamp(38px, 4.8cqw, 52px);
  height: clamp(38px, 4.8cqw, 52px);
  object-fit: contain;
  filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.5));

  @media (max-width: 700px) {
    width: clamp(32px, 6.2cqw, 44px);
    height: clamp(32px, 6.2cqw, 44px);
  }
`;

/* Power-up title — Bungee with a uniform outline (no offset “stamp” shadows). */
const Name = styled.span`
  font-family: "Bungee", cursive;
  font-size: clamp(0.7rem, 1.18cqw, 0.95rem);
  color: #fffbf5;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  line-height: 1;
  white-space: nowrap;
  -webkit-text-stroke: clamp(0.55px, 0.1cqw, 1.45px) rgba(12, 14, 22, 0.92);
  paint-order: stroke fill;

  @media (max-width: 700px) {
    font-size: clamp(0.6rem, 1.85cqw, 0.78rem);
  }
`;

// ============================================
// COMPONENT
// ============================================

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
    }),
    []
  );

  useEffect(() => {
    const handlePowerUpsRevealed = (data) => {
      setRevealData({
        player1: data.player1,
        player2: data.player2,
      });
      setIsVisible(true);
      setIsExiting(false);

      revealTimeoutsRef.current.forEach(clearTimeout);
      revealTimeoutsRef.current = [];

      revealTimeoutsRef.current.push(
        setTimeout(() => {
          setIsExiting(true);
        }, 2400),
        setTimeout(() => {
          setIsVisible(false);
          setRevealData(null);
        }, 2760)
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
    <RevealOverlay>
      <RevealRow>
        {/* P1 — west-side entrance animation */}
        <Cluster $isLeft={true} $isExiting={isExiting}>
          <TileLabel $isLocal={isLocalP1}>
            {isLocalP1 ? "You" : "Opp"}
          </TileLabel>
          <IconTile $type={revealData.player1.powerUpType}>
            <TileIcon src={p1Info?.icon} alt={p1Info?.name} />
          </IconTile>
          <Name>{p1Info?.name}</Name>
        </Cluster>

        {/* P2 — east-side entrance animation */}
        <Cluster $isLeft={false} $isExiting={isExiting}>
          <TileLabel $isLocal={!isLocalP1}>
            {!isLocalP1 ? "You" : "Opp"}
          </TileLabel>
          <IconTile $type={revealData.player2.powerUpType}>
            <TileIcon src={p2Info?.icon} alt={p2Info?.name} />
          </IconTile>
          <Name>{p2Info?.name}</Name>
        </Cluster>
      </RevealRow>
    </RevealOverlay>,
    hudEl
  );
};

PowerUpReveal.propTypes = {
  roomId: PropTypes.string.isRequired,
  localId: PropTypes.string.isRequired,
};

export default PowerUpReveal;
