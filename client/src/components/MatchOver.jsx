import Rematch from "./Rematch";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";
import { C } from "./menuTheme";

/*
 * MatchOver — printed result card pinned into the broadcast feed.
 *
 * Lives in the same printed-banzuke language as the lobby +
 * customize + rooms + prematch. Lands like the closing card of
 * the broadcast that opened the bout, not as a different prop.
 *
 *   - Solid OPAQUE cream washi paper. Same fill as PreMatch's
 *     BroadcastBar / WrestlerPanel / LowerThird. No backdrop-
 *     filter, no semi-transparent dark glass, no multi-stop
 *     dark gradient.
 *   - Color tells you the result. WINNER gets gold leaf chrome
 *     (top + bottom rules + kimarite + divider) on cream — the
 *     same gold the in-game RankPlaque uses for premium accents,
 *     reading as "stamped with the gold seal of victory". LOSER
 *     gets a sumi-ink chrome FRAME (top + bottom rules + divider
 *     + diamond terminators in somber sumi), but the verdict
 *     text itself ("DEFEAT" + "Make-koshi") reads in vermillion
 *     — a red defeat stamp pressed onto a black-bordered notice.
 *     Both surfaces are identical cream washi; only the ink
 *     differs.
 *
 *     A previous pass used vermillion for winner accents (because
 *     vermillion is the prematch's on-air tally / hanko stamp
 *     color), but red on a VICTORY screen reads as loss/danger
 *     to a western audience even when the underlying logic is
 *     "this is the print color of the broadcast world". Gold is
 *     unambiguous and already canonical for premium accents in
 *     menuTheme.js. The flip is now: gold = victory, red = defeat
 *     verdict, sumi = somber loser frame.
 *   - The card kept it simple — confident Bungee headline plus
 *     a romaji kimarite line ("KACHI-KOSHI" / "MAKE-KOSHI" — the
 *     real sumo terms for winning / losing tournament records).
 *     No kanji watermarks, no glow halos, no animated text-
 *     shadow loops, no decorative corner seals (an earlier pass
 *     had a vermillion hanko-style seal in the top-right corner,
 *     but without kanji inside it just read as a mystery red
 *     square).
 *   - One stamp-impression entrance: card lands with a quick
 *     scale-from-oversized + small rotation settle, residual
 *     -1deg so it reads as paper pinned slightly off-true rather
 *     than a floating UI element. NO rotating conic rays, NO
 *     drifting motes, NO animated film grain, NO accent lines,
 *     NO halo glow, NO warm-shifted brown vignette (a previous
 *     pass had one and it dominated the screen, fighting the
 *     cream paper for the warm-color budget). Just a single
 *     subtle neutral-dark scrim across the arena to ground the
 *     card without dimming the world to an oppressive degree.
 *
 *   The Rematch buttons sit inside the card's lower half, but
 *   they're handled in Rematch.jsx so this file doesn't need to
 *   know about their internals. This file just lays the table.
 */

// ============================================
// ANIMATIONS
// ============================================

const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

/*
 * Card landing motion. Adapted from menuTheme.js's stampImpression
 * but without the translateX(-50%) bake-in (we center via flex
 * here, not via absolute positioning). Quick scale-from-oversized
 * with a small overshoot settle and a residual -1deg rotation so
 * the card reads as a physical print pinned slightly off-true,
 * not a floating UI element.
 */
const cardStamp = keyframes`
  0% {
    opacity: 0;
    transform: rotate(-2deg) scale(1.45);
  }
  58% {
    opacity: 1;
    transform: rotate(0.5deg) scale(0.96);
  }
  78% {
    transform: rotate(-1.4deg) scale(1.03);
  }
  100% {
    opacity: 1;
    transform: rotate(-1deg) scale(1);
  }
`;

// ============================================
// ROOT OVERLAY
// ============================================

const MatchOverOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1400;
  pointer-events: none;
`;

/*
 * Subtle neutral-dark scrim across the arena. Replaces the
 * earlier warm-brown radial vignette, which was dimming the
 * arena into a heavy chocolate haze and fighting the cream
 * paper for the warm-color budget. This is a flat near-black
 * scrim at low alpha so the live arena keeps reading clearly
 * but the cream card has the visual edge it needs to anchor
 * the eye.
 *
 * Cool/neutral black on purpose (not warm-shifted) — the
 * scrim is meant to be CHROME, not part of the printed-paper
 * color story. The card itself still carries all the warm
 * shadows; the scrim just steps the arena back a notch.
 */
const Vignette = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  background: rgba(0, 0, 0, 0.32);
  animation: ${fadeIn} 0.45s ease-out 0.05s forwards;
`;

const MatchOverStage = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(40px, 6vh, 72px) clamp(24px, 4vw, 40px);
  pointer-events: none;
`;

// ============================================
// RESULT CARD
// ============================================

/*
 * The card itself. Cream washi paper, gold (winner) or sumi
 * (loser) top + bottom rules. 1px warm-brown sumi hairline on
 * left + right edges to close the box. Two-layer warm drop
 * shadow grounds the card on the live arena.
 *
 * No border-radius. The prematch broadcast cards are also flat-
 * cornered — rounded corners read as software UI; sharp corners
 * read as paper.
 *
 * `will-change` is set to keep the entrance keyframe on the
 * compositor (transform + opacity only, no clip-path).
 */
const ResultCard = styled.div`
  position: relative;
  width: clamp(320px, 36cqw, 480px);
  max-width: min(92vw, 480px);
  background: ${C.cream};
  border: 1px solid rgba(60, 40, 20, 0.28);
  border-top: 4px solid ${(p) => (p.$isWinner ? C.gold : C.sumi)};
  border-bottom: 4px solid
    ${(p) => (p.$isWinner ? C.gold : C.sumi)};
  box-shadow:
    0 8px 22px rgba(50, 30, 10, 0.32),
    0 22px 48px rgba(50, 30, 10, 0.42);
  padding: clamp(28px, 3.6cqh, 44px) clamp(28px, 3.4cqw, 44px)
    clamp(22px, 2.8cqh, 32px);
  pointer-events: auto;
  z-index: 1;
  will-change: transform, opacity;
  animation: ${cardStamp} 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)
    0.15s backwards;

  /* Paper grain — same formula as PreMatchScreen's BroadcastBar
     + LowerThird so the surfaces read as cuts of the same washi
     sheet. */
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image:
      repeating-linear-gradient(
        0deg,
        rgba(60, 40, 20, 0.04) 0,
        transparent 1px,
        transparent 3px
      ),
      repeating-linear-gradient(
        90deg,
        rgba(60, 40, 20, 0.025) 0,
        transparent 1px,
        transparent 4px
      );
    pointer-events: none;
    z-index: 1;
  }

  @media (max-width: 900px) {
    width: clamp(290px, 44cqw, 400px);
    padding: clamp(22px, 3cqh, 32px) clamp(20px, 2.6cqw, 30px)
      clamp(18px, 2.4cqh, 26px);
  }
`;

// ============================================
// RESULT TEXT
// ============================================

const ResultSection = styled.div`
  position: relative;
  z-index: 2;
  text-align: center;
  margin-bottom: clamp(18px, 2.4cqh, 26px);
  padding-bottom: clamp(16px, 2cqh, 22px);
`;

/*
 * "VICTORY" / "DEFEAT" — the primary headline. Bungee on cream,
 * sumi-ink fill (winner) or vermillion (loser). No glow halos,
 * no animated text-shadow loops. Confidence comes from
 * typography + scale, not from layered paint-order tricks.
 *
 * The previous version stacked four shadow layers (offset stroke
 * × 2 + glow + drop) to fight a dark muddy background. On cream
 * paper a single subtle warm drop is enough — and matches the
 * other Bungee headlines in the menu world.
 *
 * Color philosophy: gold-rule frame + sumi-ink VICTORY headline
 * = "stamped with the gold seal of victory". Sumi-rule frame +
 * vermillion DEFEAT headline = "red defeat verdict pressed onto
 * a black-bordered loss notice". Western fight-game canon for
 * red-as-defeat lands without breaking the printed-broadcast
 * world we built around it.
 */
const Headline = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(1.6rem, 4cqw, 2.6rem);
  line-height: 0.92;
  color: ${(p) => (p.$isWinner ? C.inkText : C.vermillion)};
  text-transform: uppercase;
  letter-spacing: 0.06em;
  text-shadow: 0 2px 0 rgba(255, 255, 255, 0.6),
    0 3px 0 rgba(60, 40, 20, 0.05);

  @media (max-width: 900px) {
    font-size: clamp(1.3rem, 5cqw, 2rem);
  }
`;

/*
 * "KACHI-KOSHI" / "MAKE-KOSHI" subtitle. Romaji of real sumo
 * tournament terms (winning record / losing record). Gold-deep
 * on winner pairs with the gold rules above it; vermillion-deep
 * on loser pairs with the red DEFEAT headline so the verdict
 * reads as a single typographic block.
 */
const Kimarite = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.6rem, 1.05cqw, 0.82rem);
  color: ${(p) => (p.$isWinner ? C.goldDeep : C.vermillionDeep)};
  letter-spacing: 0.32em;
  text-transform: uppercase;
  margin-top: clamp(8px, 1cqh, 12px);
`;

/*
 * Gold (winner) / sumi (loser) divider between the result block
 * and the rematch section. Single hairline + tiny diamond
 * terminators on each end, mirroring the printed-program
 * "section break" treatment used across the menu world.
 */
const Divider = styled.div`
  position: relative;
  width: min(100%, 280px);
  height: 1px;
  margin: 0 auto;
  background: ${(p) =>
    p.$isWinner ? C.gold : "rgba(60, 40, 20, 0.32)"};
  opacity: ${(p) => (p.$isWinner ? 0.85 : 0.6)};

  &::before,
  &::after {
    content: "";
    position: absolute;
    top: 50%;
    width: 4px;
    height: 4px;
    background: ${(p) =>
      p.$isWinner ? C.gold : "rgba(60, 40, 20, 0.55)"};
    transform: translateY(-50%) rotate(45deg);
  }
  &::before {
    left: -4px;
  }
  &::after {
    right: -4px;
  }
`;

const RematchSection = styled.div`
  position: relative;
  z-index: 2;
  width: 100%;
  padding-top: clamp(16px, 2cqh, 22px);
`;

// ============================================
// COMPONENT
// ============================================

const MatchOver = ({ winner, roomName, localId, isCPUMatch }) => {
  const isWinner = localId === winner.id;

  return (
    <MatchOverOverlay>
      <Vignette />
      <MatchOverStage>
        <ResultCard $isWinner={isWinner}>
          <ResultSection>
            <Headline $isWinner={isWinner}>
              {isWinner ? "VICTORY" : "DEFEAT"}
            </Headline>
            <Kimarite $isWinner={isWinner}>
              {isWinner ? "Kachi-koshi" : "Make-koshi"}
            </Kimarite>
          </ResultSection>
          <Divider $isWinner={isWinner} />
          <RematchSection>
            <Rematch roomName={roomName} isCPUMatch={isCPUMatch} />
          </RematchSection>
        </ResultCard>
      </MatchOverStage>
    </MatchOverOverlay>
  );
};

MatchOver.propTypes = {
  winner: PropTypes.shape({
    id: PropTypes.string.isRequired,
  }).isRequired,
  roomName: PropTypes.string.isRequired,
  localId: PropTypes.string.isRequired,
  isCPUMatch: PropTypes.bool,
};

MatchOver.defaultProps = {
  isCPUMatch: false,
};

export default MatchOver;
