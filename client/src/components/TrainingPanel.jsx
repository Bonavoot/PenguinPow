import { useCallback, useEffect, useLayoutEffect, useState } from "react";
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
import TrainingKitSection from "./TrainingKitTray";

export const TRAINING_BEHAVIOR_OPTIONS = [
  { id: "standby", label: "Standby", group: "dummy" },
  { id: "slap", label: "Slap Attack", group: "dummy" },
  { id: "palm", label: "Palm Thrust", group: "dummy" },
  { id: "grab", label: "Grab", group: "dummy" },
  { id: "EASY", label: "Easy", group: "ai" },
  { id: "NORMAL", label: "Medium", group: "ai" },
  { id: "IMPOSSIBLE", label: "Brutal", group: "ai" },
];

const Scrim = styled.div`
  position: absolute;
  inset: 0;
  z-index: 239;
  background: rgba(6, 8, 12, 0.46);
  pointer-events: auto;
`;

const Sheet = styled.div`
  position: absolute;
  top: 18px;
  left: 18px;
  z-index: 240;
  display: flex;
  flex-direction: column;
  width: min(680px, calc(100% - 36px));
  max-height: calc(100% - 36px);
  padding: 16px 16px 12px;
  background: ${C.inkPanelStrong};
  border: 1px solid rgba(245, 236, 217, 0.16);
  pointer-events: auto;
  overflow: auto;
  font-family: ${FONT_BODY};
  ${FONT_RENDER}
`;

const Header = styled.div`
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 14px;
`;

const Title = styled.div`
  font-family: ${FONT_UI};
  font-size: 0.72rem;
  font-weight: ${FONT_WEIGHT.semibold};
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(245, 236, 217, 0.7);
  text-shadow: ${TEXT_SHADOW_DISPLAY_SOFT};
`;

const HeaderHint = styled.div`
  flex: 1;
  font-size: 0.5rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(245, 236, 217, 0.3);
`;

const HeaderBtn = styled.button`
  padding: 3px 8px;
  border: 1px solid rgba(245, 236, 217, 0.16);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(245, 236, 217, 0.62);
  font-family: ${FONT_UI};
  font-size: 0.56rem;
  font-weight: ${FONT_WEIGHT.semibold};
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  ${FONT_RENDER}

  &:hover {
    color: #fff;
    border-color: rgba(245, 236, 217, 0.35);
  }
`;

const Columns = styled.div`
  display: grid;
  grid-template-columns: minmax(200px, 0.9fr) minmax(280px, 1.2fr);
  gap: 18px 22px;
  align-items: start;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const Col = styled.div`
  min-width: 0;
`;

const GroupLabel = styled.div`
  font-family: ${FONT_UI};
  font-size: 0.5rem;
  font-weight: ${FONT_WEIGHT.medium};
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(245, 236, 217, 0.32);
  margin: 10px 0 5px;

  &:first-child {
    margin-top: 0;
  }
`;

const ChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`;

const Chip = styled.button`
  padding: 6px 10px;
  border: 1px solid
    ${(p) => (p.$active ? "rgba(232, 90, 74, 0.7)" : "transparent")};
  background: ${(p) =>
    p.$active ? "rgba(232, 90, 74, 0.22)" : "rgba(255, 255, 255, 0.03)"};
  color: ${(p) =>
    p.$active ? C.vermillionBright || "#ff6d5c" : "rgba(255, 255, 255, 0.82)"};
  font-family: ${FONT_UI};
  font-size: 0.66rem;
  font-weight: ${FONT_WEIGHT.semibold};
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  ${FONT_RENDER}

  &:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.08);
  }
`;

const Footer = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid rgba(245, 236, 217, 0.1);
`;

const FooterBtn = styled(Chip)`
  border-color: ${(p) =>
    p.$active ? "rgba(232, 90, 74, 0.7)" : "rgba(245, 236, 217, 0.14)"};
`;

const ExitButton = styled(FooterBtn)`
  margin-left: auto;
  color: rgba(245, 236, 217, 0.58);
  font-weight: ${FONT_WEIGHT.medium};
  letter-spacing: 0.14em;

  &:hover {
    color: #fff;
    border-color: rgba(245, 236, 217, 0.35);
  }
`;

const FootHint = styled.div`
  width: 100%;
  margin-top: 4px;
  font-size: 0.48rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(245, 236, 217, 0.28);
`;

const ClosedTab = styled.button`
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 240;
  padding: 6px 10px;
  background: ${C.inkPanelStrong};
  border: 1px solid rgba(245, 236, 217, 0.16);
  color: rgba(245, 236, 217, 0.55);
  font-family: ${FONT_UI};
  font-size: 0.52rem;
  font-weight: ${FONT_WEIGHT.semibold};
  letter-spacing: 0.16em;
  text-transform: uppercase;
  cursor: pointer;
  pointer-events: auto;
  ${FONT_RENDER}

  &:hover {
    color: #fff;
  }
`;

const TrainingPanel = ({
  behavior,
  infiniteResources,
  onSelect,
  onToggleResources,
  onReset,
  onExit,
  kits,
  kitTarget,
  onKitTarget,
  onKitChange,
}) => {
  const [open, setOpen] = useState(true);

  const toggleOpen = useCallback((next) => {
    setOpen((prev) => (typeof next === "boolean" ? next : !prev));
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      releaseCursor("training");
      return undefined;
    }
    releaseCursor("training-tab");
    acquireCursor("training");
    return () => releaseCursor("training");
  }, [open]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return;
      toggleOpen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleOpen]);

  const pick = (id) => {
    playButtonPressSound2();
    onSelect(id);
  };

  if (!open) {
    return (
      <ClosedTab
        type="button"
        data-training-ui
        onMouseDown={(e) => e.stopPropagation()}
        onMouseEnter={() => {
          acquireCursor("training-tab");
          playButtonHoverSound();
        }}
        onMouseLeave={() => releaseCursor("training-tab")}
        onClick={() => {
          releaseCursor("training-tab");
          playButtonPressSound2();
          toggleOpen(true);
        }}
      >
        Lab · Esc
      </ClosedTab>
    );
  }

  return (
    <>
      <Scrim
        data-training-ui
        onMouseDown={(e) => {
          e.stopPropagation();
          toggleOpen(false);
        }}
      />
      <Sheet data-training-ui onMouseDown={(e) => e.stopPropagation()}>
        <Header>
          <Title>Training</Title>
          <HeaderHint>CPU · kit · lab</HeaderHint>
          <HeaderBtn
            type="button"
            onMouseEnter={playButtonHoverSound}
            onClick={() => {
              playButtonPressSound2();
              toggleOpen(false);
            }}
          >
            Hide
          </HeaderBtn>
        </Header>

        <Columns>
          <Col>
            <GroupLabel>Dummy</GroupLabel>
            <ChipRow>
              {TRAINING_BEHAVIOR_OPTIONS.filter((o) => o.group === "dummy").map(
                (opt) => (
                  <Chip
                    key={opt.id}
                    type="button"
                    $active={behavior === opt.id}
                    onMouseEnter={playButtonHoverSound}
                    onClick={() => pick(opt.id)}
                  >
                    {opt.label}
                  </Chip>
                )
              )}
            </ChipRow>
            <GroupLabel>AI</GroupLabel>
            <ChipRow>
              {TRAINING_BEHAVIOR_OPTIONS.filter((o) => o.group === "ai").map(
                (opt) => (
                  <Chip
                    key={opt.id}
                    type="button"
                    $active={behavior === opt.id}
                    onMouseEnter={playButtonHoverSound}
                    onClick={() => pick(opt.id)}
                  >
                    {opt.label}
                  </Chip>
                )
              )}
            </ChipRow>
          </Col>
          <Col>
            <TrainingKitSection
              kits={kits}
              target={kitTarget}
              onTarget={onKitTarget}
              onChange={onKitChange}
            />
          </Col>
        </Columns>

        <Footer>
          <FooterBtn
            type="button"
            $active={infiniteResources}
            onMouseEnter={playButtonHoverSound}
            onClick={() => {
              playButtonPressSound2();
              onToggleResources(!infiniteResources);
            }}
          >
            Infinite {infiniteResources ? "On" : "Off"}
          </FooterBtn>
          <FooterBtn
            type="button"
            onMouseEnter={playButtonHoverSound}
            onClick={() => {
              playButtonPressSound2();
              onReset();
            }}
          >
            Reset
          </FooterBtn>
          <ExitButton
            type="button"
            onMouseEnter={playButtonHoverSound}
            onClick={onExit}
          >
            Exit
          </ExitButton>
          <FootHint>Esc hide · E reset</FootHint>
        </Footer>
      </Sheet>
    </>
  );
};

TrainingPanel.propTypes = {
  behavior: PropTypes.string.isRequired,
  infiniteResources: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
  onToggleResources: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
  onExit: PropTypes.func.isRequired,
  kits: PropTypes.object.isRequired,
  kitTarget: PropTypes.oneOf(["human", "cpu"]).isRequired,
  onKitTarget: PropTypes.func.isRequired,
  onKitChange: PropTypes.func.isRequired,
};

export default TrainingPanel;
