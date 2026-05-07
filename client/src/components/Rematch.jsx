import { useContext, useEffect, useState } from "react";
import { SocketContext } from "../SocketContext";
import PropTypes from "prop-types";
import styled, { keyframes, css } from "styled-components";
import {
  playButtonHoverSound,
  playButtonPressSound,
  playButtonPressSound2,
} from "../utils/soundUtils";
import { C } from "./menuTheme";

/*
 * Rematch — printed-program CTAs for the post-match result card.
 *
 * THE REWRITE (vs. the previous wooden-plaque pass):
 *   The previous Rematch buttons were wood-plaque gradients
 *   (#4a3525 → #3d2817 → #2a1d14 with a #8b7355 border, gold
 *   text, repeating-linear-gradient "wood grain", stacked drop +
 *   inset shadows). They lived inside MatchOver's wooden nobori
 *   so the language was at least internally consistent — but
 *   that whole language was the AI-tell brown world we're
 *   replacing across the in-game UI.
 *
 *   This pass flips the buttons onto the cream-washi result card
 *   from the new MatchOver. They have to do two things at once:
 *
 *     1. Read as confidently CLICKABLE (this is the only
 *        interactive surface on the post-match screen — if the
 *        button doesn't pop the player gets stuck staring at a
 *        printed page wondering what to do).
 *     2. Stay native to the printed-program / banzuke world the
 *        result card establishes (no glow halos, no shimmer, no
 *        infinite ambient pulse loops).
 *
 *   The split:
 *     - REMATCH (primary GO) → success-green fill, cream text.
 *       menuTheme.js canon for "GO / Join / Ready-to-fight" CTAs
 *       across the whole game. Different hue from the card's
 *       vermillion chrome, so it can't be confused with the
 *       result reporting; same hue family as the "ready" tally
 *       state below it, so the visual rhyme between "I'm in" and
 *       "we're both in" is unbroken.
 *     - CANCEL (after pressing rematch) → sumi-soft fill, cream
 *       text. Visually quieter than REMATCH so the moment the
 *       player commits, the affordance recedes — the eye moves
 *       to the FIGHTERS READY tally below, which is now the
 *       active surface.
 *     - FIGHTERS READY tally → cream washi slip pinned inside
 *       the card. Vermillion top + bottom rules when waiting
 *       (matches the result card's chrome); rules and number
 *       flip to success-green when the count turns 1+, and turn
 *       fully success when both are ready. Single transition,
 *       no infinite ambient pulse.
 *     - ← LEAVE DOHYO → minimalist text link in the result
 *       card's muted-ink hue. The "Leave Dohyo" copy stays —
 *       it's already thematic.
 */

// ============================================
// MOTION TOKENS
// ============================================

/*
 * Single pulse on the transition into "both ready". Replaces the
 * previous infinite readyGlow loop — once the count turns 2/2,
 * the gyoji flow takes over the screen anyway, so a one-shot
 * confirmation is enough. Keeps the post-match UI from idling
 * with an animated halo forever.
 */
const readyConfirm = keyframes`
  0% {
    box-shadow:
      0 4px 14px rgba(50, 30, 10, 0.22),
      inset 0 1px 0 rgba(255, 255, 255, 0.5);
  }
  50% {
    box-shadow:
      0 4px 14px rgba(50, 30, 10, 0.22),
      0 0 0 4px ${C.successGlow},
      inset 0 1px 0 rgba(255, 255, 255, 0.5);
  }
  100% {
    box-shadow:
      0 4px 14px rgba(50, 30, 10, 0.22),
      inset 0 1px 0 rgba(255, 255, 255, 0.5);
  }
`;

// ============================================
// LAYOUT
// ============================================

const RematchWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(10px, 1.4cqh, 16px);
  width: 100%;
`;

const ButtonContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: clamp(10px, 1.3cqh, 14px);
  width: min(100%, 280px);
`;

// ============================================
// PRIMARY CTA — REMATCH
// ============================================

/*
 * Vermillion-deep border on success-green fill. Cream Bungee text.
 * The button reads as a stamped "GO" approval — the dot of a tiny
 * green LIVE light enlarged into a clickable CTA. No wood grain,
 * no diagonal shimmer sweep, no infinite glow.
 *
 * Hover lifts and brightens the fill (success → successBright).
 * Active settles. Standard physical button feedback only.
 *
 * Sharp corners (no border-radius) match the printed-program
 * world the result card sits in. Rounded buttons inside a flat-
 * cornered paper card would re-introduce the software-UI read.
 */
const buttonBase = css`
  font-family: "Bungee", cursive;
  font-size: clamp(0.62rem, 1.25cqw, 0.84rem);
  width: 100%;
  padding: clamp(11px, 1.5cqh, 16px) clamp(16px, 2.4cqw, 28px);
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  position: relative;
  transition: background 0.15s ease, transform 0.12s ease,
    box-shadow 0.15s ease, color 0.15s ease;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.35);

  &:active {
    transform: translateY(1px);
  }

  @media (max-width: 900px) {
    font-size: clamp(0.52rem, 1.7cqw, 0.7rem);
    padding: clamp(9px, 1.2cqh, 12px) clamp(12px, 2cqw, 20px);
    letter-spacing: 0.14em;
  }
`;

const RematchButton = styled.button`
  ${buttonBase}
  /* Rest tone shifted down one step on the green ramp — the previous
     pass used C.success (#4ade80, Tailwind green-400) which read as
     a bright lime against the cream washi card. Pulling it down to
     successDeep (#16a34a, green-600) grounds the button so it
     doesn't blow out the page, and shifts the hover lift up to
     success (the previous rest tone) so hovering gives a properly
     dramatic brightening instead of a barely-there pop. */
  background: ${C.successDeep};
  color: ${C.cream};
  border: 2px solid ${C.successDeep};
  box-shadow:
    0 4px 14px rgba(22, 163, 74, 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.22);

  &:hover {
    background: ${C.success};
    box-shadow:
      0 6px 18px rgba(74, 222, 128, 0.42),
      inset 0 1px 0 rgba(255, 255, 255, 0.4);
    transform: translateY(-1px);
    color: ${C.inkTextStrong};
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.4);
  }
`;

/*
 * CANCEL — secondary state after the player presses REMATCH.
 * Sumi-soft fill, cream text, sumi border. Quieter than the
 * primary so the FIGHTERS READY tally below it becomes the
 * focus once the player has committed.
 */
const CancelButton = styled.button`
  ${buttonBase}
  background: ${C.sumiSoft};
  color: ${C.creamMute};
  border: 2px solid ${C.sumi};
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);

  &:hover {
    background: ${C.sumi};
    color: ${C.cream};
    box-shadow:
      0 5px 14px rgba(0, 0, 0, 0.38),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
    transform: translateY(-1px);
  }
`;

// ============================================
// READY TALLY
// ============================================

/*
 * Printed-program tally slip. Cream washi fill (slightly inset
 * with a faint warm tint, like PreMatchScreen's CenterPillar),
 * neutral warm-brown hairline border when waiting, success-green
 * top + bottom rules when 1/2 or 2/2. The chrome shift IS the
 * state change — no separate "active" badge, no glow halo.
 *
 * Stays color-neutral while waiting on purpose. The result card
 * above this tally already does color signaling (gold for
 * winner, sumi for loser) and a third color band on the tally
 * would compete. Only when the actual GO state lands (somebody
 * is ready) does the tally light up green.
 *
 * Diamond terminators on each end match the Divider terminators
 * on the result card so the tally reads as part of the same
 * printed-program family as everything else around it.
 */
const ReadyCount = styled.div`
  position: relative;
  font-family: "Bungee", cursive;
  font-size: clamp(0.85rem, 1.7cqw, 1.18rem);
  color: ${(p) => (p.$ready ? C.successDeep : C.inkText)};
  background: rgba(20, 12, 8, 0.04);
  width: 100%;
  padding: clamp(9px, 1.3cqh, 13px) clamp(20px, 2.8cqw, 30px);
  border: 1px solid rgba(60, 40, 20, 0.28);
  border-top: 2px solid
    ${(p) =>
      p.$ready ? C.success : "rgba(60, 40, 20, 0.4)"};
  border-bottom: 2px solid
    ${(p) =>
      p.$ready ? C.success : "rgba(60, 40, 20, 0.4)"};
  text-align: center;
  letter-spacing: 0.18em;
  align-self: center;
  box-shadow:
    0 4px 14px rgba(50, 30, 10, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
  transition: color 0.25s ease, border-color 0.25s ease;
  ${(p) =>
    p.$ready &&
    css`
      animation: ${readyConfirm} 0.7s ease-out 1;
    `}

  /* Diamond terminators on each end of the tally — same shape
     vocabulary as the Divider terminators on the result card. */
  &::before,
  &::after {
    content: "";
    position: absolute;
    top: 50%;
    width: 5px;
    height: 5px;
    background: ${(p) =>
      p.$ready ? C.success : "rgba(60, 40, 20, 0.55)"};
    transform: translateY(-50%) rotate(45deg);
  }
  &::before {
    left: clamp(8px, 1.2cqw, 12px);
  }
  &::after {
    right: clamp(8px, 1.2cqw, 12px);
  }

  @media (max-width: 900px) {
    font-size: clamp(0.66rem, 2.1cqw, 0.95rem);
    padding: clamp(7px, 1cqh, 10px) clamp(14px, 2.4cqw, 22px);
  }
`;

const ReadyLabel = styled.span`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 700;
  font-size: clamp(0.42rem, 0.78cqw, 0.55rem);
  color: ${C.inkTextMute};
  display: block;
  margin-bottom: clamp(3px, 0.45cqh, 5px);
  letter-spacing: 0.32em;
  text-transform: uppercase;

  @media (max-width: 900px) {
    font-size: clamp(0.36rem, 1.2cqw, 0.46rem);
    letter-spacing: 0.26em;
  }
`;

// ============================================
// EXIT LINK
// ============================================

/*
 * "← Leave Dohyo" — quiet text link below the tally. Print-
 * program convention: muted ink rest state, deeper sumi on
 * hover, with a single hairline underline that widens slightly.
 * No animated gradient sweep, no warm-color hover (the post-
 * match card has zero vermillion — keeping it that way here
 * too, even on hover).
 */
const ExitButton = styled.button`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 700;
  font-size: clamp(0.46rem, 0.85cqw, 0.6rem);
  background: transparent;
  color: ${C.inkTextMute};
  border: none;
  padding: clamp(4px, 0.6cqh, 8px) clamp(10px, 1.5cqw, 16px);
  cursor: pointer;
  transition: color 0.15s ease;
  text-transform: uppercase;
  letter-spacing: 0.28em;
  margin-top: clamp(2px, 0.4cqh, 6px);
  position: relative;

  &::after {
    content: "";
    position: absolute;
    bottom: 1px;
    left: 24%;
    right: 24%;
    height: 1px;
    background: ${C.inkTextFaint};
    transition: left 0.18s ease, right 0.18s ease,
      background 0.18s ease;
  }

  &:hover {
    color: ${C.inkTextStrong};

    &::after {
      left: 12%;
      right: 12%;
      background: ${C.inkTextSoft};
    }
  }

  &:active {
    color: ${C.inkTextSoft};
  }

  @media (max-width: 900px) {
    font-size: clamp(0.4rem, 1.1cqw, 0.52rem);
    letter-spacing: 0.22em;
  }
`;

// ============================================
// COMPONENT
// ============================================

const Rematch = ({ roomName, isCPUMatch }) => {
  const [rematch, setRematch] = useState(false);
  const [count, setCount] = useState(0);
  const { socket } = useContext(SocketContext);

  useEffect(() => {
    if (isCPUMatch) return undefined;
    const handleRematchCount = (rematchCount) => {
      setCount(rematchCount);
    };
    socket.on("rematch_count", handleRematchCount);
    return () => {
      socket.off("rematch_count", handleRematchCount);
    };
  }, [socket, isCPUMatch]);

  const handleRematch = (e) => {
    if (e.target.textContent === "REMATCH") {
      setRematch(true);
      socket.emit("rematch_count", {
        playerId: socket.id,
        acceptedRematch: true,
        roomId: roomName,
      });
    } else {
      setRematch(false);
      socket.emit("rematch_count", {
        playerId: socket.id,
        acceptedRematch: false,
        roomId: roomName,
      });
    }
  };

  const handleExit = () => {
    setCount(0);
    window.location.reload(false);
  };

  return (
    <RematchWrapper>
      <ButtonContainer>
        {rematch ? (
          <CancelButton
            onClick={(e) => {
              handleRematch(e);
              playButtonPressSound();
            }}
            onMouseEnter={playButtonHoverSound}
          >
            CANCEL
          </CancelButton>
        ) : (
          <RematchButton
            onClick={(e) => {
              handleRematch(e);
              playButtonPressSound2();
            }}
            onMouseEnter={playButtonHoverSound}
          >
            REMATCH
          </RematchButton>
        )}
        {/* CPU matches always have one human + one CPU. The "FIGHTERS
            READY 0/2" tally is meaningless there — the CPU doesn't
            press a button, it just commits — so we hide the tally
            for CPU matches and let the REMATCH button do all the
            work. The PvP tally still appears for human vs human. */}
        {!isCPUMatch && (
          <ReadyCount $ready={count > 0}>
            <ReadyLabel>Fighters Ready</ReadyLabel>
            {count} / 2
          </ReadyCount>
        )}
      </ButtonContainer>
      <ExitButton
        onClick={() => {
          handleExit();
          playButtonPressSound();
        }}
        onMouseEnter={playButtonHoverSound}
      >
        ← Leave Dohyo
      </ExitButton>
    </RematchWrapper>
  );
};

Rematch.propTypes = {
  roomName: PropTypes.string.isRequired,
  isCPUMatch: PropTypes.bool,
};

Rematch.defaultProps = {
  isCPUMatch: false,
};

export default Rematch;
