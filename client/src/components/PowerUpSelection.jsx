import {
  useState,
  useEffect,
  useContext,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import styled, { keyframes, css } from "styled-components";
import PropTypes from "prop-types";
import { SocketContext } from "../SocketContext";
import {
  playPowerUpSelectionHoverSound,
  playPowerUpSelectionPressSound,
} from "../utils/soundUtils";
import { C } from "./menuTheme";
import powerWaterIcon from "../assets/power-water.png";
import snowballImage from "../assets/snowball.png";
import pumoArmyIcon from "./pumo-army-icon.png";
import happyFeetIcon from "../assets/happy-feet.png";
import thickBlubberIcon from "../assets/thick-blubber-icon.png";

/*
 * PowerUpSelection — three picks on a darkened dohyo, no panel.
 *
 * THE REWRITE (vs. the previous "lacquered sumi-ink board" pass):
 *   The previous pass put the three power-up cards INSIDE a
 *   surrounding dark sumi panel — title strip, vermillion top
 *   rule, washi-fibre grain background, bordered timer row at
 *   the bottom. That was chrome around chrome: the panel was
 *   just a frame for cards that were already their own
 *   discrete surfaces. Two layers of "this is a UI" doing the
 *   work of one.
 *
 *   The cards are the actual interactive objects. The frame
 *   wasn't earning its space. So the frame is gone — the
 *   surrounding panel, the title, the diamond divider, the
 *   bordered timer row, all of it. What's left is what
 *   roguelikes ("pick a boon" in Hades, card rewards in Slay
 *   the Spire, item picks in Risk of Rain 2) figured out a
 *   long time ago: dim the world to a spotlight, put the
 *   picks ON the world as physical objects, let the player
 *   reach into the picks instead of into a window full of UI.
 *
 * SHAPE:
 *   - Arena dims to a flat ~55% black scrim. No vignette
 *     gradient, no radial spotlight, no warm haze. Hades
 *     and Slay the Spire both use flat dim — it's the
 *     single most powerful "the picks are the screen now"
 *     move and over-engineering it kills the effect.
 *   - Three cream washi cards sit centered on the dimmed
 *     dohyo, in a horizontal row, casting hard drop shadows
 *     onto the arena floor (so they read as physical objects
 *     resting on the dohyo, not as UI floating in front of
 *     it). The cards retain their two-zone composition
 *     (power-color header band with icon, cream body with
 *     name + description + usage chip) — that structure is
 *     what makes them read as cards rather than amorphous
 *     pickups, and the cream body is where description text
 *     lives so legibility never depends on stencil tricks.
 *   - No title. No "SELECT POWER" headline, no "CHOOSE YOUR
 *     SUMO EDGE" subtitle. The three cards + a floating
 *     timer already say "pick one before time runs out". A
 *     headline above three obviously-pickable cards is the
 *     same kind of redundant chrome the panel was — it's
 *     telling you what the screen is when the screen has
 *     already shown you what it is.
 *   - Free-floating timer at the bottom of the screen, in
 *     the same broadcast-SFX stencil text vocabulary
 *     PowerUpReveal uses (cream Bungee with sumi stroke +
 *     halo). Vermillion when ≤5s — single discrete color
 *     swap, no infinite pulse loop.
 *
 * FEEL — fun to press:
 *   The hover and press states are tuned for arcade weight,
 *   not boardroom polish. A card on hover lifts -12px and
 *   scales to 1.025 with a soft outer halo in its power
 *   color — it physically rises to meet the cursor. Press
 *   compresses it back to -6px / 1.005 in 80ms (snap, then
 *   release). Locking a pick lifts it further to -16px /
 *   1.035 with a thicker halo, and the other two cards
 *   simultaneously retreat — opacity drops to 0.22, color
 *   desaturates to 30%, scale shrinks to 0.97. The picked
 *   card is alone on the spotlight; the unpicked cards
 *   dissolve back into the dim arena.
 *
 *   No rotation on hover (the user explicitly disliked
 *   crooked-on-hover in the previous PowerUpReveal pass —
 *   the principle carries over). No infinite shimmer on
 *   the cards. No pulse on the selected state. Each beat
 *   of the interaction is a single state change.
 *
 * COLOR BUDGET:
 *   Cream cards + sumi text + the five functional power-type
 *   colors (cyan / red / blue / orange / purple) on each
 *   card's header band and hover halo + one vermillion
 *   urgent-timer color. No gold trim, no dark brown anywhere
 *   on the screen.
 */

// ============================================
// ANIMATIONS
// ============================================

const overlayFadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

/*
 * Cards "deal in" from below. Slide up + fade, no rotation,
 * no overshoot. Each card lands ~80ms after the previous one
 * so the row reads as three cards being placed in sequence
 * onto the dohyo, not as one synchronized UI element appearing.
 */
const cardDealIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(28px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const timerFadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

// ============================================
// OVERLAY + STAGE
// ============================================

const PowerUpSelectionOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1400;
  pointer-events: none;
  opacity: 0;
  animation: ${overlayFadeIn} 0.22s ease-out forwards;

  /*
   * The single move that compensates for losing the panel —
   * dim the arena harder so the cards POP as the only bright
   * thing on screen. Flat black at 55%; no radial gradient,
   * no warm wash, no backdrop-filter (the menu theme rules
   * forbid backdrop-filter explicitly).
   */
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    pointer-events: none;
  }
`;

const PowerUpSelectionStage = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(22px, 3.4cqh, 36px);
  padding: clamp(24px, 4vh, 48px) clamp(20px, 4vw, 40px);
  pointer-events: none;
`;

// ============================================
// CARDS
// ============================================

const CardsContainer = styled.div`
  display: flex;
  gap: clamp(14px, 1.9cqw, 24px);
  justify-content: center;
  align-items: stretch;
  flex-wrap: nowrap;
  pointer-events: auto;
  /* Padding-top reserves room for the hover-lift translateY
     so cards rising on hover don't get clipped by an
     ancestor's overflow boundary or look like they're
     punching through the layout above. */
  padding-top: clamp(14px, 2cqh, 22px);
`;

/*
 * Power-type colors. Each card gets a main fill (the header
 * band), a deep variant (the bottom-edge bevel), and a glow
 * color (the hover halo). The five colors are the same
 * functional gameplay set the player learns once during
 * selection and re-encounters in the PowerUpReveal underline
 * and the in-game power-up chip.
 */
const TYPE_COLORS = {
  speed: {
    main: "#00d2ff",
    deep: "#005f80",
    glow: "rgba(0, 210, 255, 0.45)",
  },
  power: {
    main: "#ff4444",
    deep: "#7a1c1c",
    glow: "rgba(255, 68, 68, 0.45)",
  },
  snowball: {
    main: "#74b9ff",
    deep: "#2a4a78",
    glow: "rgba(116, 185, 255, 0.45)",
  },
  pumo_army: {
    main: "#ffaa44",
    deep: "#8a5418",
    glow: "rgba(255, 170, 68, 0.45)",
  },
  thick_blubber: {
    main: "#aa77ff",
    deep: "#4a2c8a",
    glow: "rgba(170, 119, 255, 0.45)",
  },
};
const FALLBACK_TYPE = {
  main: C.gold,
  deep: C.goldDeep,
  glow: "rgba(232, 197, 71, 0.45)",
};

const getTypeColor = (type) => TYPE_COLORS[type] || FALLBACK_TYPE;

/*
 * The card. Bigger and more poster-like than the previous
 * pass — the header band is taller, the icon is the hero
 * element, the body has more breathing room. Cream washi
 * paper, sharp corners, hard warm drop shadow so it casts
 * onto the dohyo as a physical object.
 *
 * Interaction states tuned for arcade weight:
 *   REST    : translateY(0) scale(1), neutral warm shadow
 *   HOVER   : translateY(-12px) scale(1.025), border swaps
 *             to power color, soft outer halo in power glow
 *             color. Card physically rises to meet cursor.
 *   PRESS   : translateY(-6px) scale(1.005), 80ms snap.
 *             Quick compress feedback on click.
 *   PICKED  : translateY(-16px) scale(1.035), thicker halo.
 *             The chosen card is alone on the spotlight.
 *   LOCKED  : (other cards once one is picked) opacity 0.22,
 *             saturate(0.3) brightness(0.85), scale(0.97).
 *             They visibly retreat into the dim arena.
 */
const PowerCard = styled.button`
  --type-color: ${(p) => getTypeColor(p.$type).main};
  --type-deep: ${(p) => getTypeColor(p.$type).deep};
  --type-glow: ${(p) => getTypeColor(p.$type).glow};

  position: relative;
  flex: 0 0 auto;
  width: clamp(140px, 16cqw, 192px);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  background: ${C.cream};
  border: 2px solid rgba(60, 40, 20, 0.5);
  cursor: pointer;
  font-family: "Space Grotesk", sans-serif;
  padding: 0;
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.45),
    0 2px 0 rgba(60, 40, 20, 0.55);
  opacity: 0;
  animation: ${cardDealIn} 0.38s cubic-bezier(0.2, 0.7, 0.2, 1)
    forwards;
  animation-delay: ${(p) => 0.08 + p.$index * 0.08}s;
  transition: transform 0.18s cubic-bezier(0.2, 0.7, 0.2, 1),
    border-color 0.18s ease, box-shadow 0.18s ease,
    opacity 0.22s ease, filter 0.22s ease;
  will-change: transform, opacity;

  &:hover:not(:disabled) {
    transform: translateY(-12px) scale(1.025);
    border-color: var(--type-color);
    box-shadow: 0 22px 34px rgba(0, 0, 0, 0.55),
      0 2px 0 rgba(60, 40, 20, 0.55), 0 0 0 1px var(--type-color),
      0 0 32px var(--type-glow);
  }

  &:active:not(:disabled) {
    transform: translateY(-6px) scale(1.005);
    transition: transform 0.08s ease;
  }

  ${(p) =>
    p.$selected &&
    css`
      transform: translateY(-16px) scale(1.035);
      border-color: var(--type-color);
      box-shadow: 0 28px 40px rgba(0, 0, 0, 0.6),
        0 2px 0 rgba(60, 40, 20, 0.55),
        0 0 0 2px var(--type-color), 0 0 44px var(--type-glow);
    `}

  &:disabled {
    cursor: not-allowed;
    ${(p) =>
      !p.$selected &&
      css`
        opacity: 0.22;
        filter: saturate(0.3) brightness(0.88);
        transform: translateY(0) scale(0.97);
      `}
  }

  @media (max-width: 700px) {
    width: clamp(106px, 22cqw, 138px);
  }
`;

/*
 * Power-color header band. Solid fill, icon centered, the
 * hero of the card. Tall enough that the icon reads as a
 * poster element, not a chip. A 2px deep-color bottom-edge
 * bevel marks the transition into the cream body without
 * needing a separate divider element.
 *
 * No 135deg gradient (the canonical AI app-icon look). Flat
 * color is more confident and roguelike — Hades' boon
 * medallions are flat color too.
 */
const CardHeader = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: clamp(64px, 8.4cqh, 90px);
  background: var(--type-color);
  box-shadow: inset 0 -2px 0 var(--type-deep),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);

  img {
    width: clamp(40px, 5.2cqw, 58px);
    height: clamp(40px, 5.2cqw, 58px);
    object-fit: contain;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
  }

  @media (max-width: 700px) {
    height: clamp(50px, 10cqh, 68px);
    img {
      width: clamp(32px, 6.5cqw, 44px);
      height: clamp(32px, 6.5cqw, 44px);
    }
  }
`;

const CardBody = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(7px, 1cqh, 11px);
  padding: clamp(14px, 1.9cqh, 20px) clamp(10px, 1.2cqw, 14px)
    clamp(13px, 1.7cqh, 17px);
  position: relative;
  flex: 1;

  /* Faint warm paper grain on the cream body — same recipe
     as PreMatchScreen and MatchOver, ties the card material
     to the printed-program family even though the
     surrounding panel chrome is gone. */
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image: repeating-linear-gradient(
      0deg,
      rgba(60, 40, 20, 0.04) 0,
      transparent 1px,
      transparent 3px
    );
    pointer-events: none;
  }
`;

const PowerName = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.6rem, 1.05cqw, 0.82rem);
  color: ${C.inkText};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  text-align: center;
  line-height: 1.05;
  position: relative;

  @media (max-width: 700px) {
    font-size: clamp(0.5rem, 1.7cqw, 0.66rem);
  }
`;

const PowerDesc = styled.div`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 600;
  font-size: clamp(0.5rem, 0.9cqw, 0.66rem);
  color: ${C.inkTextSoft};
  text-align: center;
  line-height: 1.25;
  letter-spacing: 0.03em;
  position: relative;

  @media (max-width: 700px) {
    font-size: clamp(0.42rem, 1.5cqw, 0.56rem);
  }
`;

/*
 * Usage chip — same role-contrast vocabulary the rest of the
 * game uses for active vs passive hint state:
 *
 *   PASSIVE → muted ink on cream. Recedes into the body.
 *   ACTIVE  → cream on sumi-ink. High contrast, full inverse
 *             of the passive chip. Reads as "press F to use".
 *
 * Sumi-on-cream stays the active color (rather than vermillion)
 * because vermillion clashes with the red Power Water card
 * header whenever both are visible together, and reads as
 * an alert state rather than an input hint. The same logic
 * the previous pass landed on — kept here.
 */
const UsageChip = styled.div`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 700;
  font-size: clamp(0.4rem, 0.68cqw, 0.5rem);
  letter-spacing: 0.22em;
  text-transform: uppercase;
  padding: 2px clamp(6px, 0.85cqw, 9px);
  margin-top: clamp(2px, 0.4cqh, 5px);
  background: ${(p) =>
    p.$active ? C.sumi : "rgba(60, 40, 20, 0.08)"};
  color: ${(p) => (p.$active ? C.cream : C.inkTextMute)};
  border: 1px solid
    ${(p) => (p.$active ? "#000" : "rgba(60, 40, 20, 0.22)")};
  position: relative;
  z-index: 1;
  white-space: nowrap;

  @media (max-width: 700px) {
    font-size: clamp(0.34rem, 1.1cqw, 0.44rem);
    letter-spacing: 0.16em;
  }
`;

// ============================================
// TIMER — free-floating broadcast-SFX stencil
// ============================================

/*
 * Stacked label + number, no border, no diamond, no row chrome.
 * Same legibility recipe as PowerUpReveal (cream Bungee with
 * sumi stencil stroke + halo) so it reads against any arena
 * content underneath without a panel behind it.
 *
 * Single-color urgency: when ≤5s, the number swaps from cream
 * to vermillion. No infinite scale pulse, no shadow-breathe
 * loop — the color swap is signal enough, and the player is
 * already looking at this number.
 */
const TimerStack = styled.div`
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(3px, 0.5cqh, 6px);
  opacity: 0;
  animation: ${timerFadeIn} 0.32s ease-out forwards;
  animation-delay: 0.32s;
`;

const TimerLabel = styled.span`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 700;
  font-size: clamp(0.5rem, 0.85cqw, 0.7rem);
  color: ${C.cream};
  text-transform: uppercase;
  letter-spacing: 0.32em;
  text-shadow: -1px 0 0 ${C.sumi}, 1px 0 0 ${C.sumi},
    0 -1px 0 ${C.sumi}, 0 1px 0 ${C.sumi},
    0 2px 0 rgba(0, 0, 0, 0.5), 0 0 6px rgba(0, 0, 0, 0.6);

  @media (max-width: 700px) {
    font-size: clamp(0.42rem, 1.4cqw, 0.6rem);
    letter-spacing: 0.24em;
  }
`;

const TimerNumber = styled.span`
  font-family: "Bungee", cursive;
  font-size: clamp(1.4rem, 2.6cqw, 2.1rem);
  color: ${(p) => (p.$urgent ? C.vermillionBright : C.cream)};
  letter-spacing: 0.04em;
  line-height: 1;
  transition: color 0.2s ease;
  text-shadow: -1.5px 0 0 ${C.sumi}, 1.5px 0 0 ${C.sumi},
    0 -1.5px 0 ${C.sumi}, 0 1.5px 0 ${C.sumi},
    -1.5px -1.5px 0 ${C.sumi}, 1.5px -1.5px 0 ${C.sumi},
    -1.5px 1.5px 0 ${C.sumi}, 1.5px 1.5px 0 ${C.sumi},
    0 3px 0 rgba(0, 0, 0, 0.6), 0 0 12px rgba(0, 0, 0, 0.7);

  small {
    font-family: "Space Grotesk", sans-serif;
    font-weight: 700;
    font-size: 0.42em;
    margin-left: 5px;
    letter-spacing: 0.2em;
    color: ${(p) => (p.$urgent ? C.vermillionDeep : C.creamMute)};
    text-shadow: -1px 0 0 ${C.sumi}, 1px 0 0 ${C.sumi},
      0 -1px 0 ${C.sumi}, 0 1px 0 ${C.sumi};
  }

  @media (max-width: 700px) {
    font-size: clamp(1.05rem, 3.4cqw, 1.6rem);
  }
`;

// ============================================
// COMPONENT
// ============================================

const PowerUpSelection = ({
  roomId,
  playerId,
  onSelectionComplete,
  onSelectionStateChange,
}) => {
  const { socket } = useContext(SocketContext);
  const [selectedPowerUp, setSelectedPowerUp] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);
  const [availablePowerUps, setAvailablePowerUps] = useState([]);

  const powerUpInfo = useMemo(
    () => ({
      speed: {
        name: "Happy Feet",
        description: "Speed & dash",
        icon: happyFeetIcon,
        active: false,
      },
      power: {
        name: "Power Water",
        description: "+20% knockback",
        icon: powerWaterIcon,
        active: false,
      },
      snowball: {
        name: "Snowball",
        description: "Max 3 throws",
        icon: snowballImage,
        active: true,
      },
      pumo_army: {
        name: "Pumo Army",
        description: "Summon clones",
        icon: pumoArmyIcon,
        active: true,
      },
      thick_blubber: {
        name: "Thick Blubber",
        description: "Block 1 hit",
        icon: thickBlubberIcon,
        active: false,
      },
    }),
    []
  );

  const isUrgent = timeLeft <= 5;

  const countdownIntervalRef = useRef(null);

  const clearCountdownInterval = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const startCountdownTimer = useCallback(() => {
    clearCountdownInterval();
    countdownIntervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearCountdownInterval]);

  useEffect(() => {
    const handlePowerUpSelectionStart = (data) => {
      // If the countdown is already running (duplicate event from
      // request_power_up_selection_state), just update power-ups without
      // restarting the timer — keeps the client in sync with the server.
      if (countdownIntervalRef.current) {
        setAvailablePowerUps(data.availablePowerUps || []);
        return;
      }
      setIsVisible(true);
      setSelectedPowerUp(null);
      setTimeLeft(15);
      setAvailablePowerUps(data.availablePowerUps || []);
      startCountdownTimer();
      if (onSelectionStateChange) {
        onSelectionStateChange(true);
      }
    };

    const handlePowerUpSelectionComplete = () => {
      setIsVisible(false);
      setTimeLeft(15);
      setAvailablePowerUps([]);
      clearCountdownInterval();
      if (onSelectionStateChange) {
        onSelectionStateChange(false);
      }
      if (onSelectionComplete) {
        onSelectionComplete();
      }
    };

    const handleGameReset = () => {
      setIsVisible(false);
      setSelectedPowerUp(null);
      setTimeLeft(15);
      setAvailablePowerUps([]);
      clearCountdownInterval();
      if (onSelectionStateChange) {
        onSelectionStateChange(false);
      }
    };

    socket.on("power_up_selection_start", handlePowerUpSelectionStart);
    socket.on("power_up_selection_complete", handlePowerUpSelectionComplete);
    socket.on("game_reset", handleGameReset);

    return () => {
      socket.off("power_up_selection_start", handlePowerUpSelectionStart);
      socket.off("power_up_selection_complete", handlePowerUpSelectionComplete);
      socket.off("game_reset", handleGameReset);
      clearCountdownInterval();
    };
  }, [
    startCountdownTimer,
    clearCountdownInterval,
    onSelectionComplete,
    onSelectionStateChange,
    playerId,
    roomId,
    socket,
  ]);

  useEffect(() => {
    const requestPowerUpState = () => {
      socket.emit("request_power_up_selection_state", {
        roomId,
        playerId,
      });
    };

    requestPowerUpState();
    const stateRequestTimeout = setTimeout(requestPowerUpState, 500);

    return () => {
      clearTimeout(stateRequestTimeout);
    };
  }, [socket, playerId, roomId]);

  const handlePowerUpSelect = useCallback(
    (powerUpType) => {
      if (selectedPowerUp) return;
      playPowerUpSelectionPressSound();
      setSelectedPowerUp(powerUpType);
      socket.emit("power_up_selected", {
        roomId,
        playerId,
        powerUpType,
      });
    },
    [selectedPowerUp, socket, roomId, playerId]
  );

  if (!isVisible) return null;

  const hudEl = document.getElementById("game-hud");
  if (!hudEl) return null;

  return createPortal(
    <PowerUpSelectionOverlay>
      <PowerUpSelectionStage>
        <CardsContainer>
          {availablePowerUps.map((type, index) => {
            const info = powerUpInfo[type];
            if (!info) return null;
            const isSelected = selectedPowerUp === type;
            const isLocked = selectedPowerUp && !isSelected;

            return (
              <PowerCard
                key={type}
                $type={type}
                $selected={isSelected}
                $index={index}
                onClick={() => handlePowerUpSelect(type)}
                onMouseEnter={playPowerUpSelectionHoverSound}
                disabled={isLocked}
                type="button"
              >
                <CardHeader>
                  <img src={info.icon} alt={info.name} />
                </CardHeader>
                <CardBody>
                  <PowerName>{info.name}</PowerName>
                  <PowerDesc>{info.description}</PowerDesc>
                  <UsageChip $active={info.active}>
                    {info.active ? "F To Use" : "Passive"}
                  </UsageChip>
                </CardBody>
              </PowerCard>
            );
          })}
        </CardsContainer>

        <TimerStack>
          <TimerLabel>Lock In</TimerLabel>
          <TimerNumber $urgent={isUrgent}>
            {timeLeft > 0 ? timeLeft : 0}
            <small>S</small>
          </TimerNumber>
        </TimerStack>
      </PowerUpSelectionStage>
    </PowerUpSelectionOverlay>,
    hudEl
  );
};

PowerUpSelection.propTypes = {
  roomId: PropTypes.string.isRequired,
  playerId: PropTypes.string.isRequired,
  onSelectionComplete: PropTypes.func,
  onSelectionStateChange: PropTypes.func,
};

export default PowerUpSelection;
