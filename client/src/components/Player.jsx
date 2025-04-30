import Fighter from "./Fighter";
import { useMemo } from "react";
import pumo from "../assets/pumo.png";
import pumoWaddle from "../assets/pumo-waddle-old.gif";
import crouching from "../assets/crouching.png";
import grabbing from "../assets/grabbing.png";
import ready from "../assets/ready.png";
import attack from "../assets/attack.png";
import dodging from "../assets/dodging.gif";
import throwing from "../assets/throwing-nonmirror.png";
import hit from "../assets/hit.png";
import hit2 from "../assets/hit2.png";
import pumo2 from "../assets/pumo2.png";
import pumoWaddle2 from "../assets/pumo-waddle2.gif";
import crouching2 from "../assets/crouching2.png";
import grabbing2 from "../assets/grabbing2.png";
import ready2 from "../assets/ready2.png";
import attack2 from "../assets/attack2.png";
import dodging2 from "../assets/dodging2.png";
import throwing2 from "../assets/throwing2.png";
import salt from "../assets/salt.png";
import salt2 from "../assets/salt2.png";
import bow from "../assets/bow.png";
import bow2 from "../assets/bow2.png";
import slapAttack1Blue from "../assets/slapAttack1blue.png";
import slapAttack2Blue from "../assets/slapAttack2blue.png";
import slapAttack1Red from "../assets/slapAttack1blue.png";
import slapAttack2Red from "../assets/slapAttack2blue.png";

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
];
const audioSources = [gameMusic, grabSound, attackSound, hitSound, dodgeSound];

preloadAssets(Object.values(fighterImages), "image");
preloadAssets(additionalImages, "image");
preloadAssets(audioSources, "audio");

const Player = ({ index, fighter }) => {
  // Determine the image source for the fighter

  const penguin = useMemo(() => {
    if (index === 0) {
      // Player 1 uses the first set of images
      return fighter === "dinkey" ? pumo : pumo2;
    } else {
      // Player 2 uses the second set of images
      return fighter === "dinkey" ? pumo2 : pumo;
    }
  }, [index, fighter]);

  return (
    <div className={`player${index}-lobby`}>
      <Fighter
        index={index}
        fighterImgSrc={penguin}
        fighterName={fighter.toUpperCase()}
      />
    </div>
  );
};

export default Player;
