import { useEffect, useLayoutEffect } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import {
  C,
  FONT_BODY,
  FONT_UI,
  FONT_WEIGHT,
  FONT_RENDER,
  TEXT_SHADOW_DISPLAY_SOFT,
} from "./menuTheme";
import { acquireCursor, releaseCursor } from "../ui/cursorGate";
import { playButtonHoverSound, playButtonPressSound2 } from "../utils/soundUtils";

export const TRAINING_BEHAVIOR_OPTIONS = [
  { id: "standby", label: "Standby", group: "dummy" },
  { id: "slap", label: "Slap Attack", group: "dummy" },
  { id: "palm", label: "Palm Thrust", group: "dummy" },
  { id: "grab", label: "Grab", group: "dummy" },
  { id: "EASY", label: "Easy", group: "ai" },
  { id: "NORMAL", label: "Medium", group: "ai" },
  { id: "IMPOSSIBLE", label: "Brutal", group: "ai" },
];

const Panel = styled.div`
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 240;
  width: 168px;
  padding: 10px 10px 8px;
  background: ${C.inkPanelStrong};
  border: 1px solid rgba(245, 236, 217, 0.16);
  pointer-events: auto;
  font-family: ${FONT_BODY};
  ${FONT_RENDER}
`;

const Title = styled.div`
  font-family: ${FONT_UI};
  font-size: 0.58rem;
  font-weight: ${FONT_WEIGHT.semibold};
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(245, 236, 217, 0.55);
  text-shadow: ${TEXT_SHADOW_DISPLAY_SOFT};
  margin-bottom: 8px;
`;

const GroupLabel = styled.div`
  font-family: ${FONT_UI};
  font-size: 0.5rem;
  font-weight: ${FONT_WEIGHT.medium};
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(245, 236, 217, 0.32);
  margin: 8px 0 4px;
`;

const Option = styled.button`
  display: block;
  width: 100%;
  margin: 0 0 3px;
  padding: 5px 8px;
  border: 1px solid
    ${(p) => (p.$active ? "rgba(232, 90, 74, 0.7)" : "transparent")};
  background: ${(p) =>
    p.$active ? "rgba(232, 90, 74, 0.22)" : "rgba(255, 255, 255, 0.03)"};
  color: ${(p) =>
    p.$active ? C.vermillionBright || "#ff6d5c" : "rgba(255, 255, 255, 0.82)"};
  font-family: ${FONT_UI};
  font-size: 0.68rem;
  font-weight: ${FONT_WEIGHT.semibold};
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-align: left;
  cursor: pointer;
  ${FONT_RENDER}

  &:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.08);
  }
`;

const ExitButton = styled(Option)`
  margin-top: 10px;
  border-color: rgba(245, 236, 217, 0.14);
  color: rgba(245, 236, 217, 0.55);
  font-weight: ${FONT_WEIGHT.medium};
  letter-spacing: 0.14em;

  &:hover {
    color: #fff;
    border-color: rgba(245, 236, 217, 0.35);
  }
`;

const Hint = styled.div`
  margin-top: 6px;
  font-size: 0.48rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(245, 236, 217, 0.28);
`;

const TrainingPanel = ({
  behavior,
  infiniteResources,
  onSelect,
  onToggleResources,
  onReset,
  onExit,
}) => {
  useLayoutEffect(() => {
    acquireCursor("training");
    return () => releaseCursor("training");
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onExit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  const pick = (id) => {
    playButtonPressSound2();
    onSelect(id);
  };

  return (
    <Panel data-training-ui onMouseDown={(e) => e.stopPropagation()}>
      <Title>CPU Lab</Title>
      <GroupLabel>Dummy</GroupLabel>
      {TRAINING_BEHAVIOR_OPTIONS.filter((o) => o.group === "dummy").map(
        (opt) => (
          <Option
            key={opt.id}
            type="button"
            $active={behavior === opt.id}
            onMouseEnter={playButtonHoverSound}
            onClick={() => pick(opt.id)}
          >
            {opt.label}
          </Option>
        )
      )}
      <GroupLabel>AI</GroupLabel>
      {TRAINING_BEHAVIOR_OPTIONS.filter((o) => o.group === "ai").map((opt) => (
        <Option
          key={opt.id}
          type="button"
          $active={behavior === opt.id}
          onMouseEnter={playButtonHoverSound}
          onClick={() => pick(opt.id)}
        >
          {opt.label}
        </Option>
      ))}
      <GroupLabel>Lab</GroupLabel>
      <Option
        type="button"
        $active={infiniteResources}
        onMouseEnter={playButtonHoverSound}
        onClick={() => {
          playButtonPressSound2();
          onToggleResources(!infiniteResources);
        }}
      >
        Infinite {infiniteResources ? "On" : "Off"}
      </Option>
      <Option
        type="button"
        onMouseEnter={playButtonHoverSound}
        onClick={() => {
          playButtonPressSound2();
          onReset();
        }}
      >
        Reset
      </Option>
      <ExitButton type="button" onClick={onExit} onMouseEnter={playButtonHoverSound}>
        Exit
      </ExitButton>
      <Hint>E reset · Esc leave</Hint>
    </Panel>
  );
};

TrainingPanel.propTypes = {
  behavior: PropTypes.string.isRequired,
  infiniteResources: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
  onToggleResources: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
  onExit: PropTypes.func.isRequired,
};

export default TrainingPanel;
