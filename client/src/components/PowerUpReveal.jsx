import { useState, useEffect, useContext, useMemo, useRef } from "react";
import styled, { keyframes, css } from "styled-components";
import PropTypes from "prop-types";
import { SocketContext } from "../SocketContext";
import { C } from "./menuTheme";
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
 *     - Clusters move slightly inward (~6cqw from each edge
 *       instead of the previous ~3.5cqw). Pinning them to
 *       the extreme edges read as "screen chrome"; nudging
 *       them inward reads as "two pickups on the arena".
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
 *   Local cluster anchored to the LEFT edge with content
 *   center-aligned within the cluster. Opponent cluster
 *   mirrored on the RIGHT. The local always sits left
 *   regardless of P1/P2 seat — reads from your POV at a
 *   glance.
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
  z-index: 10000;
  pointer-events: none;
`;

/*
 * Cluster anchored to its SEAT side — left cluster is always
 * the player1 seat, right cluster is always the player2 seat.
 * This matches the rest of the in-game UI's spatial model:
 *   - HUD nameplates (PLAYER 1 left, PLAYER 2 right)
 *   - The "You ▼" indicator that floats above the local
 *     player's sprite wherever they are on the dohyo
 *   - The actual penguin sprite positions
 *
 * The LOCAL/OPP distinction is now carried by the TileLabel
 * (YOU vs OPP, and the cream/vermillion color swap), NOT by
 * the cluster's screen position. So in a PvP match where the
 * local player happens to be P2, the YOU tile correctly sits
 * on the RIGHT — matching where their penguin is — instead
 * of being forced to the left as in the previous pass.
 *
 * `$isLeft` drives position and entrance direction (P1 enters
 * from West, P2 enters from East — same wrestler-entrance
 * choreography). `$isLocal` is independent and only controls
 * the label content + color inside the tile.
 */
const Cluster = styled.div`
  position: absolute;
  /* Vertical position matches SumoAnnouncementBanner so the
     two side callouts share the same eye-line — reveal at
     round start and the in-game announcement banners both
     land at the same height in your peripheral. */
  top: clamp(220px, 38cqh, 290px);
  ${(p) =>
    p.$isLeft
      ? css`
          left: clamp(40px, 6cqw, 96px);
        `
      : css`
          right: clamp(40px, 6cqw, 96px);
        `}
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(6px, 0.9cqh, 10px);
  max-width: 38cqw;
  width: max-content;
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

  @media (max-width: 700px) {
    top: clamp(170px, 32cqh, 240px);
    max-width: 44cqw;
    ${(p) =>
      p.$isLeft
        ? css`
            left: clamp(30px, 7cqw, 64px);
          `
        : css`
            right: clamp(30px, 7cqw, 64px);
          `}
  }
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
  flex-direction: column;
  align-items: center;
  padding: clamp(4px, 0.65cqh, 6px) clamp(3px, 0.4cqw, 5px)
    clamp(5px, 0.75cqh, 8px);
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

/*
 * YOU / OPP label, sitting INSIDE the tile at the top.
 *
 * YOU is cream — the neutral subject of the reveal (you
 * already know what you picked, no surprise to highlight).
 * OPP is vermillion-bright — the LOUD color, drawing the
 * eye to the surprise of what your opponent went with.
 * This is inverted from the previous pass where YOU was
 * vermillion; the new mapping is correct because the
 * surprise of the reveal lives on the opponent's side.
 *
 * The sumi stencil stroke around the label is what keeps
 * vermillion legible against the red Power Water tile, the
 * cyan Happy Feet tile, etc. — the dark outline guarantees
 * the text reads regardless of which color tile it sits on.
 */
const TileLabel = styled.span`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 700;
  font-size: clamp(0.42rem, 0.74cqw, 0.58rem);
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: ${(p) => (p.$isLocal ? C.cream : C.vermillionBright)};
  text-shadow:
    -1px 0 0 ${C.sumi}, 1px 0 0 ${C.sumi},
    0 -1px 0 ${C.sumi}, 0 1px 0 ${C.sumi},
    0 1px 0 rgba(0, 0, 0, 0.5);
  white-space: nowrap;

  @media (max-width: 700px) {
    font-size: clamp(0.36rem, 1.2cqw, 0.5rem);
    letter-spacing: 0.16em;
  }
`;

/*
 * Icon centered in the remaining vertical space below the
 * label. `margin: auto 0` is the cleanest way to vertically
 * center inside the column flex without adding a wrapper
 * div — the auto margins absorb whatever space is left
 * between the top-pinned label and the bottom padding.
 */
const TileIcon = styled.img`
  width: clamp(34px, 4.4cqw, 48px);
  height: clamp(34px, 4.4cqw, 48px);
  object-fit: contain;
  margin: auto 0;
  filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.5));

  @media (max-width: 700px) {
    width: clamp(30px, 5.6cqw, 40px);
    height: clamp(30px, 5.6cqw, 40px);
  }
`;

/*
 * Power-up name. Big cream Bungee with a sumi stencil
 * stroke + soft halo so it reads as broadcast-SFX text
 * against any arena content underneath. Same legibility
 * recipe PowerUpReveal has used since the second pass —
 * the only thing that changed in this pass is that the
 * name no longer has a colored underline beneath it
 * (color identity is now carried by the tile above).
 */
const Name = styled.span`
  font-family: "Bungee", cursive;
  font-size: clamp(0.72rem, 1.3cqw, 1.05rem);
  color: ${C.cream};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  line-height: 1;
  white-space: nowrap;
  text-shadow:
    -1.5px 0 0 ${C.sumi}, 1.5px 0 0 ${C.sumi},
    0 -1.5px 0 ${C.sumi}, 0 1.5px 0 ${C.sumi},
    -1.5px -1.5px 0 ${C.sumi}, 1.5px -1.5px 0 ${C.sumi},
    -1.5px 1.5px 0 ${C.sumi}, 1.5px 1.5px 0 ${C.sumi},
    0 3px 0 rgba(0, 0, 0, 0.55),
    0 0 12px rgba(0, 0, 0, 0.6);

  @media (max-width: 700px) {
    font-size: clamp(0.62rem, 2cqw, 0.85rem);
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

  /*
   * Cluster position is locked to the SEAT (P1=left, P2=right)
   * to match the rest of the in-game UI — HUD nameplates, the
   * floating "You ▼" indicator, and the actual penguin sprite
   * positions. The YOU vs OPP label is then chosen per-cluster
   * based on which seat the local client is occupying.
   *
   * In a 1v1 PvP match where you're seated as P2, the YOU tile
   * correctly appears on the RIGHT — directly above where your
   * penguin is standing — instead of being forced to the left
   * as in the previous pass.
   */
  const isLocalP1 = revealData.player1.playerId === localId;
  const p1Info = powerUpInfo[revealData.player1.powerUpType];
  const p2Info = powerUpInfo[revealData.player2.powerUpType];

  return (
    <RevealOverlay>
      {/* LEFT seat — Player 1 (West-side entrance) */}
      <Cluster $isLeft={true} $isExiting={isExiting}>
        <IconTile $type={revealData.player1.powerUpType}>
          <TileLabel $isLocal={isLocalP1}>
            {isLocalP1 ? "You" : "Opp"}
          </TileLabel>
          <TileIcon src={p1Info?.icon} alt={p1Info?.name} />
        </IconTile>
        <Name>{p1Info?.name}</Name>
      </Cluster>

      {/* RIGHT seat — Player 2 (East-side entrance) */}
      <Cluster $isLeft={false} $isExiting={isExiting}>
        <IconTile $type={revealData.player2.powerUpType}>
          <TileLabel $isLocal={!isLocalP1}>
            {!isLocalP1 ? "You" : "Opp"}
          </TileLabel>
          <TileIcon src={p2Info?.icon} alt={p2Info?.name} />
        </IconTile>
        <Name>{p2Info?.name}</Name>
      </Cluster>
    </RevealOverlay>
  );
};

PowerUpReveal.propTypes = {
  roomId: PropTypes.string.isRequired,
  localId: PropTypes.string.isRequired,
};

export default PowerUpReveal;
