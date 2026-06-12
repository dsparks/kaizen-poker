// Smoke suite: boots the dev server if needed, launches a headless browser,
// walks every route, plays a card to exercise the flight layer, and saves
// screenshots to smoke_output/. Fails (exit 1) on uncaught page errors or
// non-network console errors.
//
//   node scripts/smoke.mjs            run everything
//   SMOKE_BASE_URL=...                override the app URL
import fs from "node:fs";
import path from "node:path";
import { spawn, execSync } from "node:child_process";
import { launchBrowser } from "./edge-launcher.mjs";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:5173/kaizen-poker/";
const OUT = path.resolve("smoke_output");
// Network noise (analytics, supabase when offline) shouldn't fail the suite.
const IGNORABLE = [/net::ERR/i, /Failed to load resource/i, /umami/i, /supabase/i];

const ROUTES = [
  { name: "home", hash: "" },
  { name: "hotseat", hash: "#/hotseat" },
  { name: "solo", hash: "#/solo" },
  { name: "tutorial", hash: "#/tutorial" },
  { name: "gallery", hash: "#/gallery" },
  { name: "rules", hash: "#/rules" },
  { name: "solo-artless", hash: "#/solo-artless" },
  { name: "hotseat-mobile", hash: "#/hotseat", viewport: { width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
];

const serverUp = async () => {
  try { const r = await fetch(BASE, { signal: AbortSignal.timeout(2000) }); return r.ok; } catch { return false; }
};

let devServer = null;
const ensureServer = async () => {
  if (await serverUp()) return;
  console.log("dev server not running; starting one...");
  devServer = spawn("npx", ["vite"], { stdio: "ignore", shell: true });
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 1000));
    if (await serverUp()) return;
  }
  throw new Error("dev server never came up at " + BASE);
};

const watchPage = page => {
  const rec = { pageErrors: [], consoleErrors: [] };
  page.on("pageerror", e => rec.pageErrors.push(String(e?.message || e)));
  page.on("console", m => { if (m.type() === "error") rec.consoleErrors.push(m.text()); });
  return rec;
};
const realErrors = rec => [
  ...rec.pageErrors,
  ...rec.consoleErrors.filter(t => !IGNORABLE.some(rx => rx.test(t))),
];

fs.mkdirSync(OUT, { recursive: true });
const { browser, close } = await launchBrowser();
const results = [];
let failed = false;

try {
  await ensureServer();

  for (const route of ROUTES) {
    const page = await browser.newPage();
    const rec = watchPage(page);
    await page.setViewport(route.viewport || { width: 1400, height: 900, deviceScaleFactor: 1.5 });
    let navOk = true;
    try {
      await page.goto(BASE + route.hash, { waitUntil: "load", timeout: 60000 });
      await new Promise(r => setTimeout(r, 1200));
    } catch (e) {
      navOk = false;
      rec.pageErrors.push("NAVIGATION FAILED: " + e.message);
    }
    await page.screenshot({ path: path.join(OUT, route.name + ".png") }).catch(() => {});
    const errs = realErrors(rec);
    results.push({ name: route.name, ok: navOk && !errs.length, errs });
    await page.close();
  }

  // Interaction: play the first clickable hand card in hotseat and confirm
  // the flight layer animates and nothing throws.
  {
    const page = await browser.newPage();
    const rec = watchPage(page);
    await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1.5 });
    await page.goto(BASE + "#/hotseat", { waitUntil: "load", timeout: 60000 });
    await new Promise(r => setTimeout(r, 1200));
    const clicked = await page.evaluate(() => {
      const el = document.querySelector(".kp-card-clickable");
      if (!el) return null;
      const id = el.getAttribute("data-card-id");
      el.click();
      return id;
    });
    await new Promise(r => setTimeout(r, 120));
    const ghosts = await page.evaluate(() => document.querySelectorAll("[data-flight-ghost]").length);
    await new Promise(r => setTimeout(r, 600));
    const ghostsAfter = await page.evaluate(() => document.querySelectorAll("[data-flight-ghost]").length);
    await page.screenshot({ path: path.join(OUT, "interaction.png") }).catch(() => {});
    const errs = realErrors(rec);
    const ok = !!clicked && ghostsAfter === 0 && !errs.length;
    results.push({ name: `interaction (played ${clicked || "nothing"}, ${ghosts} ghost mid-flight)`, ok, errs });
    await page.close();
  }
} finally {
  await close();
  if (devServer) { try { execSync(`taskkill /F /T /PID ${devServer.pid}`, { stdio: "ignore" }); } catch {} }
}

console.log("\n=== SMOKE RESULTS ===");
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}`);
  for (const e of r.errs) console.log(`        ${e.slice(0, 200)}`);
  if (!r.ok) failed = true;
}
console.log(`screenshots: ${OUT}`);
process.exit(failed ? 1 : 0);
