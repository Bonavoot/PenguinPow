import PropTypes from "prop-types";
import { useEffect, useMemo, useRef, useState } from "react";
import mapImage from "../assets/game-map-444.webp";
import dohyoImage from "../assets/dohyo-display.webp";
import pumoIdle from "../assets/pumo-idle.png";
import gyojiImage from "../assets/gyoji.png";
import saltBasketImage from "../assets/salt-basket.png";
import happyFeetIcon from "../assets/happy-feet.png";
import powerWaterIcon from "../assets/power-water.png";
import snowballIcon from "../assets/snowball.png";
import shatterPalmIcon from "../assets/shatter-palm-icon.png";
import crowdBoy from "../assets/crowd-boy-idle-1-graded.png";
import crowdGirl from "../assets/crowd-girl-idle-1-graded.png";
import crowdGeisha from "../assets/crowd-geisha-idle-1-graded.png";
import crowdOldman from "../assets/crowd-oldman-idle-1-graded.png";
import crowdSalaryman from "../assets/crowd-salaryman-idle-1-graded.png";
import crowdSide from "../assets/crowd-side-idle-1-graded.png";
import pumoArmyIcon from "../components/pumo-army-icon.png";
import { buildIdlePortraitSrc } from "../utils/hatComposite";
import {
  EVENT_FIXTURES,
  HUD_FIXTURES,
  MOMENT_FIXTURES,
  POWER_UP_LABELS,
  RAPID_EVENT_KEYS,
  VIEWPORT_PRESETS,
} from "./presentationFixtures";
import "./PresentationLab.css";

const DIRECTIONS = {
  A: {
    name: "Conservative Evolution",
    description: "Current silhouette, quieter materials and clearer type roles.",
  },
  B: {
    name: "Winter Basho Broadcast",
    description: "Unified fighter wings, center hub and sports-manga event cuts.",
  },
  C: {
    name: "Bold Graphic Fighter",
    description: "Stronger ownership wedges and the fastest directional motion.",
  },
};

const POWER_UP_ICONS = {
  speed: happyFeetIcon,
  power: powerWaterIcon,
  snowball: snowballIcon,
  pumo_army: pumoArmyIcon,
  shatter_palm: shatterPalmIcon,
};

const CROWD_SPRITES = [
  crowdBoy,
  crowdGirl,
  crowdGeisha,
  crowdOldman,
  crowdSalaryman,
  crowdSide,
];

const LAB_CROWD = [
  { bottom: 31, count: 13, size: 11.2 },
  { bottom: 40, count: 15, size: 9.8 },
  { bottom: 49, count: 16, size: 8.8 },
  { bottom: 59, count: 18, size: 7.8 },
  { bottom: 69, count: 19, size: 7.1 },
  { bottom: 79, count: 20, size: 6.5 },
  { bottom: 88, count: 21, size: 5.9 },
].flatMap((row, rowIndex) =>
  Array.from({ length: row.count }, (_, columnIndex) => {
    const x = 1.5 + (columnIndex * 97) / Math.max(1, row.count - 1);
    const nearAisle = x > 43 && x < 57;
    return {
      id: `${rowIndex}-${columnIndex}`,
      src: CROWD_SPRITES[(columnIndex + rowIndex * 2) % CROWD_SPRITES.length],
      x,
      bottom: row.bottom + ((columnIndex % 3) - 1) * 0.6,
      size: row.size * (nearAisle ? 0.72 : 1),
      hidden: nearAisle && rowIndex > 1,
      flip: (columnIndex + rowIndex) % 2 === 0,
    };
  }),
);

const MOMENTS_WITH_HUD = new Set([
  "fight",
  "handsDown",
  "hakkiYoi",
  "resultForce",
  "resultThrow",
  "resultLong",
  "victory",
  "defeat",
]);

const readQueryChoice = (params, key, choices, fallback) => {
  const value = params.get(key);
  return choices.includes(value) ? value : fallback;
};

const readQueryMs = (params, key) => {
  const value = Number.parseInt(params.get(key) || "0", 10);
  return Number.isFinite(value) ? Math.min(3000, Math.max(0, value)) : 0;
};

function useLabPortraits() {
  const [portraits, setPortraits] = useState({
    left: pumoIdle,
    right: pumoIdle,
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      buildIdlePortraitSrc({
        baseSrc: pumoIdle,
        mawashiColor: "#26c99a",
        bodyColor: null,
        gearIds: [],
      }),
      buildIdlePortraitSrc({
        baseSrc: pumoIdle,
        mawashiColor: "#9b5de5",
        bodyColor: null,
        gearIds: [],
      }),
    ])
      .then(([left, right]) => {
        if (!cancelled) setPortraits({ left, right });
      })
      .catch(() => {
        if (!cancelled) setPortraits({ left: pumoIdle, right: pumoIdle });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return portraits;
}

const ScoreMarks = ({ score, side }) => (
  <div className="pml-score" data-side={side} aria-label={`${score} round wins`}>
    {[0, 1, 2].map((index) => (
      <span
        key={index}
        className={index < score ? "is-won" : ""}
        aria-hidden="true"
      />
    ))}
  </div>
);

ScoreMarks.propTypes = {
  score: PropTypes.number.isRequired,
  side: PropTypes.oneOf(["left", "right"]).isRequired,
};

const Meter = ({ kind, value, ghostValue, side, danger, broken }) => (
  <div
    className={`pml-meter pml-meter--${kind}${danger ? " is-danger" : ""}${
      broken ? " is-broken" : ""
    }`}
    data-side={side}
    role="meter"
    aria-label={`${kind}: ${Math.round(value)} percent${broken ? ", broken" : ""}`}
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow={Math.round(value)}
  >
    <span className="pml-meter-label">
      {kind === "stamina" ? "STAMINA" : broken ? "POSTURE · BROKEN" : "POSTURE"}
    </span>
    <span className="pml-meter-track" aria-hidden="true">
      {Number.isFinite(ghostValue) && ghostValue > value && (
        <span
          className="pml-meter-ghost"
          style={{ "--meter-value": `${ghostValue}%` }}
        />
      )}
      <span
        className="pml-meter-fill"
        style={{ "--meter-value": `${value}%` }}
      />
      {kind === "posture" && <span className="pml-meter-kill-notch" />}
    </span>
  </div>
);

Meter.propTypes = {
  kind: PropTypes.oneOf(["stamina", "posture"]).isRequired,
  value: PropTypes.number.isRequired,
  ghostValue: PropTypes.number,
  side: PropTypes.oneOf(["left", "right"]).isRequired,
  danger: PropTypes.bool,
  broken: PropTypes.bool,
};

Meter.defaultProps = {
  ghostValue: undefined,
  danger: false,
  broken: false,
};

const PowerCharm = ({ powerUp, cooldown, charges }) => {
  if (!powerUp) {
    return (
      <div className="pml-power pml-power--empty" aria-label="No active power-up">
        <span aria-hidden="true">—</span>
      </div>
    );
  }

  const icon = POWER_UP_ICONS[powerUp];
  const label = POWER_UP_LABELS[powerUp] || powerUp.replaceAll("_", " ");
  return (
    <div
      className={`pml-power${cooldown ? " is-cooldown" : ""}`}
      aria-label={`${label}${cooldown ? ", cooling down" : ""}${
        Number.isFinite(charges) ? `, ${charges} charges` : ""
      }`}
      title={label}
    >
      {icon ? <img src={icon} alt="" /> : <span>{label.slice(0, 2)}</span>}
      {cooldown && <b>WAIT</b>}
      {Number.isFinite(charges) && <em>×{charges}</em>}
    </div>
  );
};

PowerCharm.propTypes = {
  powerUp: PropTypes.string,
  cooldown: PropTypes.bool,
  charges: PropTypes.number,
};

PowerCharm.defaultProps = {
  powerUp: null,
  cooldown: false,
  charges: null,
};

const TacticalState = ({ fighter }) => {
  let state = null;
  if (fighter.gassed) state = "GASSED";
  else if (fighter.recovering) state = "SECOND WIND";
  else if (fighter.deepGrip === "hold") state = "DEEP GRIP";
  else if (fighter.deepGrip === "threat") state = "EXPOSED";
  else if (fighter.shove) state = fighter.shove;

  return state ? (
    <span
      className={`pml-tactical pml-tactical--${state
        .toLowerCase()
        .replaceAll(" ", "-")}`}
    >
      {state}
    </span>
  ) : null;
};

TacticalState.propTypes = {
  fighter: PropTypes.shape({
    gassed: PropTypes.bool,
    recovering: PropTypes.bool,
    deepGrip: PropTypes.string,
    shove: PropTypes.string,
  }).isRequired,
};

const FighterWing = ({
  side,
  fighter,
  name,
  rank,
  local,
  score,
  accent,
}) => {
  const staminaDanger = fighter.stamina < 25;
  const postureDanger = fighter.posture < 15;

  return (
    <section
      className={`pml-wing${local ? " is-local" : ""}${
        fighter.gassed ? " is-gassed" : ""
      }${staminaDanger ? " is-danger" : ""}`}
      data-side={side}
      style={{ "--fighter-accent": accent }}
      aria-label={`${name}, ${local ? "local player" : "opponent"}`}
    >
      <div className="pml-wing-cap" aria-hidden="true" />
      <header className="pml-identity">
        <div className="pml-name-stack">
          <span className="pml-rank">{rank}</span>
          <strong className="pml-name">{name}</strong>
        </div>
        {local && <span className="pml-local-mark">YOU</span>}
        <ScoreMarks score={score} side={side} />
      </header>
      <div className="pml-vitals">
        <Meter
          kind="stamina"
          value={fighter.stamina}
          ghostValue={fighter.ghostStamina}
          side={side}
          danger={staminaDanger}
        />
        <Meter
          kind="posture"
          value={fighter.posture}
          side={side}
          danger={postureDanger}
          broken={fighter.postureBroken}
        />
        <TacticalState fighter={fighter} />
      </div>
      <PowerCharm
        powerUp={fighter.powerUp}
        cooldown={fighter.cooldown}
        charges={fighter.charges}
      />
      {fighter.boons.length > 0 && (
        <div className="pml-boons" aria-label={`Boons: ${fighter.boons.join(", ")}`}>
          {fighter.boons.map((boon) => (
            <span key={boon}>{boon}</span>
          ))}
        </div>
      )}
    </section>
  );
};

FighterWing.propTypes = {
  side: PropTypes.oneOf(["left", "right"]).isRequired,
  fighter: PropTypes.shape({
    stamina: PropTypes.number.isRequired,
    ghostStamina: PropTypes.number,
    posture: PropTypes.number.isRequired,
    gassed: PropTypes.bool,
    recovering: PropTypes.bool,
    postureBroken: PropTypes.bool,
    deepGrip: PropTypes.string,
    shove: PropTypes.string,
    powerUp: PropTypes.string,
    cooldown: PropTypes.bool,
    charges: PropTypes.number,
    boons: PropTypes.arrayOf(PropTypes.string).isRequired,
  }).isRequired,
  name: PropTypes.string.isRequired,
  rank: PropTypes.string.isRequired,
  local: PropTypes.bool.isRequired,
  score: PropTypes.number.isRequired,
  accent: PropTypes.string.isRequired,
};

const MatchHud = ({ fixture, inverted, longNames }) => {
  const leftName = longNames ? "AVALANCHE ANNIHILATOR" : "HAKUPENGU";
  const rightName = longNames ? "CHONKAISHO OF THE NORTH" : "CHONKAISHO";
  const physicalLeft = inverted ? fixture.fighters.right : fixture.fighters.left;
  const physicalRight = inverted ? fixture.fighters.left : fixture.fighters.right;

  return (
    <div className={`pml-hud${fixture.matchOver ? " is-match-over" : ""}`}>
      <FighterWing
        side="left"
        fighter={physicalLeft}
        name={inverted ? rightName : leftName}
        rank={fixture.basho ? (inverted ? "SEKIWAKE" : "YOKOZUNA") : "YOKOZUNA"}
        local={!inverted}
        score={inverted ? fixture.score[1] : fixture.score[0]}
        accent={inverted ? "#9b5de5" : "#26c99a"}
      />
      <div className="pml-center-hub" aria-label={`${fixture.basho ? "Day" : "Round"} ${fixture.day}`}>
        <span>{fixture.basho ? "DAY" : "ROUND"}</span>
        <strong>{fixture.day}</strong>
        <i aria-hidden="true" />
      </div>
      <FighterWing
        side="right"
        fighter={physicalRight}
        name={inverted ? leftName : rightName}
        rank={fixture.basho ? (inverted ? "YOKOZUNA" : "SEKIWAKE") : "YOKOZUNA"}
        local={inverted}
        score={inverted ? fixture.score[0] : fixture.score[1]}
        accent={inverted ? "#26c99a" : "#9b5de5"}
      />
    </div>
  );
};

MatchHud.propTypes = {
  fixture: PropTypes.shape({
    day: PropTypes.number.isRequired,
    score: PropTypes.arrayOf(PropTypes.number).isRequired,
    basho: PropTypes.bool,
    matchOver: PropTypes.bool,
    fighters: PropTypes.shape({
      left: FighterWing.propTypes.fighter,
      right: FighterWing.propTypes.fighter,
    }).isRequired,
  }).isRequired,
  inverted: PropTypes.bool.isRequired,
  longNames: PropTypes.bool.isRequired,
};

const ArenaSet = ({ portraits, inverted, contrast }) => (
  <div className={`pml-arena pml-arena--${contrast}`} aria-hidden="true">
    <div
      className="pml-arena-map"
      style={{ backgroundImage: `url(${mapImage})` }}
    />
    <div className="pml-crowd">
      {LAB_CROWD.map((member) =>
        member.hidden ? null : (
          <img
            key={member.id}
            src={member.src}
            alt=""
            style={{
              "--crowd-x": `${member.x}%`,
              "--crowd-bottom": `${member.bottom}%`,
              "--crowd-size": `${member.size}%`,
              "--crowd-flip": member.flip ? -1 : 1,
            }}
          />
        ),
      )}
    </div>
    <img className="pml-dohyo" src={dohyoImage} alt="" />
    <img className="pml-gyoji" src={gyojiImage} alt="" />
    <img className="pml-salt pml-salt--left" src={saltBasketImage} alt="" />
    <img className="pml-salt pml-salt--right" src={saltBasketImage} alt="" />
    <img
      className="pml-fighter pml-fighter--left"
      src={inverted ? portraits.right : portraits.left}
      alt=""
    />
    <img
      className="pml-fighter pml-fighter--right"
      src={inverted ? portraits.left : portraits.right}
      alt=""
    />
    <div className="pml-arena-light" />
  </div>
);

ArenaSet.propTypes = {
  portraits: PropTypes.shape({
    left: PropTypes.string.isRequired,
    right: PropTypes.string.isRequired,
  }).isRequired,
  inverted: PropTypes.bool.isRequired,
  contrast: PropTypes.oneOf(["arena", "bright", "dark"]).isRequired,
};

const EventCallout = ({ event, side, overlap, replayKey }) => {
  if (!event || event.tier === 0) return null;
  const opposite = side === "left" ? "right" : "left";

  const callout = (calloutSide, secondary = false) => (
    <div
      key={`${replayKey}-${calloutSide}-${secondary ? "secondary" : "primary"}`}
      className={`pml-event pml-event--tier-${event.tier}${
        secondary ? " is-secondary" : ""
      }`}
      data-side={calloutSide}
      role="status"
    >
      <span className="pml-event-cut" aria-hidden="true" />
      <strong>{secondary ? "RESISTED" : event.label}</strong>
      <small>{secondary ? "simultaneous read" : event.cue}</small>
    </div>
  );

  return (
    <div className="pml-event-layer">
      {callout(side)}
      {overlap && callout(opposite, true)}
    </div>
  );
};

EventCallout.propTypes = {
  event: PropTypes.shape({
    label: PropTypes.string,
    cue: PropTypes.string,
    tier: PropTypes.number.isRequired,
  }),
  side: PropTypes.oneOf(["left", "right"]).isRequired,
  overlap: PropTypes.bool.isRequired,
  replayKey: PropTypes.number.isRequired,
};

EventCallout.defaultProps = {
  event: null,
};

const Ceremony = ({ momentKey, moment, replayKey }) => {
  if (momentKey === "handsDown") {
    return (
      <div key={replayKey} className="pml-ceremony pml-ceremony--hands" role="status">
        <span className="pml-ceremony-hold" aria-hidden="true" />
        <strong>HANDS DOWN</strong>
        <small lang="ja">手を付いて</small>
      </div>
    );
  }
  if (momentKey === "hakkiYoi") {
    return (
      <div key={replayKey} className="pml-ceremony pml-ceremony--hakki" role="status">
        <span className="pml-ceremony-release" aria-hidden="true" />
        <strong>HAKKI-YOI</strong>
        <small lang="ja">八卦良い</small>
      </div>
    );
  }
  if (moment?.result) {
    return (
      <div key={replayKey} className="pml-result" role="status">
        <span className="pml-result-rule" aria-hidden="true" />
        <strong>{moment.result}</strong>
        <small lang="ja">{moment.japanese}</small>
      </div>
    );
  }
  if (momentKey === "victory" || momentKey === "defeat") {
    return (
      <div
        key={replayKey}
        className={`pml-outcome pml-outcome--${momentKey}`}
        role="status"
      >
        <span>{momentKey === "victory" ? "BOUT WON" : "BOUT LOST"}</span>
        <strong>{momentKey.toUpperCase()}</strong>
        <small>{momentKey === "victory" ? "Kachi-koshi" : "Make-koshi"}</small>
      </div>
    );
  }
  return null;
};

Ceremony.propTypes = {
  momentKey: PropTypes.string.isRequired,
  moment: PropTypes.shape({
    result: PropTypes.string,
    japanese: PropTypes.string,
  }).isRequired,
  replayKey: PropTypes.number.isRequired,
};

const PreMatchMoment = ({ longNames, replayKey }) => (
  <div key={replayKey} className="pml-flow-card pml-flow-card--prematch">
    <span className="pml-flow-kicker">WINTER BASHO · DAY 12</span>
    <div className="pml-versus">
      <div>
        <small>EAST · YOKOZUNA</small>
        <strong>{longNames ? "AVALANCHE ANNIHILATOR" : "HAKUPENGU"}</strong>
      </div>
      <b>VS</b>
      <div>
        <small>WEST · SEKIWAKE</small>
        <strong>{longNames ? "CHONKAISHO OF THE NORTH" : "CHONKAISHO"}</strong>
      </div>
    </div>
    <span className="pml-ready-line">WRESTLERS READY</span>
  </div>
);

PreMatchMoment.propTypes = {
  longNames: PropTypes.bool.isRequired,
  replayKey: PropTypes.number.isRequired,
};

const DayCardMoment = ({ replayKey }) => (
  <div key={replayKey} className="pml-flow-card pml-flow-card--day">
    <section>
      <span className="pml-flow-kicker">HONBASHO PROGRAM</span>
      <strong className="pml-day-number">12</strong>
      <small>DAY · MAKUUCHI</small>
      <h2>THE TUSKED TEMPEST</h2>
      <p>Record 8–3 · Aggressive pusher</p>
    </section>
    <section className="pml-draft">
      <span className="pml-flow-kicker">CHOOSE TODAY&apos;S BOON</span>
      <div>
        {["HAPPY FEET", "SHATTER PALM", "THICK BLUBBER"].map((item, index) => (
          <button key={item} type="button" className={index === 1 ? "is-picked" : ""}>
            <i aria-hidden="true">{index + 1}</i>
            <span>{item}</span>
          </button>
        ))}
      </div>
      <b>BEGIN BOUT</b>
    </section>
  </div>
);

DayCardMoment.propTypes = {
  replayKey: PropTypes.number.isRequired,
};

const MatchOverMoment = ({ replayKey }) => (
  <div key={replayKey} className="pml-flow-card pml-flow-card--match-over">
    <span className="pml-flow-kicker">FINAL BOUT</span>
    <strong>VICTORY</strong>
    <small>KACHI-KOSHI · 2–1</small>
    <div className="pml-match-actions">
      <b>REMATCH</b>
      <span>RETURN TO BASHO</span>
    </div>
  </div>
);

MatchOverMoment.propTypes = {
  replayKey: PropTypes.number.isRequired,
};

const PresentationStage = ({
  direction,
  fixture,
  event,
  momentKey,
  moment,
  portraits,
  inverted,
  longNames,
  overlap,
  contrast,
  replayKey,
}) => (
  <div
    className={`pml-stage pml-direction-${direction.toLowerCase()}`}
    data-direction={direction}
  >
    <ArenaSet portraits={portraits} inverted={inverted} contrast={contrast} />
    {MOMENTS_WITH_HUD.has(momentKey) && (
      <MatchHud fixture={fixture} inverted={inverted} longNames={longNames} />
    )}
    {momentKey === "fight" && (
      <EventCallout
        event={event}
        side={inverted ? "right" : "left"}
        overlap={overlap}
        replayKey={replayKey}
      />
    )}
    <Ceremony momentKey={momentKey} moment={moment} replayKey={replayKey} />
    {["preMatch", "dayCard", "matchOver"].includes(momentKey) && (
      <div className="pml-flow-dim" aria-hidden="true" />
    )}
    {momentKey === "preMatch" && (
      <PreMatchMoment longNames={longNames} replayKey={replayKey} />
    )}
    {momentKey === "dayCard" && <DayCardMoment replayKey={replayKey} />}
    {momentKey === "matchOver" && <MatchOverMoment replayKey={replayKey} />}
    <div className="pml-safe-frame" aria-hidden="true" />
  </div>
);

PresentationStage.propTypes = {
  direction: PropTypes.oneOf(["A", "B", "C"]).isRequired,
  fixture: MatchHud.propTypes.fixture,
  event: EventCallout.propTypes.event,
  momentKey: PropTypes.string.isRequired,
  moment: Ceremony.propTypes.moment,
  portraits: ArenaSet.propTypes.portraits,
  inverted: PropTypes.bool.isRequired,
  longNames: PropTypes.bool.isRequired,
  overlap: PropTypes.bool.isRequired,
  contrast: ArenaSet.propTypes.contrast,
  replayKey: PropTypes.number.isRequired,
};

const SelectControl = ({ label, value, onChange, children }) => (
  <label className="pml-control">
    <span>{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      {children}
    </select>
  </label>
);

SelectControl.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
};

const ToggleControl = ({ label, checked, onChange }) => (
  <label className="pml-toggle">
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
    />
    <span>{label}</span>
  </label>
);

ToggleControl.propTypes = {
  label: PropTypes.string.isRequired,
  checked: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
};

export default function PresentationLab() {
  const query = useMemo(() => new URLSearchParams(window.location.search), []);
  const [direction, setDirection] = useState(
    readQueryChoice(query, "direction", Object.keys(DIRECTIONS), "B"),
  );
  const [fixtureKey, setFixtureKey] = useState(
    readQueryChoice(query, "fixture", Object.keys(HUD_FIXTURES), "neutral"),
  );
  const [eventKey, setEventKey] = useState(
    readQueryChoice(query, "event", Object.keys(EVENT_FIXTURES), "none"),
  );
  const [momentKey, setMomentKey] = useState(
    readQueryChoice(query, "moment", Object.keys(MOMENT_FIXTURES), "fight"),
  );
  const [viewportKey, setViewportKey] = useState(
    readQueryChoice(query, "viewport", Object.keys(VIEWPORT_PRESETS), "1920x1080"),
  );
  const [contrast, setContrast] = useState(
    readQueryChoice(query, "contrast", ["arena", "bright", "dark"], "arena"),
  );
  const [speed, setSpeed] = useState(
    readQueryChoice(query, "speed", ["0.25", "0.5", "1"], "1"),
  );
  const [inverted, setInverted] = useState(query.get("inverted") === "1");
  const [longNames, setLongNames] = useState(query.get("long") === "1");
  const [overlap, setOverlap] = useState(query.get("overlap") === "1");
  const [reducedMotion, setReducedMotion] = useState(
    query.get("reduced") === "1",
  );
  const [paused, setPaused] = useState(query.get("paused") === "1");
  const [seekMs, setSeekMs] = useState(readQueryMs(query, "seek"));
  const [replayKey, setReplayKey] = useState(0);
  const rapidTimersRef = useRef([]);
  const portraits = useLabPortraits();

  const fixture = HUD_FIXTURES[fixtureKey];
  const event = EVENT_FIXTURES[eventKey];
  const moment = MOMENT_FIXTURES[momentKey];
  const viewport = VIEWPORT_PRESETS[viewportKey];
  const controlsVisible = query.get("chrome") !== "0";
  const motionScale = speed === "0.25" ? 4 : speed === "0.5" ? 2 : 1;

  useEffect(
    () => () => {
      rapidTimersRef.current.forEach(clearTimeout);
    },
    [],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("presentationLab", "1");
    params.set("direction", direction);
    params.set("fixture", fixtureKey);
    params.set("event", eventKey);
    params.set("moment", momentKey);
    params.set("viewport", viewportKey);
    params.set("contrast", contrast);
    params.set("speed", speed);
    params.set("inverted", inverted ? "1" : "0");
    params.set("long", longNames ? "1" : "0");
    params.set("overlap", overlap ? "1" : "0");
    params.set("reduced", reducedMotion ? "1" : "0");
    params.set("paused", paused ? "1" : "0");
    params.set("seek", String(seekMs));
    window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
  }, [
    contrast,
    direction,
    eventKey,
    fixtureKey,
    inverted,
    longNames,
    momentKey,
    overlap,
    paused,
    reducedMotion,
    seekMs,
    speed,
    viewportKey,
  ]);

  const replay = () => {
    setSeekMs(0);
    setPaused(false);
    setReplayKey((value) => value + 1);
  };

  const stepFrame = () => {
    setPaused(true);
    setSeekMs((value) => (value + 100) % 3000);
    setReplayKey((value) => value + 1);
  };

  const runRapidSequence = () => {
    rapidTimersRef.current.forEach(clearTimeout);
    rapidTimersRef.current = [];
    setMomentKey("fight");
    RAPID_EVENT_KEYS.forEach((key, index) => {
      const timer = setTimeout(
        () => {
          setEventKey(key);
          setReplayKey((value) => value + 1);
        },
        index * (reducedMotion ? 520 : 260),
      );
      rapidTimersRef.current.push(timer);
    });
  };

  return (
    <main
      className={`pml-shell${controlsVisible ? "" : " is-capture"}`}
      data-paused={paused ? "true" : "false"}
      data-reduced-motion={reducedMotion ? "true" : "false"}
      style={{
        "--lab-motion-scale": motionScale,
        "--lab-scrub": paused ? `-${seekMs}ms` : "0ms",
      }}
    >
      {controlsVisible && (
        <aside className="pml-controls">
          <header>
            <div>
              <span>PUMO PUMO · DEV ONLY</span>
              <h1>Presentation Lab</h1>
            </div>
            <b>LOCAL FIXTURES · NO SOCKET</b>
          </header>

          <div className="pml-control-grid">
            <SelectControl label="Direction" value={direction} onChange={setDirection}>
              {Object.entries(DIRECTIONS).map(([key, item]) => (
                <option key={key} value={key}>
                  {key} — {item.name}
                </option>
              ))}
            </SelectControl>
            <SelectControl label="HUD fixture" value={fixtureKey} onChange={setFixtureKey}>
              {Object.entries(HUD_FIXTURES).map(([key, item]) => (
                <option key={key} value={key}>
                  {item.label}
                </option>
              ))}
            </SelectControl>
            <SelectControl label="Combat event" value={eventKey} onChange={setEventKey}>
              {Object.entries(EVENT_FIXTURES).map(([key, item]) => (
                <option key={key} value={key}>
                  {item.label}
                </option>
              ))}
            </SelectControl>
            <SelectControl label="Ceremony / flow" value={momentKey} onChange={setMomentKey}>
              {Object.entries(MOMENT_FIXTURES).map(([key, item]) => (
                <option key={key} value={key}>
                  {item.label}
                </option>
              ))}
            </SelectControl>
            <SelectControl label="Viewport" value={viewportKey} onChange={setViewportKey}>
              {Object.entries(VIEWPORT_PRESETS).map(([key, item]) => (
                <option key={key} value={key}>
                  {key} — {item.label}
                </option>
              ))}
            </SelectControl>
            <SelectControl label="Contrast test" value={contrast} onChange={setContrast}>
              <option value="arena">Actual arena</option>
              <option value="bright">Bright wash</option>
              <option value="dark">Dark wash</option>
            </SelectControl>
            <SelectControl label="Playback" value={speed} onChange={setSpeed}>
              <option value="0.25">0.25×</option>
              <option value="0.5">0.5×</option>
              <option value="1">1×</option>
            </SelectControl>
          </div>

          <div className="pml-toggle-row">
            <ToggleControl label="Invert sides" checked={inverted} onChange={setInverted} />
            <ToggleControl label="Long names" checked={longNames} onChange={setLongNames} />
            <ToggleControl label="Overlap test" checked={overlap} onChange={setOverlap} />
            <ToggleControl
              label="Reduced motion"
              checked={reducedMotion}
              onChange={setReducedMotion}
            />
          </div>

          <div className="pml-transport">
            <button type="button" onClick={replay}>
              Replay
            </button>
            <button type="button" onClick={() => setPaused((value) => !value)}>
              {paused ? "Resume" : "Pause"}
            </button>
            <button type="button" onClick={stepFrame}>
              Step +100ms
            </button>
            <button type="button" onClick={runRapidSequence}>
              Rapid replacement
            </button>
            <span>{paused ? `Frame ${seekMs}ms` : "Live"}</span>
          </div>
        </aside>
      )}

      <section className="pml-preview">
        {controlsVisible && (
          <div className="pml-preview-meta">
            <div>
              <strong>
                Direction {direction} · {DIRECTIONS[direction].name}
              </strong>
              <span>{DIRECTIONS[direction].description}</span>
            </div>
            <span>
              {viewportKey} · {fixture.label}
            </span>
          </div>
        )}
        <div
          className="pml-stage-frame"
          style={{
            "--preview-aspect": `${viewport.width} / ${viewport.height}`,
          }}
        >
          <PresentationStage
            direction={direction}
            fixture={fixture}
            event={event}
            momentKey={momentKey}
            moment={moment}
            portraits={portraits}
            inverted={inverted}
            longNames={longNames}
            overlap={overlap}
            contrast={contrast}
            replayKey={replayKey}
          />
        </div>
      </section>
    </main>
  );
}
