// // assets.js
// // Images - Players
// import pumo from "../assets/pumo.png";
// import pumo2 from "../assets/pumo2.png";
// import pumoWaddle from "../assets/pumo-waddle.gif";
// import pumoWaddle2 from "../assets/pumo-waddle2.gif";
// import crouching from "../assets/crouching.png";
// import crouching2 from "../assets/crouching2.png";
// import grabbing from "../assets/grabbing.png";
// import grabbing2 from "../assets/grabbing2.png";
// import ready from "../assets/ready.png";
// import ready2 from "../assets/ready2.png";
// import attack from "../assets/attack.png";
// import attack2 from "../assets/attack2.png";
// import dodging from "../assets/dodging.gif";
// import dodging2 from "../assets/dodging2.gif";
// import throwing from "../assets/throwing-nonmirror.png";
// import throwing2 from "../assets/throwing2.png";
// import hit from "../assets/hit.png";
// import hit2 from "../assets/hit2.png";
// import salt from "../assets/salt2.png";
// import salt2 from "../assets/salt.png";

// // Images - Gyoji
// import gyoji from "../assets/gyoji.png";
// import gyojiReady from "../assets/gyoji-ready.png";
// import gyojiPlayer1wins from "../assets/gyoji-player1-wins.png";
// import gyojiPlayer2wins from "../assets/gyoji-player2-wins.png";

// // Sounds
// import gameMusic from "../sounds/game-music.mp3";
// import grabSound from "../sounds/grab-sound.mp3";
// import attackSound from "../sounds/attack-sound.mp3";
// import hitSound from "../sounds/hit-sound.mp3";
// import dodgeSound from "../sounds/dodge-sound.mp3";
// import throwSound from "../sounds/throw-sound.mp3";
// import winnerSound from "../sounds/winner-sound.mp3";
// import hakkiyoiSound from "../sounds/hakkiyoi-sound.mp3";
// import bellSound from "../sounds/bell-sound.mp3";
// import saltSound from "../sounds/salt-sound.mp3";

// // Preload utility
// const preloadAssets = (sources, type = "image") => {
//   sources.forEach((src) => {
//     if (type === "image") {
//       const img = new Image();
//       img.src = src;
//     } else if (type === "audio") {
//       const audio = new Audio();
//       audio.src = src;
//     }
//   });
// };

// // Consolidated asset lists
// const fighterImages = {
//   dinkey: pumo,
//   daiba: pumo2,
// };

// const additionalImages = [
//   pumoWaddle,
//   pumoWaddle2,
//   crouching,
//   crouching2,
//   grabbing,
//   grabbing2,
//   ready,
//   ready2,
//   attack,
//   attack2,
//   dodging,
//   dodging2,
//   throwing,
//   throwing2,
//   hit,
//   hit2,
//   gyoji,
//   gyojiReady,
//   gyojiPlayer1wins,
//   gyojiPlayer2wins,
//   salt,
//   salt2,
// ];

// const audioSources = [
//   gameMusic,
//   grabSound,
//   attackSound,
//   hitSound,
//   dodgeSound,
//   throwSound,
//   winnerSound,
//   hakkiyoiSound,
//   bellSound,
//   saltSound,
// ];

// // Preload all assets
// preloadAssets(Object.values(fighterImages), "image");
// preloadAssets(additionalImages, "image");
// preloadAssets(audioSources, "audio");

// // Export all assets
// export {
//   // Images
//   pumo,
//   pumo2,
//   pumoWaddle,
//   pumoWaddle2,
//   crouching,
//   crouching2,
//   grabbing,
//   grabbing2,
//   ready,
//   ready2,
//   attack,
//   attack2,
//   dodging,
//   dodging2,
//   throwing,
//   throwing2,
//   hit,
//   hit2,
//   salt,
//   salt2,
//   gyoji,
//   gyojiReady,
//   gyojiPlayer1wins,
//   gyojiPlayer2wins,

//   // Sounds
//   gameMusic,
//   grabSound,
//   attackSound,
//   hitSound,
//   dodgeSound,
//   throwSound,
//   winnerSound,
//   hakkiyoiSound,
//   bellSound,
//   saltSound,
// };
