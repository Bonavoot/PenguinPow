import PropTypes from "prop-types";
import Fighter from "./Fighter";
import pumo from "../assets/pumo.png";
import pumo2 from "../assets/pumo2.png";
import attack from "../assets/attack.png";
import attack2 from "../assets/attack2.png";
import dodging from "../assets/dodging.gif";
import dodging2 from "../assets/dodging2.png";
import crouching from "../assets/crouching.png";
import crouching2 from "../assets/blocking.gif";
import ready from "../assets/ready.png";
import ready2 from "../assets/ready2.png";
import hit from "../assets/hit-clean.png";
import hit2 from "../assets/hit2.png";
import throwing from "../assets/throwing.png";
import throwing2 from "../assets/throwing2.png";
import grabbing from "../assets/grabbing.png";
import grabbing2 from "../assets/grabbing2.png";
import beingGrabbed from "../assets/is-being-grabbed.gif";
import beingGrabbed2 from "../assets/is-being-grabbed2.gif";
import pumoWaddle from "../assets/pumo-waddle.gif";
import pumoWaddle2 from "../assets/pumo-waddle2.png";
import salt from "../assets/salt.png";
import salt2 from "../assets/salt2.png";
import slapAttack1Blue from "../assets/slapAttack1blue.png";
import slapAttack2Blue from "../assets/slapAttack2blue.png";
import slapAttack1Red from "../assets/slapAttack1Red.png";
import slapAttack2Red from "../assets/slapAttack2Red.png";
import bow from "../assets/bow.png";
import bow2 from "../assets/bow2.png";
import throwTech from "../assets/throw-tech.png";
import throwTech2 from "../assets/throw-tech2.png";
import recovering from "../assets/recovering.png";
import recovering2 from "../assets/recovering2.png";
import throwSound from "../sounds/throw-sound.mp3";
import winnerSound from "../sounds/winner-sound.wav";
import hakkiyoiSound from "../sounds/hakkiyoi-sound.mp3";
import bellSound from "../sounds/bell-sound.mp3";
import eeshiMusic from "../sounds/eeshi.mp3";
import saltBasket from "../assets/salt-basket.png";
import saltBasketEmpty from "../assets/salt-basket-empty.png";
import slapParrySound from "../sounds/slap-parry-sound.mp3";
import saltSound from "../sounds/salt-sound.mp3";

import gyoji from "../assets/gyoji.png";
import gyojiReady from "../assets/gyoji-ready.png";
import gyojiPlayer1wins from "../assets/gyoji-player1-wins.png";
import gyojiPlayer2wins from "../assets/gyoji-player2-wins.png";

import gameMusic from "../sounds/game-music.mp3";
import grabSound from "../sounds/grab-sound.mp3";
import attackSound from "../sounds/attack-sound.mp3";
import hitSound from "../sounds/hit-sound.mp3";
import dodgeSound from "../sounds/dodge-sound.mp3";

// Utility to preload assets
const preloadAssets = (sources, type = "image") => {
  sources.forEach((src) => {
    if (type === "image") {
      const img = new Image();
      img.src = src;
    } else if (type === "audio") {
      const audio = new Audio();
      audio.src = src;
    }
  });
};

// Preload assets at the start of the application
const fighterImages = {
  dinkey: pumo,
  daiba: pumo2,
};
const additionalImages = [
  pumoWaddle,
  pumoWaddle2,
  crouching,
  crouching2,
  grabbing,
  grabbing2,
  ready,
  ready2,
  attack,
  attack2,
  dodging,
  dodging2,
  throwing,
  throwing2,
  hit,
  hit2,
  gyoji,
  gyojiReady,
  gyojiPlayer1wins,
  gyojiPlayer2wins,
  salt,
  salt2,
  bow,
  bow2,
  slapAttack1Blue,
  slapAttack2Blue,
  slapAttack1Red,
  slapAttack2Red,
  beingGrabbed,
  beingGrabbed2,
  throwTech,
  throwTech2,
  saltBasket,
  saltBasketEmpty,
  recovering,
  recovering2,
];
const audioSources = [
  gameMusic,
  grabSound,
  attackSound,
  hitSound,
  dodgeSound,
  throwSound,
  winnerSound,
  hakkiyoiSound,
  bellSound,
  eeshiMusic,
  slapParrySound,
  saltSound,
];

preloadAssets(Object.values(fighterImages), "image");
preloadAssets(additionalImages, "image");
preloadAssets(audioSources, "audio");

const Player = ({
  fighter,
  isDiving,
  isJumping,
  isAttacking,
  isDodging,
  isStrafing,
  isRawParrying,
  isReady,
  isHit,
  isDead,
  isSlapAttack,
  isThrowing,
  isGrabbing,
  isBeingGrabbed,
  isThrowingSalt,
  slapAnimation,
  isBowing,
  isThrowTeching,
  isBeingPulled,
  isBeingPushed,
  grabState,
  grabAttemptType,
  isRecovering,
  isRawParryStun,
}) => {
  const getFighterImage = () => {
    if (fighter === "player 1") {
      if (isBowing) return bow2;
      if (isThrowTeching) return throwTech2;
      if (isRecovering) return recovering2;
      if (isSlapAttack) {
        return slapAnimation === 1 ? slapAttack1Blue : slapAttack2Blue;
      }
      if (isJumping) return throwing2;
      if (isAttacking && !isSlapAttack) return attack2;
      if (isGrabbing) {
        if (grabState === "attempting") {
          return grabAttemptType === "throw" ? throwing2 : grabbing2;
        }
        return grabbing2;
      }
      if (isDodging) return dodging2;
      if (isRawParrying) return crouching2;
      if (isRawParryStun) return hit2;
      if (isReady) return ready2;
      if (isStrafing && !isThrowing) return pumoWaddle2;
      if (isHit) return hit2;
      if (isDead) return pumo2;
      if (isThrowing) return throwing2;
      if (isThrowingSalt) return salt2;
      if (isBeingGrabbed || isBeingPulled || isBeingPushed)
        return beingGrabbed2;
      return pumo2;
    } else {
      if (isBowing) return bow;
      if (isThrowTeching) return throwTech;
      if (isRecovering) return recovering;
      if (isSlapAttack) {
        return slapAnimation === 1 ? slapAttack1Red : slapAttack2Red;
      }
      if (isJumping) return throwing;
      if (isAttacking && !isSlapAttack) return attack;
      if (isGrabbing) {
        if (grabState === "attempting") {
          return grabAttemptType === "throw" ? throwing : grabbing;
        }
        return grabbing;
      }
      if (isDodging) return dodging;
      if (isRawParrying) return crouching;
      if (isRawParryStun) return hit;
      if (isReady) return ready;
      if (isStrafing && !isThrowing) return pumoWaddle;
      if (isHit) return hit;
      if (isDead) return pumo;
      if (isThrowing) return throwing;
      if (isThrowingSalt) return salt;
      if (isBeingGrabbed || isBeingPulled || isBeingPushed) return beingGrabbed;
      return pumo;
    }
  };

  return (
    <Fighter
      index={fighter === "player 1" ? 0 : 1}
      fighterImgSrc={getFighterImage()}
    />
  );
};

Player.propTypes = {
  fighter: PropTypes.string.isRequired,
  isDiving: PropTypes.bool,
  isJumping: PropTypes.bool,
  isAttacking: PropTypes.bool,
  isDodging: PropTypes.bool,
  isStrafing: PropTypes.bool,
  isRawParrying: PropTypes.bool,
  isReady: PropTypes.bool,
  isHit: PropTypes.bool,
  isDead: PropTypes.bool,
  isSlapAttack: PropTypes.bool,
  isThrowing: PropTypes.bool,
  isGrabbing: PropTypes.bool,
  isBeingGrabbed: PropTypes.bool,
  isThrowingSalt: PropTypes.bool,
  slapAnimation: PropTypes.number,
  isBowing: PropTypes.bool,
  isThrowTeching: PropTypes.bool,
  isBeingPulled: PropTypes.bool,
  isBeingPushed: PropTypes.bool,
  grabState: PropTypes.string,
  grabAttemptType: PropTypes.string,
  isRecovering: PropTypes.bool,
  isRawParryStun: PropTypes.bool,
};

Player.defaultProps = {
  isDiving: false,
  isJumping: false,
  isAttacking: false,
  isDodging: false,
  isStrafing: false,
  isRawParrying: false,
  isReady: false,
  isHit: false,
  isDead: false,
  isSlapAttack: false,
  isThrowing: false,
  isGrabbing: false,
  isBeingGrabbed: false,
  isThrowingSalt: false,
  slapAnimation: 0,
  isBowing: false,
  isThrowTeching: false,
  isBeingPulled: false,
  isBeingPushed: false,
  grabState: "",
  grabAttemptType: "",
  isRecovering: false,
  isRawParryStun: false,
};

export default Player;
