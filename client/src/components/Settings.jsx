import { useState, useEffect } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";
import { C, FONT_DISPLAY, FONT_BODY } from "./menuTheme";
import { usePlayerColors } from "../context/PlayerColorContext";
import {
  getPersistentCacheCount,
  clearPersistentCache,
  isPersistentCacheAvailable,
} from "../utils/SpriteRecolorizer";

// Global volume state preserved across mounts so audio code outside this
// component (see getGlobalVolume below) can read the user's last setting.
let globalVolume = 1.0;

// ─────────────────────────────────────────────────────────────────────
// SETTINGS — snow palette refresh.
//
// Previously this panel was a 90% opaque black plaque with red gradient
// CTAs and a backdrop blur, which clashed visually with the rest of the
// (now light) menu UI. Now matches the Rooms / CustomizePage chrome:
//   • flat white card, crisp solid border, short cool drop shadow
//   • dark slate sumi-ink text on the card
//   • vermillion CTA for the primary save action (sumo accent)
//   • secondary buttons are clean white plaques with snow borders
//
// We also add a real overlay backdrop here. The original mounted bare
// without one because of how MainMenu renders it; the new dim layer
// gives the modal proper visual separation from the menu.
// ─────────────────────────────────────────────────────────────────────

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const cardIn = keyframes`
  from {
    opacity: 0;
    transform: translate(-50%, calc(-50% + 8px));
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%);
  }
`;

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 29, 46, 0.55);
  z-index: 999;
  animation: ${fadeIn} 160ms ease-out both;
`;

const SettingsContainer = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  /*
   * Hybrid panel — sumi title band on top, snow body below for the
   * controls. Same banzuke pattern used everywhere else in the
   * menu suite. Padding is intentionally zero on the container so
   * the dark TitleBar can hug the rounded edges via overflow:hidden;
   * the SettingsBody owns the inner padding for the controls.
   */
  background: ${C.snowPanel};
  padding: 0;
  border-radius: 8px;
  border: 1px solid ${C.snowBorder};
  overflow: hidden;
  box-shadow: 0 18px 38px rgba(15, 29, 46, 0.28);
  z-index: 1000;
  width: 80%;
  max-width: 460px;
  max-height: 80cqh;
  overflow-y: auto;
  font-family: ${FONT_BODY};
  animation: ${cardIn} 220ms cubic-bezier(0.22, 0.61, 0.36, 1) both;

  &::-webkit-scrollbar {
    width: 8px;
  }
  &::-webkit-scrollbar-track {
    background: ${C.snowPanelDeep};
    border-radius: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: ${C.iceMid};
    border-radius: 4px;
  }
`;

const TitleBar = styled.div`
  background: ${C.sumi};
  border-bottom: 1px solid ${C.sumiBorder};
  padding: 1rem 1.75rem;
`;

const Title = styled.h2`
  color: ${C.cream};
  font-family: ${FONT_DISPLAY};
  margin: 0;
  text-align: center;
  font-size: 1.3rem;
  letter-spacing: 0.04em;
`;

const SettingsBody = styled.div`
  padding: 1.4rem 1.75rem;
`;

const ControlGroup = styled.div`
  margin-bottom: 1.25rem;
`;

const Label = styled.label`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  color: ${C.inkText};
  margin-bottom: 0.5rem;
  font-family: ${FONT_DISPLAY};
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

const Slider = styled.input`
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: ${C.snowPanelDeep};
  border: 1px solid ${C.snowBorder};
  border-radius: 4px;
  outline: none;
  margin: 0.25rem 0 0.4rem;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 18px;
    height: 18px;
    background: ${C.vermillion};
    border: 1px solid ${C.vermillionDeep};
    border-radius: 50%;
    cursor: pointer;
    transition: transform 0.15s ease, background 0.15s ease;

    &:hover {
      transform: scale(1.08);
      background: ${C.vermillionBright};
    }
  }

  &::-moz-range-thumb {
    width: 18px;
    height: 18px;
    background: ${C.vermillion};
    border: 1px solid ${C.vermillionDeep};
    border-radius: 50%;
    cursor: pointer;
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 0.55rem 0.7rem;
  border: 1px solid ${C.snowBorder};
  border-radius: 4px;
  background: ${C.snowSoft};
  color: ${C.inkText};
  font-family: ${FONT_BODY};
  font-size: 0.85rem;
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;

  option {
    background: ${C.snowPanel};
    color: ${C.inkText};
  }

  &:hover {
    background: ${C.snowPanel};
    border-color: ${C.iceMid};
  }

  &:focus {
    border-color: ${C.vermillion};
    background: ${C.snowPanel};
  }
`;

const Value = styled.span`
  color: ${C.inkTextMute};
  font-size: 0.78rem;
  font-family: ${FONT_DISPLAY};
  letter-spacing: 0.05em;
`;

const PrimaryButton = styled.button`
  background: ${C.vermillion};
  border: 1px solid ${C.vermillionDeep};
  border-radius: 6px;
  padding: 0.7rem 1.25rem;
  font-size: 0.85rem;
  color: ${C.snowSoft};
  font-family: ${FONT_DISPLAY};
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease;
  width: 100%;
  margin-top: 0.5rem;
  box-shadow: 0 2px 6px rgba(138, 31, 18, 0.25);

  &:hover {
    background: ${C.vermillionBright};
    box-shadow: 0 4px 10px rgba(138, 31, 18, 0.35);
  }

  &:active {
    transform: translateY(1px);
    box-shadow: 0 1px 3px rgba(138, 31, 18, 0.25);
  }

  &:disabled {
    opacity: 0.65;
    cursor: progress;
    box-shadow: none;
  }
`;

const SecondaryButton = styled.button`
  background: ${C.snowPanel};
  border: 1px solid ${C.snowBorder};
  border-radius: 6px;
  padding: 0.65rem 1.25rem;
  font-size: 0.8rem;
  color: ${C.inkTextSoft};
  font-family: ${FONT_DISPLAY};
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  width: 100%;
  margin-top: 0.5rem;

  &:hover {
    background: ${C.snowSoft};
    border-color: ${C.iceMid};
    color: ${C.inkText};
  }

  &:active {
    background: ${C.snowPanelDeep};
  }
`;

const ResolutionGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  margin-top: 0.5rem;
`;

const ResolutionButton = styled.button`
  background: ${(props) => (props.selected ? C.snowPanelDeep : C.snowPanel)};
  border: 1px solid ${(props) => (props.selected ? C.iceMid : C.snowBorder)};
  border-radius: 4px;
  padding: 0.55rem;
  font-size: 0.75rem;
  color: ${(props) => (props.selected ? C.iceDeep : C.inkTextSoft)};
  font-family: ${FONT_DISPLAY};
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;

  &:hover {
    background: ${(props) => (props.selected ? C.snowPanelDeep : C.snowSoft)};
    border-color: ${C.iceMid};
    color: ${C.inkText};
  }
`;

const Divider = styled.div`
  height: 1px;
  background: ${C.snowBorder};
  margin: 1.4rem 0 1.25rem;
`;

const SectionTitle = styled.div`
  color: ${C.inkText};
  font-family: ${FONT_DISPLAY};
  font-size: 0.82rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
`;

const SectionTag = styled.span`
  font-size: 0.6rem;
  letter-spacing: 0.06em;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  background: ${C.snowPanelDeep};
  border: 1px solid ${C.snowBorder};
  color: ${C.inkTextMute};
  text-transform: uppercase;
`;

const HintText = styled.p`
  color: ${C.inkTextMute};
  font-size: 0.74rem;
  line-height: 1.45;
  margin: 0 0 0.65rem;
`;

const StatusLine = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.74rem;
  font-family: ${FONT_DISPLAY};
  letter-spacing: 0.04em;
  color: ${({ $ok }) => ($ok ? C.iceDeep : C.inkTextMute)};
  margin-bottom: 0.5rem;
`;

const ProgressTrack = styled.div`
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: ${C.snowPanelDeep};
  border: 1px solid ${C.snowBorder};
  overflow: hidden;
  margin: 0.35rem 0 0.6rem;
`;

const ProgressFill = styled.div`
  height: 100%;
  width: ${({ $pct }) => $pct}%;
  background: ${C.vermillion};
  transition: width 0.18s ease;
`;

// Common resolution options 1920x1080 and above.
const resolutionOptions = [
  { width: 1920, height: 1080, label: "1920x1080" },
  { width: 2560, height: 1440, label: "2560x1440" },
  { width: 3440, height: 1440, label: "3440x1440" },
  { width: 3840, height: 2160, label: "3840x2160" },
  { width: 2560, height: 1600, label: "2560x1600" },
  { width: 3840, height: 1600, label: "3840x1600" },
];

const Settings = ({ onClose }) => {
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [volume, setVolume] = useState(100);
  const [displayMode, setDisplayMode] = useState("fullscreen");
  const [selectedResolution, setSelectedResolution] = useState({
    width: 1920,
    height: 1080,
  });
  const [availableResolutions, setAvailableResolutions] =
    useState(resolutionOptions);

  // ── Sprite Pack (persistent recolor cache) ──
  const { installAllColors } = usePlayerColors();
  const cacheAvailable = isPersistentCacheAvailable();
  const [installState, setInstallState] = useState("idle"); // idle | running | done
  const [installProgress, setInstallProgress] = useState({ done: 0, total: 0 });
  const [cacheCount, setCacheCount] = useState(0);

  useEffect(() => {
    let alive = true;
    getPersistentCacheCount().then((n) => {
      if (alive) setCacheCount(n);
    });
    return () => {
      alive = false;
    };
  }, []);

  const handleInstallSpritePack = async () => {
    if (installState === "running") return;
    setInstallState("running");
    setInstallProgress({ done: 0, total: 0 });
    try {
      await installAllColors((done, total) =>
        setInstallProgress({ done, total })
      );
      const n = await getPersistentCacheCount();
      setCacheCount(n);
      try {
        localStorage.setItem("spritePackInstalled", "1");
      } catch (_) {
        /* ignore */
      }
      setInstallState("done");
    } catch (error) {
      console.error("Sprite pack install failed:", error);
      setInstallState("idle");
    }
  };

  const handleClearSpritePack = async () => {
    if (installState === "running") return;
    await clearPersistentCache();
    try {
      localStorage.removeItem("spritePackInstalled");
    } catch (_) {
      /* ignore */
    }
    setCacheCount(0);
    setInstallState("idle");
    setInstallProgress({ done: 0, total: 0 });
  };

  const installPct =
    installProgress.total > 0
      ? Math.round((installProgress.done / installProgress.total) * 100)
      : 0;

  useEffect(() => {
    const loadSettings = async () => {
      if (window.electron && window.electron.settings) {
        try {
          const settings = await window.electron.settings.get();
          setBrightness(settings.brightness || 100);
          setContrast(settings.contrast || 100);
          setVolume(settings.volume || 100);
          setDisplayMode(settings.displayMode || "fullscreen");
          setSelectedResolution({
            width: settings.windowWidth || 1920,
            height: settings.windowHeight || 1080,
          });

          // Filter the resolution list to only show options that fit the
          // current display so users don't pick a resolution larger than
          // their monitor.
          const screenInfo = await window.electron.settings.getScreenInfo();
          const maxWidth = screenInfo.primaryDisplay.bounds.width;
          const maxHeight = screenInfo.primaryDisplay.bounds.height;
          const filteredResolutions = resolutionOptions.filter(
            (res) => res.width <= maxWidth && res.height <= maxHeight
          );
          setAvailableResolutions(filteredResolutions);
        } catch (error) {
          console.error("Error loading settings:", error);
        }
      }
    };

    loadSettings();
  }, []);

  useEffect(() => {
    const gameWindow = document.querySelector(".current-page");
    if (gameWindow) {
      gameWindow.style.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
    }
  }, [brightness, contrast]);

  useEffect(() => {
    globalVolume = volume / 100;
  }, [volume]);

  const handleDisplayModeChange = async (newMode) => {
    setDisplayMode(newMode);

    if (window.electron && window.electron.settings) {
      try {
        if (newMode === "windowed") {
          await window.electron.settings.setDisplayMode(
            newMode,
            selectedResolution.width,
            selectedResolution.height
          );
        } else {
          await window.electron.settings.setDisplayMode(newMode);
        }
      } catch (error) {
        console.error("Error setting display mode:", error);
      }
    }
  };

  const handleResolutionChange = async (resolution) => {
    setSelectedResolution(resolution);

    if (
      displayMode === "windowed" &&
      window.electron &&
      window.electron.settings
    ) {
      try {
        await window.electron.settings.setDisplayMode(
          "windowed",
          resolution.width,
          resolution.height
        );
      } catch (error) {
        console.error("Error setting resolution:", error);
      }
    }
  };

  const handleSaveSettings = async () => {
    if (window.electron && window.electron.settings) {
      try {
        await window.electron.settings.save({
          brightness,
          contrast,
          volume,
          displayMode,
          windowWidth: selectedResolution.width,
          windowHeight: selectedResolution.height,
        });
      } catch (error) {
        console.error("Error saving settings:", error);
      }
    }
  };

  const handleReset = async () => {
    setBrightness(100);
    setContrast(100);
    setVolume(100);
    setDisplayMode("fullscreen");
    setSelectedResolution({ width: 1920, height: 1080 });

    if (window.electron && window.electron.settings) {
      try {
        await window.electron.settings.setDisplayMode("fullscreen");
        await window.electron.settings.save({
          brightness: 100,
          contrast: 100,
          volume: 100,
          displayMode: "fullscreen",
          windowWidth: 1920,
          windowHeight: 1080,
        });
      } catch (error) {
        console.error("Error resetting settings:", error);
      }
    }
  };

  return (
    <>
      <Backdrop onClick={onClose} />
      <SettingsContainer className="settings-container">
        <TitleBar>
          <Title>Game Settings</Title>
        </TitleBar>
        <SettingsBody>
        <ControlGroup>
          <Label>Display Mode</Label>
          <Select
            value={displayMode}
            onChange={(e) => handleDisplayModeChange(e.target.value)}
          >
            <option value="fullscreen">Fullscreen</option>
            <option value="maximized">Maximized Window</option>
            <option value="windowed">Windowed</option>
          </Select>
        </ControlGroup>

        {displayMode === "windowed" && (
          <ControlGroup>
            <Label>Resolution</Label>
            <ResolutionGrid>
              {availableResolutions.map((resolution) => (
                <ResolutionButton
                  key={`${resolution.width}x${resolution.height}`}
                  selected={
                    selectedResolution.width === resolution.width &&
                    selectedResolution.height === resolution.height
                  }
                  onClick={() => handleResolutionChange(resolution)}
                >
                  {resolution.label}
                </ResolutionButton>
              ))}
            </ResolutionGrid>
          </ControlGroup>
        )}

        <ControlGroup>
          <Label>
            Brightness <Value>{brightness}%</Value>
          </Label>
          <Slider
            type="range"
            min="50"
            max="150"
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
          />
        </ControlGroup>

        <ControlGroup>
          <Label>
            Contrast <Value>{contrast}%</Value>
          </Label>
          <Slider
            type="range"
            min="50"
            max="150"
            value={contrast}
            onChange={(e) => setContrast(Number(e.target.value))}
          />
        </ControlGroup>

        <ControlGroup>
          <Label>
            Volume <Value>{volume}%</Value>
          </Label>
          <Slider
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
          />
        </ControlGroup>

        <Divider />

        <ControlGroup>
          <SectionTitle>
            Sprite Pack <SectionTag>Pre-launch</SectionTag>
          </SectionTitle>
          {cacheAvailable ? (
            <>
              <HintText>
                Pre-loads every fighter color the game uses (all belt &amp; body
                presets, plus every basho rival and boss) and saves them to this
                browser. Run it once and matches stop pausing to &ldquo;download&rdquo;
                colors &mdash; even after a refresh.
              </HintText>
              <StatusLine $ok={cacheCount > 0}>
                <span>
                  {installState === "running"
                    ? `Installing… ${installProgress.done}/${installProgress.total} color sets`
                    : cacheCount > 0
                    ? `Installed · ${cacheCount} sprites cached`
                    : "Not installed"}
                </span>
                {installState === "done" && <span>Done ✓</span>}
              </StatusLine>
              {installState === "running" && (
                <ProgressTrack>
                  <ProgressFill $pct={installPct} />
                </ProgressTrack>
              )}
              <PrimaryButton
                onClick={handleInstallSpritePack}
                disabled={installState === "running"}
              >
                {installState === "running"
                  ? `Installing… ${installPct}%`
                  : cacheCount > 0
                  ? "Re-install Sprite Pack"
                  : "Install Sprite Pack"}
              </PrimaryButton>
              {cacheCount > 0 && installState !== "running" && (
                <SecondaryButton onClick={handleClearSpritePack}>
                  Clear Cached Sprites
                </SecondaryButton>
              )}
            </>
          ) : (
            <HintText>
              Persistent sprite caching isn&apos;t available in this browser
              (no IndexedDB), so colors are recomputed each session.
            </HintText>
          )}
        </ControlGroup>

        <Divider />

        <PrimaryButton onClick={handleSaveSettings}>Save Settings</PrimaryButton>
        <SecondaryButton onClick={handleReset}>Reset to Default</SecondaryButton>
        <SecondaryButton onClick={onClose}>Close</SecondaryButton>
        </SettingsBody>
      </SettingsContainer>
    </>
  );
};

Settings.propTypes = {
  onClose: PropTypes.func.isRequired,
};

const BASE_VOLUME_MULTIPLIER = 2.5;

export const getGlobalVolume = () => globalVolume * BASE_VOLUME_MULTIPLIER;

export default Settings;
