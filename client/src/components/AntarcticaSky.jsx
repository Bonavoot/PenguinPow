import { memo, useId } from "react";
import PropTypes from "prop-types";
import "./AntarcticaSky.css";

/**
 * Flat Antarctica sky. Color, sun, moon, and aurora are CSS on [data-sky].
 * The floor plate and the lake read the same attribute from an ancestor.
 * The moon sits on the celestial sheet with the sun. The water path
 * is painted on the lake, under whichever body is up.
 */
function AntarcticaSky({ phase = "day" }) {
  const id = useId().replace(/:/g, "");
  return (
    <div className="antarctica-sky" data-sky={phase}>
      <div className="sky-sheet sky-field" />
      <div className="sky-sheet sky-stars">
        <Stars id={id} />
      </div>
      <div className="sky-sheet sky-aurora">
        <Aurora id={id} />
      </div>
      <div className="sky-sheet sky-celestial">
        <div className="sky-sun" />
        <div className="sky-moon">
          <i className="moon-crater a" />
          <i className="moon-crater b" />
        </div>
      </div>
      <div className="sky-sheet sky-clouds">
        <Clouds />
      </div>
    </div>
  );
}

AntarcticaSky.propTypes = {
  phase: PropTypes.oneOf(["day", "afternoon", "night"]),
};

export default memo(AntarcticaSky);

function starUnit(n) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

function starFill(t) {
  if (t > 0.97) return "#ff8d7a";
  if (t > 0.92) return "#ffe1b0";
  if (t > 0.78) return "#cfe6ff";
  return "#ffffff";
}

function sparkle(cx, cy, r) {
  const a = r * 0.22;
  return `M${cx} ${cy - r} L${cx + a} ${cy - a} L${cx + r} ${cy} L${cx + a} ${cy + a} L${cx} ${cy + r} L${cx - a} ${cy + a} L${cx - r} ${cy} L${cx - a} ${cy - a} Z`;
}

/* Southern sky, high in the frame so the peaks leave it in the open.
   Crux is the kite; the two bright stars to its left are the Centaurus pointers.
   Gacrux (the top of the cross) is the red one. */
const CRUX = [
  { x: 268, y: 46, r: 2.8, fill: "#ffb0a4", name: "gacrux" },
  { x: 214, y: 98, r: 3.2, fill: "#ffffff", name: "mimosa" },
  { x: 330, y: 108, r: 2.4, fill: "#ffffff", name: "delta" },
  { x: 286, y: 162, r: 3.4, fill: "#e7f0ff", name: "acrux" },
];
const POINTERS = [
  { x: 128, y: 64, r: 3.1, fill: "#e7f0ff", name: "hadar" },
  { x: 86, y: 128, r: 3.7, fill: "#fff6e0", name: "rigil" },
];
const FIELD_SPARKS = [
  { x: 640, y: 38, r: 2.5, fill: "#ffffff" },
  { x: 820, y: 52, r: 2.3, fill: "#cfe6ff" },
  { x: 990, y: 30, r: 2.7, fill: "#ffffff" },
  { x: 1180, y: 58, r: 2.2, fill: "#ffe1b0" },
  { x: 1470, y: 34, r: 2.6, fill: "#ffffff" },
  { x: 720, y: 96, r: 2.1, fill: "#ff8d7a" },
];

const DUST = (() => {
  const dust = [];
  for (let i = 0; i < 380; i += 1) {
    const u = starUnit(i + 1);
    const v = starUnit(i + 400);
    const w = starUnit(i + 800);
    const tint = starUnit(i + 1200);
    dust.push({
      x: u * 1600,
      y: v * v * 430,
      r: w > 0.985 ? 1.5 : w > 0.93 ? 1.02 : 0.26 + w * 0.48,
      fill: starFill(tint),
      opacity: 0.4 + w * 0.6,
      key: `f${i}`,
    });
  }
  for (let i = 0; i < 150; i += 1) {
    const t = starUnit(i + 2000);
    const n = starUnit(i + 2600) - 0.5;
    const w = starUnit(i + 3200);
    const tint = starUnit(i + 3800);
    const y = 16 + t * 210 + n * 58;
    dust.push({
      x: 70 + t * 1460,
      y: Math.max(6, Math.min(390, y)),
      r: 0.28 + w * 0.62,
      fill: starFill(tint),
      opacity: 0.55 + w * 0.45,
      key: `b${i}`,
    });
  }
  return dust;
})();

const SPARKS = [...POINTERS, ...CRUX, ...FIELD_SPARKS];

function Stars({ id }) {
  const milky = `${id}-milky`;
  const lmc = `${id}-lmc`;
  const smc = `${id}-smc`;
  return (
    <svg className="sky-stars-svg" viewBox="0 0 1600 480" preserveAspectRatio="xMidYMin slice">
      <defs>
        <linearGradient id={milky} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#dbe7ff" stopOpacity="0" />
          <stop offset="22%" stopColor="#e8eeff" stopOpacity="0.34" />
          <stop offset="55%" stopColor="#fff3e0" stopOpacity="0.26" />
          <stop offset="100%" stopColor="#dbe7ff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={lmc} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f6f1e6" stopOpacity="0.85" />
          <stop offset="42%" stopColor="#d5e4f8" stopOpacity="0.48" />
          <stop offset="100%" stopColor="#d5e4f8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={smc} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f3f7ff" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#d5e4f8" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#d5e4f8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <line
        x1="80"
        y1="20"
        x2="1520"
        y2="230"
        stroke={`url(#${milky})`}
        strokeWidth="92"
        strokeLinecap="round"
      />
      <ellipse cx="1330" cy="168" rx="108" ry="40" fill={`url(#${lmc})`} />
      <ellipse cx="1468" cy="84" rx="36" ry="16" fill={`url(#${smc})`} />
      {DUST.map((star) => (
        <circle
          key={star.key}
          cx={star.x}
          cy={star.y}
          r={star.r}
          fill={star.fill}
          fillOpacity={star.opacity}
        />
      ))}
      <g className="sky-constellation" fill="none" stroke="#ffffff" strokeWidth="1.25" strokeLinecap="round">
        <path d="M268 46 L286 162" />
        <path d="M214 98 L330 108" />
        <path d="M128 64 L86 128" />
      </g>
      {SPARKS.map((star, i) => (
        <path
          key={star.name || `${star.x}-${star.y}`}
          className={`star-spark tw-${i % 3}`}
          style={{ animationDelay: `${(i * 0.53) % 5.2}s` }}
          fill={star.fill}
          d={sparkle(star.x, star.y, star.r)}
        />
      ))}
    </svg>
  );
}

Stars.propTypes = {
  id: PropTypes.string.isRequired,
};

function Aurora({ id }) {
  const mint = `${id}-mint`;
  const green = `${id}-green`;
  const violet = `${id}-violet`;
  return (
    <svg className="sky-aurora-svg" viewBox="0 0 1600 520" preserveAspectRatio="none">
      <defs>
        <linearGradient id={mint} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d8fff4" stopOpacity="0.05" />
          <stop offset="28%" stopColor="#7dffe4" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#7dffe4" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={green} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e7fff4" stopOpacity="0.02" />
          <stop offset="40%" stopColor="#8dffc4" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#8dffc4" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={violet} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f2e6ff" stopOpacity="0.02" />
          <stop offset="32%" stopColor="#c9a6ff" stopOpacity="0.82" />
          <stop offset="100%" stopColor="#c9a6ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${mint})`}
        d="M60,0 C180,90 40,200 160,340 C230,440 120,490 200,520 L420,520 C300,430 460,300 340,180 C240,70 360,40 250,0 Z"
      />
      <path
        fill={`url(#${green})`}
        d="M690,0 C800,70 640,200 790,320 C860,410 740,470 840,520 L960,520 C860,430 1020,300 900,150 C810,40 960,28 840,0 Z"
      />
      <path
        fill={`url(#${violet})`}
        d="M1040,0 C1180,80 1020,210 1160,340 C1260,440 1140,490 1240,520 L1460,520 C1340,430 1520,300 1380,170 C1280,60 1420,30 1280,0 Z"
      />
    </svg>
  );
}

Aurora.propTypes = {
  id: PropTypes.string.isRequired,
};

function Clouds() {
  return (
    <>
      <i className="cloud c1" />
      <i className="cloud shade c1s" />
      <i className="cloud c2" />
      <i className="cloud shade c2s" />
    </>
  );
}
