// High-res element screenshot of the card back, for iterating on its design.
// Self-contained: launches its own headless browser (needs the dev server up,
// or set SMOKE_BASE_URL). Output: smoke_output/cardback.png
import fs from "node:fs";
import path from "node:path";
import { launchBrowser } from "./edge-launcher.mjs";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:5173/kaizen-poker/";
const OUT = path.resolve("smoke_output");
fs.mkdirSync(OUT, { recursive: true });

const { browser, close } = await launchBrowser();
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 5 });
  await page.goto(BASE + "#/solo", { waitUntil: "load", timeout: 60000 });
  await new Promise(r => setTimeout(r, 1500));
  // Clone one card back into an unobstructed fixed position for a clean shot.
  const ok = await page.evaluate(() => {
    const src = document.querySelector(".kp-cardback");
    if (!src) return false;
    const clone = src.cloneNode(true);
    clone.id = "cardback-shot";
    Object.assign(clone.style, { position: "fixed", left: "40px", top: "40px", transform: "none", zIndex: "99999" });
    document.body.appendChild(clone);
    return true;
  });
  if (!ok) throw new Error("no .kp-cardback found on the solo board");
  const el = await page.$("#cardback-shot");
  await el.screenshot({ path: path.join(OUT, "cardback.png") });
  console.log("saved", path.join(OUT, "cardback.png"));
} finally {
  await close();
}
