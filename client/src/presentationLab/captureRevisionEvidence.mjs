import { spawnSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const { app, BrowserWindow } = require("electron");

const LAB_ORIGIN = process.env.LAB_ORIGIN || "http://172.18.71.199:5173/";
const FPS = 30;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

app.commandLine.appendSwitch("headless");
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("no-sandbox");
// Renderer children can lose /dev/shm and zygote access under restricted
// parent contexts, which silently strands capturePage() calls.
app.commandLine.appendSwitch("disable-dev-shm-usage");
app.commandLine.appendSwitch("no-zygote");
app.commandLine.appendSwitch("disable-setuid-sandbox");

function labUrl({
  direction,
  fixture = "neutral",
  event = "none",
  moment = "fight",
  viewport = "1920x1080",
  contrast = "arena",
  inverted = false,
  longNames = false,
  overlap = false,
  replacement = false,
  seek = 0,
}) {
  const params = new URLSearchParams({
    presentationLab: "1",
    direction,
    fixture,
    event,
    moment,
    viewport,
    contrast,
    speed: "1",
    inverted: inverted ? "1" : "0",
    long: longNames ? "1" : "0",
    overlap: overlap ? "1" : "0",
    replacement: replacement ? "1" : "0",
    reduced: "0",
    paused: "1",
    seek: String(seek),
    chrome: "0",
  });
  return `${LAB_ORIGIN}?${params}`;
}

async function setViewport(window, width, height) {
  window.setContentSize(width, height);
  await sleep(80);
}

async function navigateReady(window, url) {
  await window.loadURL(url);
  const deadline = Date.now() + 15000;
  const expression = `(() => {
    const stage = document.querySelector(".pml-stage");
    const imagesReady = [...document.images].every((image) => image.complete);
    return document.readyState === "complete" && !!stage && imagesReady &&
      (!document.fonts || document.fonts.status === "loaded");
  })()`;

  while (Date.now() < deadline) {
    try {
      const ready = await window.webContents.executeJavaScript(expression, true);
      if (ready) {
        await sleep(120);
        return;
      }
    } catch {
      // Navigation can briefly invalidate the execution context.
    }
    await sleep(80);
  }

  throw new Error(`Lab did not become capture-ready: ${url}`);
}

async function capturePng(window, outputPath, width, height) {
  const rect = { x: 0, y: 0, width, height };
  let image = await window.webContents.capturePage(rect);

  // A fractional display scale can round the compositor surface a pixel short,
  // which silently clamps the rect. Grow the window once and re-raster.
  const size = image.getSize();
  if (size.width < width || size.height < height) {
    window.setContentSize(width + 1, height + 1);
    await sleep(120);
    image = await window.webContents.capturePage(rect);
  }

  await writeFile(outputPath, image.toPNG());
}

const STATIC_CAPTURES = [
  ["b2-neutral", 1920, 1080, { direction: "B2" }],
  ["b3-neutral", 1920, 1080, { direction: "B3" }],
  ["b2-danger", 1920, 1080, { direction: "B2", fixture: "danger" }],
  ["b3-danger", 1920, 1080, { direction: "B3", fixture: "danger" }],
  ["b2-posture-broken", 1920, 1080, { direction: "B2", fixture: "postureBroken" }],
  ["b3-posture-broken", 1920, 1080, { direction: "B3", fixture: "postureBroken" }],
  ["b2-long-name", 1920, 1080, { direction: "B2", longNames: true }],
  ["b3-long-name", 1920, 1080, { direction: "B3", longNames: true }],
  ["b2-inverted", 1920, 1080, { direction: "B2", inverted: true }],
  ["b3-inverted", 1920, 1080, { direction: "B3", inverted: true }],
  ["b2-active-power", 1920, 1080, { direction: "B2", fixture: "activePowerUp" }],
  ["b3-active-power", 1920, 1080, { direction: "B3", fixture: "activePowerUp" }],
  ["b2-cooldown", 1920, 1080, { direction: "B2", fixture: "cooldown" }],
  ["b3-cooldown", 1920, 1080, { direction: "B3", fixture: "cooldown" }],
  [
    "b2-basho-maximum",
    1920,
    1080,
    { direction: "B2", fixture: "bashoMaximum", longNames: true },
  ],
  [
    "b3-basho-maximum",
    1920,
    1080,
    { direction: "B3", fixture: "bashoMaximum", longNames: true },
  ],
  ["event-family-sheet", 1920, 1080, { direction: "B2", moment: "eventSheet" }],
  ["callout-scale", 1920, 1080, { direction: "B2", moment: "calloutScale" }],
  [
    "b2-ordinary-overlap",
    1920,
    1080,
    { direction: "B2", fixture: "damaged", event: "counterHit", overlap: true, seek: 420 },
  ],
  [
    "b3-ordinary-overlap",
    1920,
    1080,
    { direction: "B3", fixture: "damaged", event: "counterHit", overlap: true, seek: 420 },
  ],
  ["b2-hands-down", 1920, 1080, { direction: "B2", moment: "handsDown", seek: 900 }],
  ["b3-hands-down", 1920, 1080, { direction: "B3", moment: "handsDown", seek: 850 }],
  ["b2-hakki-yoi", 1920, 1080, { direction: "B2", moment: "hakkiYoi", seek: 360 }],
  ["b3-hakki-yoi", 1920, 1080, { direction: "B3", moment: "hakkiYoi", seek: 330 }],
  ["b2-result-short", 1920, 1080, { direction: "B2", moment: "resultForce", seek: 820 }],
  ["b3-result-short", 1920, 1080, { direction: "B3", moment: "resultForce", seek: 820 }],
  ["b2-result-long", 1920, 1080, { direction: "B2", moment: "resultLong", seek: 820 }],
  ["b3-result-long", 1920, 1080, { direction: "B3", moment: "resultLong", seek: 820 }],
  ["b2-basho-day", 1920, 1080, { direction: "B2", moment: "dayCard", seek: 1300 }],
  ["b3-basho-day", 1920, 1080, { direction: "B3", moment: "dayCard", seek: 1300 }],
  // Regression checks: the shared day-card styles must not disturb A/B/C.
  ["a-basho-day", 1920, 1080, { direction: "A", moment: "dayCard", seek: 1300 }],
  ["b-basho-day", 1920, 1080, { direction: "B", moment: "dayCard", seek: 1300 }],
  ["c-basho-day", 1920, 1080, { direction: "C", moment: "dayCard", seek: 1300 }],
  [
    "b2-prematch",
    1920,
    1080,
    { direction: "B2", moment: "preMatch", longNames: true, seek: 500 },
  ],
  [
    "b3-prematch",
    1920,
    1080,
    { direction: "B3", moment: "preMatch", longNames: true, seek: 500 },
  ],
  ["b2-match-over", 1920, 1080, { direction: "B2", moment: "matchOver", seek: 500 }],
  ["b3-match-over", 1920, 1080, { direction: "B3", moment: "matchOver", seek: 500 }],
  ["b2-1920x1080", 1920, 1080, { direction: "B2", viewport: "1920x1080" }],
  ["b3-1920x1080", 1920, 1080, { direction: "B3", viewport: "1920x1080" }],
  ["b2-1280x800", 1280, 800, { direction: "B2", viewport: "1280x800" }],
  ["b3-1280x800", 1280, 800, { direction: "B3", viewport: "1280x800" }],
  ["b2-contrast-arena", 1920, 1080, { direction: "B2", contrast: "arena" }],
  ["b3-contrast-arena", 1920, 1080, { direction: "B3", contrast: "arena" }],
  ["b2-contrast-bright", 1920, 1080, { direction: "B2", contrast: "bright" }],
  ["b3-contrast-bright", 1920, 1080, { direction: "B3", contrast: "bright" }],
  ["b2-contrast-dark", 1920, 1080, { direction: "B2", contrast: "dark" }],
  ["b3-contrast-dark", 1920, 1080, { direction: "B3", contrast: "dark" }],
];

const MOTION_CAPTURES = [
  {
    key: "info-replacement",
    durationMs: 1900,
    state: {
      fixture: "damaged",
      event: "counterHit",
      replacement: true,
    },
  },
  {
    key: "mastery",
    durationMs: 1700,
    state: { fixture: "damaged", event: "perfect" },
  },
  {
    key: "hands-down",
    durationMs: 2000,
    state: { moment: "handsDown" },
  },
  {
    key: "hakki-yoi",
    durationMs: 1200,
    state: { moment: "hakkiYoi" },
  },
  {
    key: "round-result",
    durationMs: 2600,
    state: { fixture: "damaged", moment: "resultLong" },
  },
  {
    key: "basho-day",
    durationMs: 3000,
    state: { fixture: "bashoMaximum", moment: "dayCard" },
  },
];

async function captureStatic(window, outputDirectory) {
  await mkdir(outputDirectory, { recursive: true });
  await setViewport(window, 1920, 1080);
  await navigateReady(window, labUrl({ direction: "B2" }));
  await sleep(500);

  const captureFilter = process.env.CAPTURE_FILTER;
  const captures = captureFilter
    ? STATIC_CAPTURES.filter(([name]) => captureFilter.split(",").includes(name))
    : STATIC_CAPTURES;

  for (const [name, width, height, state] of captures) {
    await setViewport(window, width, height);
    await navigateReady(window, labUrl(state));
    await capturePng(
      window,
      path.join(outputDirectory, `${name}.png`),
      width,
      height,
    );
    console.log(`STATIC ${name} ${width}x${height}`);
  }
}

async function encodeMotion(frameDirectory, outputPath) {
  const result = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      "-framerate",
      String(FPS),
      "-i",
      path.join(frameDirectory, "%05d.png"),
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      outputPath,
    ],
    { stdio: "inherit" },
  );
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed for ${outputPath}`);
  }
}

async function captureMotion(window, outputDirectory) {
  await mkdir(outputDirectory, { recursive: true });
  await setViewport(window, 960, 540);
  await navigateReady(window, labUrl({ direction: "B2" }));
  await sleep(500);

  const motionFilter = process.env.MOTION_FILTER;
  const motionCaptures = motionFilter
    ? MOTION_CAPTURES.filter((capture) =>
        motionFilter.split(",").includes(capture.key),
      )
    : MOTION_CAPTURES;

  for (const direction of ["B2", "B3"]) {
    for (const capture of motionCaptures) {
      const frameDirectory = path.join(
        os.tmpdir(),
        `pumo-${process.pid}-${direction.toLowerCase()}-${capture.key}`,
      );
      await mkdir(frameDirectory, { recursive: true });
      await navigateReady(window, labUrl({ direction, ...capture.state }));

      const frameCount = Math.ceil((capture.durationMs / 1000) * FPS) + 1;
      for (let frame = 0; frame < frameCount; frame += 1) {
        const ms = Math.min(
          capture.durationMs,
          Math.round((frame * 1000) / FPS),
        );
        await window.webContents.executeJavaScript(
          `document.querySelector(".pml-shell").style.setProperty("--lab-scrub", "-${ms}ms")`,
          true,
        );
        await capturePng(
          window,
          path.join(frameDirectory, `${String(frame).padStart(5, "0")}.png`),
          960,
          540,
        );
      }

      const outputPath = path.join(
        outputDirectory,
        `${direction.toLowerCase()}-${capture.key}-30fps.mp4`,
      );
      await encodeMotion(frameDirectory, outputPath);
      await rm(frameDirectory, { recursive: true, force: true });
      console.log(`MOTION ${direction} ${capture.key} ${frameCount} frames`);
    }
  }
}

async function main() {
  const [mode, outputArgument] = process.argv
    .slice(2)
    .filter((argument) => !argument.startsWith("--"));
  const outputDirectory = path.resolve(outputArgument || ".");
  if (!["static", "motion"].includes(mode)) {
    throw new Error(
      "Usage: electron captureRevisionEvidence.mjs <static|motion> <output-directory>",
    );
  }

  await app.whenReady();
  const window = new BrowserWindow({
    show: false,
    frame: false,
    useContentSize: true,
    width: 1920,
    height: 1080,
    backgroundColor: "#05070a",
    webPreferences: {
      backgroundThrottling: false,
      offscreen: true,
      sandbox: true,
    },
  });
  window.webContents.setFrameRate(60);

  try {
    if (mode === "static") await captureStatic(window, outputDirectory);
    else await captureMotion(window, outputDirectory);
  } finally {
    window.destroy();
    app.quit();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
