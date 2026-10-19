import { memo, useId } from "react";
import PropTypes from "prop-types";
import "./AntarcticaSky.css";

/**
 * Antarctica sky. Color, sun, moon, clouds, and aurora are CSS on [data-sky].
 * The floor plate, the lake, and the horizon mist read the same attribute
 * from an ancestor. Sun and moon positions are the fight frame.
 * Cloud banks drift inside sheets that share the sun's parallax,
 * so a camera pan cannot pull a disc through a bank.
 */
function AntarcticaSky({ phase = "day" }) {
  const id = useId().replace(/:/g, "");
  return (
    <div className="antarctica-sky" data-sky={phase}>
      <div className="sky-sheet sky-field" />
      <div className="sky-sheet sky-stars">
        <Stars />
      </div>
      <div className="sky-sheet sky-aurora">
        <Aurora id={id} />
      </div>
      <div className="sky-sheet sky-shafts">
        <div className="sun-shaft">
          <i className="a" />
          <i className="b" />
          <i className="c" />
        </div>
      </div>
      <div className="sky-sheet sky-clouds sky-clouds-far">
        <div className="cloud-drift">
          <div className="cloud-bank bank-far-a">
            <CloudShelf />
          </div>
        </div>
      </div>
      <div className="sky-sheet sky-clouds sky-clouds-mid">
        <div className="cloud-drift">
          <div className="cloud-bank bank-mid-a">
            <CloudBank />
          </div>
          <div className="cloud-bank bank-mid-b">
            <CloudPuff />
          </div>
        </div>
      </div>
      <div className="sky-sheet sky-celestial">
        <Sun />
        <Moon />
      </div>
    </div>
  );
}

AntarcticaSky.propTypes = {
  phase: PropTypes.oneOf(["day", "afternoon", "night"]),
};

const MemoAntarcticaSky = memo(AntarcticaSky);
export default MemoAntarcticaSky;

export function AntarcticaFarRange() {
  return (
    <div className="antarctica-far">
      <FarRange />
    </div>
  );
}

function starUnit(n) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

function starFill(t) {
  if (t > 0.97) return "#ffb0a0";
  if (t > 0.92) return "#ffe7c2";
  if (t > 0.78) return "#d5e6ff";
  return "#ffffff";
}

/* Thin diffraction spike. The point itself is a crisp circle. */
function spike(cx, cy, r) {
  const arm = r * 2.4;
  const t = Math.max(0.35, r * 0.16);
  return `M${cx} ${cy - arm}L${cx + t} ${cy}L${cx} ${cy + arm}L${cx - t} ${cy}Z M${cx - arm} ${cy}L${cx} ${cy + t}L${cx + arm} ${cy}L${cx} ${cy - t}Z`;
}

/* Southern sky, high in the frame so the peaks leave it in the open.
   Crux is the kite; the two bright stars to its left are the Centaurus pointers.
   Gacrux (the top of the cross) is the red one. */
const CRUX = [
  { x: 268, y: 46, r: 2.15, fill: "#ffb0a4", name: "gacrux" },
  { x: 214, y: 98, r: 2.35, fill: "#ffffff", name: "mimosa" },
  { x: 330, y: 108, r: 1.9, fill: "#ffffff", name: "delta" },
  { x: 286, y: 162, r: 2.45, fill: "#e7f0ff", name: "acrux" },
];
const POINTERS = [
  { x: 128, y: 64, r: 2.2, fill: "#e7f0ff", name: "hadar" },
  { x: 86, y: 128, r: 2.55, fill: "#fff6e0", name: "rigil" },
];
const FIELD_SPARKS = [
  { x: 640, y: 38, r: 1.7, fill: "#ffffff" },
  { x: 820, y: 52, r: 1.55, fill: "#d5e6ff" },
  { x: 990, y: 30, r: 1.8, fill: "#ffffff" },
  { x: 1180, y: 58, r: 1.5, fill: "#ffe7c2" },
  { x: 1470, y: 34, r: 1.75, fill: "#ffffff" },
  { x: 720, y: 96, r: 1.45, fill: "#ffb0a0" },
];

function scatter(count, seed, place) {
  const stars = [];
  for (let i = 0; i < count; i += 1) {
    const u = starUnit(i + seed);
    const v = starUnit(i + seed + 400);
    const w = starUnit(i + seed + 800);
    const tint = starUnit(i + seed + 1200);
    const star = place(i, u, v, w, tint);
    if (!star) continue;
    stars.push({
      fill: starFill(tint),
      opacity: star.opacity,
      r: star.r,
      x: star.x,
      y: star.y,
      key: star.key,
    });
  }
  return stars;
}

const DUST = scatter(420, 1, (i, u, v, w) => ({
  x: u * 1600,
  y: v * v * 360,
  r: w > 0.992 ? 1.05 : 0.18 + w * 0.42,
  opacity: 0.45 + w * 0.55,
  key: `f${i}`,
}));

/* Density along the southern band. No soft stroke — the cloud of
   points is the Milky Way. */
const MILKY = scatter(280, 6000, (i, u, v, w) => {
  const along = u;
  const x = 50 + along * 1500;
  const spread = 8 + 28 * Math.sin(along * Math.PI);
  const y = 16 + along * 200 + (v - 0.5) * spread * 1.6;
  return {
    x,
    y: Math.max(4, Math.min(280, y)),
    r: w > 0.97 ? 1.15 : 0.22 + w * 0.48,
    opacity: 0.4 + w * 0.6,
    key: `m${i}`,
  };
});

/* Magellanic clouds as tight knots of stars, not gradient fog. */
const MAGELLANIC = scatter(70, 9000, (i, u, v, w) => {
  const cloud = i < 48 ? 0 : 1;
  const cx = cloud === 0 ? 1330 : 1472;
  const cy = cloud === 0 ? 162 : 82;
  const rx = cloud === 0 ? 78 : 28;
  const ry = cloud === 0 ? 30 : 14;
  const a = u * Math.PI * 2;
  const rad = Math.sqrt(v);
  return {
    x: cx + Math.cos(a) * rx * rad,
    y: cy + Math.sin(a) * ry * rad,
    r: 0.28 + w * 0.55,
    opacity: 0.35 + w * 0.5,
    key: `g${i}`,
  };
});

const SPARKS = [...POINTERS, ...CRUX, ...FIELD_SPARKS];

function Stars() {
  const field = [...DUST, ...MILKY, ...MAGELLANIC];
  return (
    <svg className="sky-stars-svg" viewBox="0 0 1600 480" preserveAspectRatio="xMidYMin slice">
      {field.map((star) => (
        <circle
          key={star.key}
          cx={star.x}
          cy={star.y}
          r={star.r}
          fill={star.fill}
          fillOpacity={star.opacity}
        />
      ))}
      <g className="sky-constellation" fill="none" stroke="#ffffff" strokeWidth="0.7" strokeLinecap="round">
        <path d="M268 46 L286 162" />
        <path d="M214 98 L330 108" />
        <path d="M128 64 L86 128" />
      </g>
      {SPARKS.map((star, i) => (
        <g key={star.name || `${star.x}-${star.y}`}>
          <circle cx={star.x} cy={star.y} r={star.r} fill={star.fill} />
          <path
            className={`star-spark tw-${i % 3}`}
            style={{ animationDelay: `${(i * 0.53) % 5.2}s` }}
            fill={star.fill}
            d={spike(star.x, star.y, star.r)}
          />
        </g>
      ))}
    </svg>
  );
}

function curtainGeometry(seed, x, width) {
  const steps = 30;
  const left = [];
  const right = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const y = t * 520;
    const sway = Math.sin(t * 6.2 + seed) * 20 + Math.sin(t * 2.3 + seed * 2) * 14;
    const pinch = 0.8 + 0.2 * Math.sin(t * 8 + seed * 1.3);
    left.push([x + sway, y]);
    right.push([x + sway * 0.9 + width * pinch, y]);
  }
  const spine = left.map((p, i) => [(p[0] + right[i][0]) / 2, p[1]]);
  const ring = [...left, ...right.slice().reverse()];
  return { fill: pathFrom(ring, true), spine: pathFrom(spine, false) };
}

function pathFrom(points, close) {
  const [head, ...rest] = points;
  const body = rest.map((p) => `L${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("");
  return `M${head[0].toFixed(1)} ${head[1].toFixed(1)}${body}${close ? "Z" : ""}`;
}

const CURTAINS = [
  { x: 90, w: 54, seed: 0.4, tone: "mint", op: 0.42 },
  { x: 168, w: 22, seed: 1.3, tone: "mint", op: 0.7 },
  { x: 250, w: 36, seed: 2.2, tone: "green", op: 0.34 },
  { x: 640, w: 62, seed: 0.7, tone: "green", op: 0.38 },
  { x: 730, w: 18, seed: 1.8, tone: "mint", op: 0.78 },
  { x: 790, w: 28, seed: 2.6, tone: "green", op: 0.3 },
  { x: 1040, w: 48, seed: 1.1, tone: "violet", op: 0.4 },
  { x: 1120, w: 16, seed: 0.3, tone: "violet", op: 0.72 },
  { x: 1320, w: 40, seed: 2.0, tone: "mint", op: 0.36 },
  { x: 1390, w: 14, seed: 2.9, tone: "green", op: 0.66 },
].map((curtain) => ({ ...curtain, ...curtainGeometry(curtain.seed, curtain.x, curtain.w) }));

function Aurora({ id }) {
  const mint = `${id}-mint`;
  const green = `${id}-green`;
  const violet = `${id}-violet`;
  const fillId = { mint, green, violet };
  return (
    <svg className="sky-aurora-svg" viewBox="0 0 1600 520" preserveAspectRatio="none">
      <defs>
        <linearGradient id={mint} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e9fff8" stopOpacity="0" />
          <stop offset="22%" stopColor="#b6ffe6" stopOpacity="0.2" />
          <stop offset="48%" stopColor="#7dffe4" stopOpacity="0.95" />
          <stop offset="76%" stopColor="#5ecfb4" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#7dffe4" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={green} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f3fff6" stopOpacity="0" />
          <stop offset="30%" stopColor="#c8ffd8" stopOpacity="0.12" />
          <stop offset="52%" stopColor="#8dffc4" stopOpacity="0.8" />
          <stop offset="80%" stopColor="#6dcaa0" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#8dffc4" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={violet} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f6f0ff" stopOpacity="0" />
          <stop offset="26%" stopColor="#e4d4ff" stopOpacity="0.16" />
          <stop offset="50%" stopColor="#c9a6ff" stopOpacity="0.85" />
          <stop offset="78%" stopColor="#a98ae0" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#c9a6ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {CURTAINS.map((curtain) => (
        <g key={`${curtain.x}-${curtain.seed}`} opacity={curtain.op}>
          <path fill={`url(#${fillId[curtain.tone]})`} d={curtain.fill} />
          <path className="aurora-fold" d={curtain.spine} />
        </g>
      ))}
    </svg>
  );
}

Aurora.propTypes = {
  id: PropTypes.string.isRequired,
};

/* Far range. Simpler and lower contrast than the plate, so the
   foreground peaks stay the sharp silhouette. The plate occludes it. */
function FarRange() {
  return (
    <svg className="sky-far-svg" viewBox="0 0 1600 280" preserveAspectRatio="none" aria-hidden="true">
      <polygon className="far-shade" points="0,280 0,150 70,118 130,142 210,64 300,128 390,96 480,146 560,52 660,124 750,88 860,140 960,48 1070,120 1160,86 1260,138 1360,40 1460,112 1540,78 1600,120 1600,280" />
      <polygon className="far-body" points="0,280 0,188 100,156 190,176 280,124 380,168 480,132 580,184 690,118 800,170 900,136 1010,186 1120,122 1220,172 1330,108 1440,166 1540,130 1600,158 1600,280" />
      <polygon className="far-lit" points="186,92 210,64 248,108" />
      <polygon className="far-lit" points="528,86 560,52 610,100" />
      <polygon className="far-lit" points="924,82 960,48 1010,104" />
      <polygon className="far-lit" points="1324,78 1360,40 1410,96" />
    </svg>
  );
}

function Sun() {
  return (
    <div className="sky-sun">
      <i className="sun-corona" />
      <i className="sun-disc" />
    </div>
  );
}

function Moon() {
  return (
    <div className="sky-moon">
      <i className="moon-halo" />
      <div className="moon-face">
        <i className="moon-disc" />
        <i className="moon-shade" />
        <i className="moon-crater a" />
        <i className="moon-crater b" />
        <i className="moon-crater c" />
        <i className="moon-crater d" />
        <i className="moon-crater e" />
        <i className="moon-spec" />
      </div>
    </div>
  );
}

/* Faceted banks in the same flat-plane language as the ice.
   Light from the upper left. Bottoms are shade, caps are lit. */
function CloudBank() {
  return (
    <svg className="cloud-svg" viewBox="0 0 640 230" aria-hidden="true">
      <polygon className="cf-shade" points="18,150 70,118 146,136 232,104 328,132 424,100 520,128 600,112 624,168 628,214 8,214" />
      <polygon className="cf-body" points="28,162 62,108 128,74 188,104 164,146 86,154" />
      <polygon className="cf-body" points="146,156 198,86 276,48 352,74 386,122 312,156 214,166" />
      <polygon className="cf-body" points="330,148 392,78 478,52 556,90 582,138 496,164 404,158" />
      <polygon className="cf-lit" points="96,104 128,74 168,100 140,124" />
      <polygon className="cf-lit" points="214,88 276,48 330,80 292,108" />
      <polygon className="cf-lit" points="408,90 478,54 522,92 456,112" />
      <polygon className="cf-shadow" points="292,104 348,78 378,124 322,146" />
      <polygon className="cf-shadow" points="486,102 548,94 570,140 508,156" />
    </svg>
  );
}

function CloudPuff() {
  return (
    <svg className="cloud-svg" viewBox="0 0 420 250" aria-hidden="true">
      <polygon className="cf-shade" points="24,168 78,132 150,150 230,118 310,146 372,124 396,176 400,232 16,232" />
      <polygon className="cf-body" points="36,176 78,112 142,86 176,124 150,162 88,168" />
      <polygon className="cf-body" points="132,170 176,96 236,52 304,78 328,132 268,168 196,176" />
      <polygon className="cf-body" points="286,158 328,100 376,112 392,156 346,176 304,166" />
      <polygon className="cf-lit" points="108,112 142,84 166,116 136,132" />
      <polygon className="cf-lit" points="196,96 236,52 286,84 246,112" />
      <polygon className="cf-shadow" points="258,108 304,84 324,136 276,156" />
    </svg>
  );
}

function CloudShelf() {
  return (
    <svg className="cloud-svg" viewBox="0 0 720 180" aria-hidden="true">
      <polygon className="cf-shade" points="12,96 80,78 170,92 270,66 390,88 510,62 620,84 700,70 712,112 716,164 6,164" />
      <polygon className="cf-body" points="20,108 74,62 156,46 196,74 168,104 90,108" />
      <polygon className="cf-body" points="160,112 214,58 310,36 392,58 420,96 330,114 230,116" />
      <polygon className="cf-body" points="386,108 456,50 560,34 640,58 668,100 560,118 450,114" />
      <polygon className="cf-lit" points="108,68 156,46 184,72 146,84" />
      <polygon className="cf-lit" points="246,62 310,36 360,58 312,78" />
      <polygon className="cf-lit" points="492,58 560,34 608,60 536,76" />
      <polygon className="cf-shadow" points="330,72 388,58 412,98 352,110" />
      <polygon className="cf-shadow" points="560,70 632,60 656,102 578,112" />
    </svg>
  );
}
