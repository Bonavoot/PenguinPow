/**
 * Dev tool: step through every hat-using pose, nudge attach + rotation
 * until it looks right. Scale is locked per gear (widthPct).
 *
 * Top Hat is the default; switch gear (Crown, Halo, …) to tune each pose
 * independently. Tweaks persist in localStorage while you work.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";

import hatTweaksSeed from "../assets/cosmetics/hat-tweaks.json";
import topHatSrc from "../assets/cosmetics/top-hat.png";
import topHatMeta from "../assets/cosmetics/top-hat.json";
import crownSrc from "../assets/cosmetics/crown.png";
import crownMeta from "../assets/cosmetics/crown.json";
import haloSrc from "../assets/cosmetics/halo.png";
import haloMeta from "../assets/cosmetics/halo.json";
import plungerSrc from "../assets/cosmetics/plunger.png";
import plungerMeta from "../assets/cosmetics/plunger.json";

import pumoIdle from "../assets/pumo-idle.png";
import mainMenuPumo from "../assets/main-menu-pumo.png";
import pumoTachiai from "../assets/pumo-tachiai-position.png";
import pumoReady from "../assets/pumo-ready-position.png";
import grabbing from "../assets/grabbing.png";
import clinchPlanting from "../assets/clinch-planting.png";
import attemptingGrabThrow from "../assets/attempting-grab-throw.png";
import attemptingPull from "../assets/is-attempting-pull.png";
import slapAttack1 from "../assets/slapAttack1.png";
import slapAttack2 from "../assets/slapAttack2.png";
import slapAttack1Blur from "../assets/slap-attack-1-blur-frame.png";
import slapAttack1Hit from "../assets/slap-attack-1-hit-frame.png";
import slapAttack2Blur from "../assets/slap-attack-2-blur-frame.png";
import slapAttack2Hit from "../assets/slap-attack-2-hit-frame.png";
import palmThrust from "../assets/palm-thrust.png";
import palmThrustStartup from "../assets/palm-thrust-startup.png";
import palmThrustSmear from "../assets/palm-thrust-smear.png";
import blocking from "../assets/blocking.png";
import blockParry from "../assets/block-parry.png";
import rawParrySuccessFrame1 from "../assets/raw-parry-success-frame-1.png";
import rawParrySuccessFrame2 from "../assets/raw-parry-success-frame-2.png";
import rawParrySuccessFrame3 from "../assets/raw-parry-success-frame-3.png";
import flap1 from "../assets/pumo-flap-1.png";
import flap2 from "../assets/pumo-flap-2.png";
import recovering from "../assets/recovering.png";
import charging from "../assets/charging.png";
import attack from "../assets/attack.png";
import dodging from "../assets/dodging.png";
import sliding from "../assets/sliding.png";

import { getBaldBodySrc } from "../config/baldSprites";

/** Prefer bald body when present — hat attach points must match in-game. */
function bodyForStem(stem, hairedSrc) {
  return getBaldBodySrc(stem) || getBaldBodySrc(hairedSrc) || hairedSrc;
}

const STORAGE_KEY = "penguipow-hat-tweaks-v2";
const VIEW_ZOOM_MIN = 0.15;
const VIEW_ZOOM_MAX = 2;
const VIEW_ZOOM_STEP = 0.1;

function clampViewZoom(z) {
  return Math.min(VIEW_ZOOM_MAX, Math.max(VIEW_ZOOM_MIN, +z.toFixed(2)));
}

const GEAR_ASSETS = {
  top_hat: {
    id: "top_hat",
    label: "Top Hat",
    src: topHatSrc,
    meta: topHatMeta,
    prefix: "hat",
  },
  crown: {
    id: "crown",
    label: "Crown",
    src: crownSrc,
    meta: crownMeta,
    prefix: "crown",
  },
  halo: {
    id: "halo",
    label: "Halo",
    src: haloSrc,
    meta: haloMeta,
    prefix: "halo",
  },
  plunger: {
    id: "plunger",
    label: "Plunger",
    src: plungerSrc,
    meta: plungerMeta,
    prefix: "plunger",
  },
};

const BODY_BY_STEM = {
  "pumo-idle": bodyForStem("pumo-idle", pumoIdle),
  "main-menu-pumo": bodyForStem("main-menu-pumo", mainMenuPumo),
  "pumo-tachiai-position": bodyForStem("pumo-tachiai-position", pumoTachiai),
  "pumo-ready-position": bodyForStem("pumo-ready-position", pumoReady),
  grabbing: bodyForStem("grabbing", grabbing),
  "clinch-planting": bodyForStem("clinch-planting", clinchPlanting),
  "attempting-grab-throw": bodyForStem(
    "attempting-grab-throw",
    attemptingGrabThrow,
  ),
  "is-attempting-pull": bodyForStem("is-attempting-pull", attemptingPull),
  slapAttack1: bodyForStem("slapAttack1", slapAttack1),
  slapAttack2: bodyForStem("slapAttack2", slapAttack2),
  "slap-attack-1-blur-frame": bodyForStem(
    "slap-attack-1-blur-frame",
    slapAttack1Blur,
  ),
  "slap-attack-1-hit-frame": bodyForStem(
    "slap-attack-1-hit-frame",
    slapAttack1Hit,
  ),
  "slap-attack-2-blur-frame": bodyForStem(
    "slap-attack-2-blur-frame",
    slapAttack2Blur,
  ),
  "slap-attack-2-hit-frame": bodyForStem(
    "slap-attack-2-hit-frame",
    slapAttack2Hit,
  ),
  "palm-thrust": bodyForStem("palm-thrust", palmThrust),
  "palm-thrust-startup": bodyForStem("palm-thrust-startup", palmThrustStartup),
  "palm-thrust-smear": bodyForStem("palm-thrust-smear", palmThrustSmear),
  blocking: bodyForStem("blocking", blocking),
  "block-parry": bodyForStem("block-parry", blockParry),
  "raw-parry-success-frame-1": bodyForStem(
    "raw-parry-success-frame-1",
    rawParrySuccessFrame1,
  ),
  "raw-parry-success-frame-2": bodyForStem(
    "raw-parry-success-frame-2",
    rawParrySuccessFrame2,
  ),
  "raw-parry-success-frame-3": bodyForStem(
    "raw-parry-success-frame-3",
    rawParrySuccessFrame3,
  ),
  "pumo-flap-1": bodyForStem("pumo-flap-1", flap1),
  "pumo-flap-2": bodyForStem("pumo-flap-2", flap2),
  recovering: bodyForStem("recovering", recovering),
  charging: bodyForStem("charging", charging),
  attack: bodyForStem("attack", attack),
  dodging: bodyForStem("dodging", dodging),
  sliding: bodyForStem("sliding", sliding),
};

/** Keep pose edits from localStorage, but always take widthPct from the seed file.
 *  Also merge in any new gears / poses that exist in the seed but not yet in storage.
 */
function syncFromSeed(tweaks) {
  if (!tweaks?.gears || !hatTweaksSeed?.gears) return tweaks;
  for (const [id, seedGear] of Object.entries(hatTweaksSeed.gears)) {
    if (!tweaks.gears[id]) {
      tweaks.gears[id] = structuredClone(seedGear);
      continue;
    }
    if (seedGear.widthPct != null) tweaks.gears[id].widthPct = seedGear.widthPct;
    // Pull in newly-added pose stems (e.g. raw-parry-success-frame-1/2) without
    // wiping user-tuned attach points on existing poses.
    if (seedGear.poses) {
      const localPoses = tweaks.gears[id].poses || (tweaks.gears[id].poses = {});
      for (const [stem, seedPose] of Object.entries(seedGear.poses)) {
        if (!localPoses[stem]) localPoses[stem] = structuredClone(seedPose);
      }
    }
  }
  return tweaks;
}

function normalizeTweaks(raw) {
  if (raw?.version === 2 && raw?.gears) return syncFromSeed(raw);
  // Migrate legacy v1 { global, poses } → top_hat only; seed other gears from file.
  if (raw?.poses) {
    const seed = structuredClone(hatTweaksSeed);
    if (seed.gears?.top_hat) {
      seed.gears.top_hat.poses = raw.poses;
    }
    return seed;
  }
  return structuredClone(hatTweaksSeed);
}

function loadInitialTweaks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeTweaks(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return structuredClone(hatTweaksSeed);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

/** Draw gear with pivot at (x,y). Scale locked via widthPct + gear meta. */
function drawGear(ctx, hatImg, gearMeta, { x, y, rotationDeg, canvasW, widthPct }) {
  const scale = (canvasW * widthPct) / gearMeta.width;
  const hatW = gearMeta.width * scale;
  const hatH = gearMeta.height * scale;
  const pivotX = gearMeta.pivot.x * scale;
  const pivotY = gearMeta.pivot.y * scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rotationDeg * Math.PI) / 180);
  ctx.drawImage(hatImg, -pivotX, -pivotY, hatW, hatH);
  ctx.restore();
}

async function renderOverlayPng(hatImg, gearMeta, pose, widthPct, canvasW, canvasH) {
  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d");
  drawGear(ctx, hatImg, gearMeta, {
    x: pose.x,
    y: pose.y,
    rotationDeg: pose.rotationDeg,
    canvasW,
    widthPct,
  });
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const HatTuner = ({ onBack }) => {
  const [tweaks, setTweaks] = useState(loadInitialTweaks);
  const [gearId, setGearId] = useState("top_hat");
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(5);
  const [showCrosshair, setShowCrosshair] = useState(true);
  /** Display-only mirror — does not change attach points or bake output. */
  const [previewFlip, setPreviewFlip] = useState(false);
  const [viewZoom, setViewZoom] = useState(0.45);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const [status, setStatus] = useState("");
  const canvasRef = useRef(null);
  const canvasWrapRef = useRef(null);
  const bodyCache = useRef(new Map());
  const hatImgCache = useRef(new Map());

  const gearAsset = GEAR_ASSETS[gearId] || GEAR_ASSETS.top_hat;
  const gearTweaks = tweaks.gears?.[gearId] || tweaks.gears?.top_hat;
  const poses = gearTweaks?.poses || {};
  const stems = useMemo(() => Object.keys(poses), [poses]);
  const stem = stems[index] || stems[0];
  const pose = poses[stem];
  const widthPct = gearTweaks?.widthPct ?? 0.351;

  // Keep pose index valid when switching gears (same stem list expected).
  useEffect(() => {
    if (index >= stems.length) setIndex(Math.max(0, stems.length - 1));
  }, [stems.length, index]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tweaks));
  }, [tweaks]);

  const patchPose = useCallback(
    (partial) => {
      setTweaks((prev) => {
        const g = prev.gears?.[gearId];
        if (!g?.poses?.[stem]) return prev;
        return {
          ...prev,
          gears: {
            ...prev.gears,
            [gearId]: {
              ...g,
              poses: {
                ...g.poses,
                [stem]: { ...g.poses[stem], ...partial },
              },
            },
          },
        };
      });
    },
    [gearId, stem],
  );

  const nudge = useCallback(
    (dx, dy, dRot = 0) => {
      if (!pose) return;
      patchPose({
        x: +(pose.x + dx).toFixed(1),
        y: +(pose.y + dy).toFixed(1),
        rotationDeg: +(pose.rotationDeg + dRot).toFixed(1),
      });
    },
    [patchPose, pose],
  );

  const bumpViewZoom = useCallback((delta) => {
    setViewZoom((z) => clampViewZoom(z + delta));
  }, []);

  const fitViewZoom = useCallback(() => {
    const wrap = canvasWrapRef.current;
    const { w, h } = canvasSize;
    if (!wrap || !w || !h) return;
    const pad = 16;
    const fit = Math.min(
      (wrap.clientWidth - pad) / w,
      (wrap.clientHeight - pad) / h,
      1,
    );
    setViewZoom(clampViewZoom(fit));
  }, [canvasSize]);

  const switchGear = (id) => {
    if (!GEAR_ASSETS[id] || !tweaks.gears?.[id]) return;
    setGearId(id);
    setStatus("");
  };

  // Live canvas preview
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const bodySrc = BODY_BY_STEM[stem];
      if (!bodySrc || !pose) return;
      let hatImg = hatImgCache.current.get(gearId);
      if (!hatImg) {
        hatImg = await loadImage(gearAsset.src);
        hatImgCache.current.set(gearId, hatImg);
      }
      let body = bodyCache.current.get(stem);
      if (!body) {
        body = await loadImage(bodySrc);
        bodyCache.current.set(stem, body);
      }
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = body.naturalWidth;
      canvas.height = body.naturalHeight;
      setCanvasSize({ w: body.naturalWidth, h: body.naturalHeight });
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const drawHat = () =>
        drawGear(ctx, hatImg, gearAsset.meta, {
          x: pose.x,
          y: pose.y,
          rotationDeg: pose.rotationDeg,
          canvasW: canvas.width,
          widthPct,
        });
      if (gearAsset.underBody) {
        drawHat();
        ctx.drawImage(body, 0, 0);
      } else {
        ctx.drawImage(body, 0, 0);
        drawHat();
      }
      if (showCrosshair) {
        ctx.save();
        ctx.strokeStyle = "rgba(255, 80, 80, 0.85)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pose.x - 24, pose.y);
        ctx.lineTo(pose.x + 24, pose.y);
        ctx.moveTo(pose.x, pose.y - 24);
        ctx.lineTo(pose.x, pose.y + 24);
        ctx.stroke();
        ctx.restore();
      }
    })().catch((err) => setStatus(String(err.message || err)));
    return () => {
      cancelled = true;
    };
  }, [stem, pose, widthPct, showCrosshair, gearId, gearAsset]);

  // Scroll-wheel zoom over the preview (replaces needing to scroll the whole pose).
  useEffect(() => {
    const wrap = canvasWrapRef.current;
    if (!wrap) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const dir = e.deltaY > 0 ? -1 : 1;
      const stepAmt = e.shiftKey ? VIEW_ZOOM_STEP * 2 : VIEW_ZOOM_STEP;
      setViewZoom((z) => clampViewZoom(z + dir * stepAmt));
    };
    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => wrap.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.matches?.("input, textarea, select")) return;
      const s = e.shiftKey ? step * 3 : step;
      if (e.key === "ArrowLeft" && (e.altKey || e.metaKey)) {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "ArrowRight" && (e.altKey || e.metaKey)) {
        e.preventDefault();
        setIndex((i) => Math.min(stems.length - 1, i + 1));
        return;
      }
      if (e.key === "1") {
        e.preventDefault();
        switchGear("top_hat");
        return;
      }
      if (e.key === "2") {
        e.preventDefault();
        switchGear("crown");
        return;
      }
      if (e.key === "3") {
        e.preventDefault();
        switchGear("halo");
        return;
      }
      if (e.key === "4") {
        e.preventDefault();
        switchGear("plunger");
        return;
      }
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        setPreviewFlip((v) => !v);
        return;
      }
      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        bumpViewZoom(-VIEW_ZOOM_STEP);
        return;
      }
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        bumpViewZoom(VIEW_ZOOM_STEP);
        return;
      }
      if (e.key === "0") {
        e.preventDefault();
        fitViewZoom();
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        nudge(-s, 0);
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        e.preventDefault();
        nudge(s, 0);
      } else if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        e.preventDefault();
        nudge(0, -s);
      } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
        e.preventDefault();
        nudge(0, s);
      } else if (e.key === "q" || e.key === "Q") {
        e.preventDefault();
        nudge(0, 0, -1);
      } else if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        nudge(0, 0, 1);
      } else if (e.key === "[") {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "]") {
        e.preventDefault();
        setIndex((i) => Math.min(stems.length - 1, i + 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // switchGear closes over tweaks; key handler only needs gear ids present
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nudge, step, stems.length, tweaks.gears, bumpViewZoom, fitViewZoom]);

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () => setIndex((i) => Math.min(stems.length - 1, i + 1));

  const resetPoseFromSeed = () => {
    const seed = hatTweaksSeed.gears?.[gearId]?.poses?.[stem];
    if (seed) {
      patchPose({ x: seed.x, y: seed.y, rotationDeg: seed.rotationDeg });
    }
  };

  const copyFromTopHat = () => {
    if (gearId === "top_hat") return;
    const src = tweaks.gears?.top_hat?.poses?.[stem];
    if (!src) return;
    patchPose({
      x: src.x,
      y: src.y,
      rotationDeg: src.rotationDeg,
    });
    setStatus("Copied this pose from Top Hat — nudge as needed.");
  };

  const downloadTweaks = () => {
    downloadJson(tweaks, "hat-tweaks.json");
    setStatus(
      "Downloaded hat-tweaks.json — replace client/src/assets/cosmetics/hat-tweaks.json, then run: node scripts/bake-hat-overlays.mjs",
    );
  };

  const bakeToFolder = async () => {
    if (!window.showDirectoryPicker) {
      setStatus(
        "Folder picker not supported here — use Download tweaks + bake script instead.",
      );
      downloadTweaks();
      return;
    }
    try {
      setStatus("Pick the overlays folder (…/assets/cosmetics/overlays)…");
      const dir = await window.showDirectoryPicker({ mode: "readwrite" });
      let hatImg = hatImgCache.current.get(gearId);
      if (!hatImg) {
        hatImg = await loadImage(gearAsset.src);
        hatImgCache.current.set(gearId, hatImg);
      }
      let n = 0;
      for (const [s, p] of Object.entries(poses)) {
        const bodySrc = BODY_BY_STEM[s];
        if (!bodySrc) continue;
        let body = bodyCache.current.get(s);
        if (!body) {
          body = await loadImage(bodySrc);
          bodyCache.current.set(s, body);
        }
        const blob = await renderOverlayPng(
          hatImg,
          gearAsset.meta,
          p,
          widthPct,
          body.naturalWidth,
          body.naturalHeight,
        );
        const handle = await dir.getFileHandle(
          `${gearAsset.prefix}-${s}.png`,
          { create: true },
        );
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        n += 1;
      }
      try {
        const parent = await dir.getParent?.();
        if (parent) {
          const tw = await parent.getFileHandle("hat-tweaks.json", {
            create: true,
          });
          const w = await tw.createWritable();
          await w.write(JSON.stringify(tweaks, null, 2));
          await w.close();
        }
      } catch {
        downloadTweaks();
      }
      setStatus(
        `Wrote ${n} ${gearAsset.label} overlays. Drop hat-tweaks.json into cosmetics/ if needed, then hard-refresh.`,
      );
    } catch (err) {
      if (err?.name === "AbortError") {
        setStatus("Cancelled.");
        return;
      }
      setStatus(String(err.message || err));
    }
  };

  if (!pose) return null;

  const gearOptions = Object.keys(GEAR_ASSETS).filter((id) => tweaks.gears?.[id]);

  return (
    <Shell>
      <TopBar>
        <BackBtn type="button" onClick={onBack}>
          ← Back
        </BackBtn>
        <Title>
          Hat Tuner{" "}
          <Muted>
            {index + 1}/{stems.length}
          </Muted>
        </Title>
        <ScaleBadge title="Locked per gear — same size on every pose for this hat">
          {gearAsset.label} · widthPct {widthPct}
        </ScaleBadge>
      </TopBar>

      <Main>
        <Stage>
          <ZoomBar>
            <ZoomBtn
              type="button"
              onClick={() => bumpViewZoom(-VIEW_ZOOM_STEP)}
              disabled={viewZoom <= VIEW_ZOOM_MIN}
              title="Zoom out (−)"
            >
              −
            </ZoomBtn>
            <ZoomLabel>{Math.round(viewZoom * 100)}%</ZoomLabel>
            <ZoomBtn
              type="button"
              onClick={() => bumpViewZoom(VIEW_ZOOM_STEP)}
              disabled={viewZoom >= VIEW_ZOOM_MAX}
              title="Zoom in (+)"
            >
              +
            </ZoomBtn>
            <ZoomBtn type="button" onClick={fitViewZoom} title="Fit to view (0)">
              Fit
            </ZoomBtn>
            <ZoomBtn
              type="button"
              onClick={() => setPreviewFlip((v) => !v)}
              title="Flip preview facing (F) — display only"
              $on={previewFlip}
            >
              {previewFlip ? "Flip ←" : "Flip →"}
            </ZoomBtn>
          </ZoomBar>
          <CanvasWrap ref={canvasWrapRef}>
            <canvas
              ref={canvasRef}
              style={
                canvasSize.w
                  ? {
                      width: `${canvasSize.w * viewZoom}px`,
                      height: `${canvasSize.h * viewZoom}px`,
                      transform: previewFlip ? "scaleX(-1)" : "none",
                    }
                  : undefined
              }
            />
          </CanvasWrap>
          <PoseName>
            {pose.label || stem}
            <code>{stem}</code>
          </PoseName>
        </Stage>

        <Panel>
          <GearTabs>
            {gearOptions.map((id) => (
              <GearTab
                key={id}
                type="button"
                $on={gearId === id}
                onClick={() => switchGear(id)}
              >
                {GEAR_ASSETS[id].label}
              </GearTab>
            ))}
          </GearTabs>

          <NavRow>
            <NavBtn type="button" onClick={goPrev} disabled={index === 0}>
              ← Prev
            </NavBtn>
            <NavBtn
              type="button"
              $primary
              onClick={goNext}
              disabled={index >= stems.length - 1}
            >
              Next →
            </NavBtn>
          </NavRow>

          <PoseList
            value={stem}
            onChange={(e) => {
              const i = stems.indexOf(e.target.value);
              if (i >= 0) setIndex(i);
            }}
          >
            {stems.map((s, i) => (
              <option key={s} value={s}>
                {i + 1}. {poses[s].label || s}
              </option>
            ))}
          </PoseList>

          <Field>
            <label>X</label>
            <input
              type="number"
              step="0.1"
              value={pose.x}
              onChange={(e) => patchPose({ x: +e.target.value })}
            />
          </Field>
          <Field>
            <label>Y</label>
            <input
              type="number"
              step="0.1"
              value={pose.y}
              onChange={(e) => patchPose({ y: +e.target.value })}
            />
          </Field>
          <Field>
            <label>Rotation°</label>
            <input
              type="number"
              step="0.5"
              value={pose.rotationDeg}
              onChange={(e) => patchPose({ rotationDeg: +e.target.value })}
            />
          </Field>

          <Field>
            <label>Nudge step</label>
            <StepRow>
              {[1, 5, 10, 20].map((n) => (
                <Chip
                  key={n}
                  type="button"
                  $on={step === n}
                  onClick={() => setStep(n)}
                >
                  {n}px
                </Chip>
              ))}
            </StepRow>
          </Field>

          <Pad>
            <PadBtn type="button" onClick={() => nudge(0, -step)}>
              ↑
            </PadBtn>
            <PadMid>
              <PadBtn type="button" onClick={() => nudge(-step, 0)}>
                ←
              </PadBtn>
              <PadBtn type="button" onClick={() => nudge(step, 0)}>
                →
              </PadBtn>
            </PadMid>
            <PadBtn type="button" onClick={() => nudge(0, step)}>
              ↓
            </PadBtn>
          </Pad>

          <RotRow>
            <PadBtn type="button" onClick={() => nudge(0, 0, -1)}>
              ↺ −1°
            </PadBtn>
            <PadBtn type="button" onClick={() => nudge(0, 0, 1)}>
              ↻ +1°
            </PadBtn>
          </RotRow>

          <ToggleRow>
            <label>
              <input
                type="checkbox"
                checked={showCrosshair}
                onChange={(e) => setShowCrosshair(e.target.checked)}
              />
              Crosshair
            </label>
            <label title="Mirrors the preview only — attach points & bake stay on the original facing">
              <input
                type="checkbox"
                checked={previewFlip}
                onChange={(e) => setPreviewFlip(e.target.checked)}
              />
              Flip preview
            </label>
            <TextBtn type="button" onClick={resetPoseFromSeed}>
              Reset pose
            </TextBtn>
          </ToggleRow>

          {gearId !== "top_hat" ? (
            <TextBtn type="button" onClick={copyFromTopHat}>
              Copy this pose from Top Hat
            </TextBtn>
          ) : null}

          <Actions>
            <ActionBtn type="button" onClick={downloadTweaks}>
              Download tweaks JSON
            </ActionBtn>
            <ActionBtn type="button" $primary onClick={bakeToFolder}>
              Bake {gearAsset.label} overlays…
            </ActionBtn>
          </Actions>

          <Help>
            <p>
              <strong>1 / 2 / 3 / 4</strong> Top Hat / Crown / Halo / Plunger ·{" "}
              <strong>Arrows / WASD</strong> move · <strong>Q / E</strong>{" "}
              rotate · <strong>[ / ]</strong> prev/next pose · Hold Shift for
              3× nudge
            </p>
            <p>
              <strong>− / +</strong> zoom · <strong>0</strong> fit ·{" "}
              <strong>F</strong> flip preview · scroll wheel over preview to
              zoom
            </p>
            <p>
              Flip is display-only (same as in-game <code>scaleX(-1)</code>).
              Attach points and bake stay on the original facing.
            </p>
            <p>
              Each hat has its own attach points. Tune Top Hat first, switch
              gear, then adjust poses that sit wrong (e.g. idle).
            </p>
          </Help>

          {status ? <Status>{status}</Status> : null}
        </Panel>
      </Main>
    </Shell>
  );
};

HatTuner.propTypes = {
  onBack: PropTypes.func.isRequired,
};

export default HatTuner;

/* —— styles (tool UI, not product marketing) —— */

const Shell = styled.div`
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  background: #0e1116;
  color: #f0ebe3;
  font-family: "Space Grotesk", system-ui, sans-serif;
`;

const TopBar = styled.header`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid rgba(240, 235, 227, 0.12);
  background: #14181f;
`;

const BackBtn = styled.button`
  background: transparent;
  border: 1px solid rgba(240, 235, 227, 0.25);
  color: inherit;
  padding: 0.4rem 0.75rem;
  cursor: pointer;
  border-radius: 4px;
  &:hover {
    background: rgba(240, 235, 227, 0.08);
  }
`;

const Title = styled.h1`
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  flex: 1;
`;

const Muted = styled.span`
  opacity: 0.55;
  font-weight: 400;
`;

const ScaleBadge = styled.span`
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #8fd4a8;
  border: 1px solid rgba(143, 212, 168, 0.35);
  padding: 0.3rem 0.55rem;
  border-radius: 4px;
`;

const Main = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: 1fr min(340px, 36vw);
  min-height: 0;
  @media (max-width: 800px) {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr auto;
  }
`;

const Stage = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 0.75rem 1rem 1rem;
  gap: 0.5rem;
  background: radial-gradient(ellipse at 50% 40%, #1a2230 0%, #0e1116 70%);
`;

const ZoomBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
`;

const ZoomBtn = styled.button`
  min-width: 2.1rem;
  padding: 0.3rem 0.55rem;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  border-radius: 4px;
  border: 1px solid
    ${(p) =>
      p.$on ? "rgba(212, 175, 55, 0.65)" : "rgba(240, 235, 227, 0.22)"};
  background: ${(p) => (p.$on ? "#3a3020" : "#1c222c")};
  color: inherit;
  &:hover:not(:disabled) {
    background: ${(p) => (p.$on ? "#4a3c28" : "#262d3a")};
  }
  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
`;

const ZoomLabel = styled.span`
  min-width: 3.25rem;
  text-align: center;
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
  opacity: 0.75;
`;

const CanvasWrap = styled.div`
  flex: 1;
  width: 100%;
  min-height: 0;
  max-height: calc(100vh - 11rem);
  overflow: auto;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  canvas {
    display: block;
    max-width: none;
    image-rendering: auto;
    background: #fff;
  }
`;

const PoseName = styled.div`
  margin-top: 0.75rem;
  font-size: 1.05rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  code {
    font-size: 0.75rem;
    opacity: 0.5;
  }
`;

const Panel = styled.aside`
  border-left: 1px solid rgba(240, 235, 227, 0.12);
  background: #14181f;
  padding: 1rem 1.1rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const GearTabs = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem;
`;

const GearTab = styled.button`
  padding: 0.55rem 0.4rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  border-radius: 6px;
  border: 1px solid
    ${(p) => (p.$on ? "rgba(212, 175, 55, 0.65)" : "rgba(240, 235, 227, 0.2)")};
  background: ${(p) => (p.$on ? "#3a3020" : "#1c222c")};
  color: inherit;
  &:hover {
    filter: brightness(1.1);
  }
`;

const NavRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
`;

const NavBtn = styled.button`
  padding: 0.7rem 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  border-radius: 6px;
  border: 1px solid
    ${(p) => (p.$primary ? "rgba(143, 212, 168, 0.55)" : "rgba(240, 235, 227, 0.2)")};
  background: ${(p) => (p.$primary ? "#1e3d2e" : "#1c222c")};
  color: inherit;
  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  &:not(:disabled):hover {
    filter: brightness(1.12);
  }
`;

const PoseList = styled.select`
  width: 100%;
  padding: 0.5rem;
  background: #0e1116;
  color: inherit;
  border: 1px solid rgba(240, 235, 227, 0.2);
  border-radius: 4px;
`;

const Field = styled.div`
  display: grid;
  grid-template-columns: 5.5rem 1fr;
  align-items: center;
  gap: 0.5rem;
  label {
    font-size: 0.8rem;
    opacity: 0.7;
  }
  input[type="number"] {
    width: 100%;
    padding: 0.4rem 0.5rem;
    background: #0e1116;
    border: 1px solid rgba(240, 235, 227, 0.2);
    color: inherit;
    border-radius: 4px;
  }
`;

const StepRow = styled.div`
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
`;

const Chip = styled.button`
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  cursor: pointer;
  border-radius: 4px;
  border: 1px solid
    ${(p) => (p.$on ? "rgba(143, 212, 168, 0.6)" : "rgba(240, 235, 227, 0.2)")};
  background: ${(p) => (p.$on ? "#1e3d2e" : "transparent")};
  color: inherit;
`;

const Pad = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
`;

const PadMid = styled.div`
  display: flex;
  gap: 2.5rem;
`;

const PadBtn = styled.button`
  min-width: 3rem;
  padding: 0.45rem 0.65rem;
  cursor: pointer;
  border-radius: 4px;
  border: 1px solid rgba(240, 235, 227, 0.22);
  background: #1c222c;
  color: inherit;
  &:hover {
    background: #262d3a;
  }
`;

const RotRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
`;

const ToggleRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  label {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    cursor: pointer;
  }
`;

const TextBtn = styled.button`
  background: none;
  border: none;
  color: #8fb4d4;
  cursor: pointer;
  text-decoration: underline;
  font-size: 0.85rem;
  text-align: left;
  padding: 0;
`;

const Actions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin-top: 0.25rem;
`;

const ActionBtn = styled.button`
  padding: 0.65rem;
  cursor: pointer;
  border-radius: 6px;
  font-weight: 600;
  border: 1px solid
    ${(p) => (p.$primary ? "rgba(143, 212, 168, 0.55)" : "rgba(240, 235, 227, 0.22)")};
  background: ${(p) => (p.$primary ? "#1e3d2e" : "#1c222c")};
  color: inherit;
  &:hover {
    filter: brightness(1.1);
  }
`;

const Help = styled.div`
  font-size: 0.75rem;
  line-height: 1.45;
  opacity: 0.7;
  p {
    margin: 0 0 0.5rem;
  }
`;

const Status = styled.div`
  font-size: 0.78rem;
  line-height: 1.4;
  padding: 0.55rem 0.65rem;
  background: #1e3d2e;
  border-radius: 4px;
  border: 1px solid rgba(143, 212, 168, 0.35);
`;
