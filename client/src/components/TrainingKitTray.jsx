import { useState } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import {
  C,
  FONT_UI,
  FONT_WEIGHT,
  FONT_RENDER,
  TEXT_SHADOW_DISPLAY_SOFT,
} from "./menuTheme";
import {
  getPowerUpIcon,
  getPowerUpLabel,
  getPowerUpTypeColor,
} from "../config/powerUpConfig";
import { playButtonHoverSound, playButtonPressSound2 } from "../utils/soundUtils";

export const EMPTY_TRAINING_KIT = {
  active: null,
  stacks: { speed: 0, power: 0 },
  techs: { flap: false, shattering_palm: false, thick_blubber: false },
};

export const EMPTY_TRAINING_KITS = {
  human: EMPTY_TRAINING_KIT,
  cpu: EMPTY_TRAINING_KIT,
};

const TRAINING_STACK_CAP = 7;

const ACTIVES = [
  { id: "snowball", hint: "F" },
  { id: "pumo_army", hint: "F" },
];

const STACKS = [{ id: "speed" }, { id: "power" }];

const TECHS = [
  { id: "shattering_palm", icon: "shatter_palm" },
  { id: "flap", icon: "flap" },
  { id: "thick_blubber", icon: "thick_blubber" },
];

const Root = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Title = styled.div`
  font-family: ${FONT_UI};
  font-size: 0.58rem;
  font-weight: ${FONT_WEIGHT.semibold};
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(245, 236, 217, 0.55);
  text-shadow: ${TEXT_SHADOW_DISPLAY_SOFT};
`;

const TargetSwitch = styled.div`
  display: flex;
  gap: 2px;
`;

const TargetBtn = styled.button`
  padding: 2px 8px;
  border: 1px solid ${(p) => (p.$active ? p.$color : "transparent")};
  background: ${(p) =>
    p.$active ? `${p.$color}33` : "rgba(255, 255, 255, 0.03)"};
  color: ${(p) => (p.$active ? "#fff" : "rgba(245, 236, 217, 0.5)")};
  font-family: ${FONT_UI};
  font-size: 0.52rem;
  font-weight: ${FONT_WEIGHT.semibold};
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  ${FONT_RENDER}

  &:hover {
    color: #fff;
  }
`;

const Hint = styled.div`
  flex: 1;
  min-width: 0;
  font-size: 0.48rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(245, 236, 217, 0.3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const GhostBtn = styled.button`
  padding: 0;
  border: 0;
  background: none;
  color: rgba(245, 236, 217, 0.32);
  font-family: ${FONT_UI};
  font-size: 0.48rem;
  font-weight: ${FONT_WEIGHT.medium};
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: pointer;
  ${FONT_RENDER}

  &:hover {
    color: rgba(245, 236, 217, 0.75);
  }
`;

const GroupLabel = styled.div`
  font-family: ${FONT_UI};
  font-size: 0.5rem;
  font-weight: ${FONT_WEIGHT.medium};
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(245, 236, 217, 0.32);
  margin-bottom: 5px;
`;

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
`;

const Stamp = styled.button`
  position: relative;
  width: 48px;
  height: 48px;
  padding: 0;
  border: 1px solid
    ${(p) => (p.$active ? p.$color : "rgba(245, 236, 217, 0.1)")};
  background: ${(p) =>
    p.$active ? `${p.$color}26` : "rgba(255, 255, 255, 0.03)"};
  box-shadow: ${(p) =>
    p.$active ? `0 0 10px ${p.$glow || "transparent"}` : "none"};
  cursor: pointer;
  ${FONT_RENDER}

  img {
    display: block;
    width: 30px;
    height: 30px;
    margin: 0 auto;
    object-fit: contain;
    filter: ${(p) => (p.$active ? "none" : "grayscale(0.55) brightness(0.85)")};
  }

  &:hover img {
    filter: none;
  }
`;

const StampHint = styled.span`
  position: absolute;
  right: 4px;
  bottom: 3px;
  font-size: 0.42rem;
  font-weight: ${FONT_WEIGHT.bold};
  letter-spacing: 0.06em;
  color: ${(p) => (p.$active ? p.$color : "rgba(245, 236, 217, 0.35)")};
`;

const StackCard = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 168px;
  height: 48px;
  padding: 0 8px 0 6px;
  border: 1px solid
    ${(p) => (p.$active ? p.$color : "rgba(245, 236, 217, 0.1)")};
  background: ${(p) =>
    p.$active ? `${p.$color}1f` : "rgba(255, 255, 255, 0.03)"};
`;

const StackIcon = styled.img`
  width: 28px;
  height: 28px;
  object-fit: contain;
  filter: ${(p) => (p.$active ? "none" : "grayscale(0.55) brightness(0.85)")};
`;

const StackName = styled.span`
  flex: 1;
  font-size: 0.58rem;
  font-weight: ${FONT_WEIGHT.semibold};
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${(p) => (p.$active ? "#fff" : "rgba(245, 236, 217, 0.55)")};
`;

const Stepper = styled.div`
  display: flex;
  align-items: center;
  gap: 3px;
`;

const StepBtn = styled.button`
  width: 22px;
  height: 24px;
  padding: 0;
  border: 1px solid
    ${(p) => (p.disabled ? "transparent" : "rgba(245, 236, 217, 0.16)")};
  background: rgba(255, 255, 255, 0.04);
  color: ${(p) =>
    p.disabled ? "rgba(245, 236, 217, 0.18)" : "rgba(245, 236, 217, 0.78)"};
  font-family: ${FONT_UI};
  font-size: 0.78rem;
  line-height: 1;
  cursor: ${(p) => (p.disabled ? "default" : "pointer")};
  ${FONT_RENDER}

  &:hover {
    color: ${(p) => (p.disabled ? "rgba(245, 236, 217, 0.18)" : "#fff")};
  }
`;

const StackCount = styled.span`
  min-width: 16px;
  text-align: center;
  font-size: 0.78rem;
  font-weight: ${FONT_WEIGHT.bold};
  color: ${(p) => (p.$active ? "#fff" : "rgba(245, 236, 217, 0.45)")};
`;

function kitViewShape(value) {
  return {
    active: value?.active ?? null,
    stacks: {
      speed: value?.stacks?.speed || 0,
      power: value?.stacks?.power || 0,
    },
    techs: {
      flap: !!value?.techs?.flap,
      shattering_palm: !!value?.techs?.shattering_palm,
      thick_blubber: !!value?.techs?.thick_blubber,
    },
  };
}

export function applyTrainingKitView(view, op, type) {
  const next = kitViewShape(view);
  if (op === "clear") return { ...EMPTY_TRAINING_KIT };
  if (op === "toggle_active") {
    next.active = next.active === type ? null : type;
    return next;
  }
  if (op === "add_stack" && Object.prototype.hasOwnProperty.call(next.stacks, type)) {
    next.stacks[type] = Math.min(TRAINING_STACK_CAP, next.stacks[type] + 1);
    return next;
  }
  if (op === "remove_stack" && Object.prototype.hasOwnProperty.call(next.stacks, type)) {
    next.stacks[type] = Math.max(0, next.stacks[type] - 1);
    return next;
  }
  if (op === "toggle_tech" && Object.prototype.hasOwnProperty.call(next.techs, type)) {
    next.techs[type] = !next.techs[type];
    return next;
  }
  return next;
}

const TrainingKitSection = ({ kits, target, onTarget, onChange }) => {
  const kit = kitViewShape(kits?.[target] || EMPTY_TRAINING_KIT);
  const [hint, setHint] = useState(
    target === "cpu" ? "CPU fighter" : "Your fighter"
  );

  const emit = (op, type) => {
    playButtonPressSound2();
    onChange(op, type);
  };

  return (
    <Root>
      <Head>
        <Title>Kit</Title>
        <TargetSwitch>
          <TargetBtn
            type="button"
            $active={target === "human"}
            $color={C.gold}
            onMouseEnter={() => {
              playButtonHoverSound();
              setHint("Your fighter");
            }}
            onClick={() => {
              onTarget("human");
              setHint("Your fighter");
            }}
          >
            You
          </TargetBtn>
          <TargetBtn
            type="button"
            $active={target === "cpu"}
            $color="#6f8cff"
            onMouseEnter={() => {
              playButtonHoverSound();
              setHint("CPU fighter");
            }}
            onClick={() => {
              onTarget("cpu");
              setHint("CPU fighter");
            }}
          >
            CPU
          </TargetBtn>
        </TargetSwitch>
        <Hint>{hint}</Hint>
        <GhostBtn
          type="button"
          onMouseEnter={() => {
            playButtonHoverSound();
            setHint("Strip this fighter");
          }}
          onClick={() => emit("clear")}
        >
          Clear
        </GhostBtn>
      </Head>

      <div>
        <GroupLabel>F key</GroupLabel>
        <Row>
          {ACTIVES.map((item) => {
            const color = getPowerUpTypeColor(item.id);
            const active = kit.active === item.id;
            return (
              <Stamp
                key={item.id}
                type="button"
                title={getPowerUpLabel(item.id)}
                $active={active}
                $color={color.main}
                $glow={color.glow}
                onMouseEnter={() => {
                  playButtonHoverSound();
                  setHint(`${getPowerUpLabel(item.id)} · F`);
                }}
                onClick={() => emit("toggle_active", item.id)}
              >
                <img src={getPowerUpIcon(item.id)} alt="" />
                <StampHint $active={active} $color={color.main}>
                  {item.hint}
                </StampHint>
              </Stamp>
            );
          })}
        </Row>
      </div>

      <div>
        <GroupLabel>Stacks</GroupLabel>
        <Row>
          {STACKS.map((item) => {
            const color = getPowerUpTypeColor(item.id);
            const count = kit.stacks[item.id] || 0;
            const active = count > 0;
            return (
              <StackCard
                key={item.id}
                $active={active}
                $color={color.main}
                title={getPowerUpLabel(item.id)}
                onMouseEnter={() => setHint(getPowerUpLabel(item.id))}
              >
                <StackIcon
                  src={getPowerUpIcon(item.id)}
                  alt=""
                  $active={active}
                />
                <StackName $active={active}>
                  {getPowerUpLabel(item.id)}
                </StackName>
                <Stepper>
                  <StepBtn
                    type="button"
                    disabled={count <= 0}
                    onMouseEnter={playButtonHoverSound}
                    onClick={() => emit("remove_stack", item.id)}
                  >
                    −
                  </StepBtn>
                  <StackCount $active={active}>{count}</StackCount>
                  <StepBtn
                    type="button"
                    disabled={count >= TRAINING_STACK_CAP}
                    onMouseEnter={playButtonHoverSound}
                    onClick={() => emit("add_stack", item.id)}
                  >
                    +
                  </StepBtn>
                </Stepper>
              </StackCard>
            );
          })}
        </Row>
      </div>

      <div>
        <GroupLabel>Arts</GroupLabel>
        <Row>
          {TECHS.map((item) => {
            const color = getPowerUpTypeColor(item.icon);
            const active = !!kit.techs[item.id];
            return (
              <Stamp
                key={item.id}
                type="button"
                title={getPowerUpLabel(item.icon)}
                $active={active}
                $color={color.main}
                $glow={color.glow}
                onMouseEnter={() => {
                  playButtonHoverSound();
                  setHint(getPowerUpLabel(item.icon));
                }}
                onClick={() => emit("toggle_tech", item.id)}
              >
                <img src={getPowerUpIcon(item.icon)} alt="" />
              </Stamp>
            );
          })}
        </Row>
      </div>
    </Root>
  );
};

TrainingKitSection.propTypes = {
  kits: PropTypes.shape({
    human: PropTypes.object,
    cpu: PropTypes.object,
  }).isRequired,
  target: PropTypes.oneOf(["human", "cpu"]).isRequired,
  onTarget: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
};

export default TrainingKitSection;
