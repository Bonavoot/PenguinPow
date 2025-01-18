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

// Refactored Player component
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

import pumo2 from "../assets/pumo2.png";
import pumoWaddle2 from "../assets/pumo-waddle2.gif";
import crouching2 from "../assets/crouching2.png";
import grabbing2 from "../assets/grabbing2.png";
import ready2 from "../assets/ready2.png";
import attack2 from "../assets/attack2.png";
import dodging2 from "../assets/dodging2.gif";
import throwing2 from "../assets/throwing2.png";

import gameMusic from "../sounds/game-music.mp3";
import grabSound from "../sounds/grab-sound.mp3";
import attackSound from "../sounds/attack-sound.mp3";
import hitSound from "../sounds/hit-sound.mp3";
import dodgeSound from "../sounds/dodge-sound.mp3";

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
];
const audioSources = [gameMusic, grabSound, attackSound, hitSound, dodgeSound];

preloadAssets(Object.values(fighterImages), "image");
preloadAssets(additionalImages, "image");
preloadAssets(audioSources, "audio");

const Player = ({ index, fighter }) => {
  // Determine the image source for the fighter
  // const penguin = useMemo(() => fighterImages[fighter] || pumo, [fighter]);

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
    <div className="player-lobby">
      <h1 className={`player-side player${index}`}>PLAYER {index + 1}</h1>
      <div>
        <Fighter
          index={index}
          fighterImgSrc={penguin}
          fighterName={fighter.toUpperCase()}
        />
      </div>
    </div>
  );
};

export default Player;
