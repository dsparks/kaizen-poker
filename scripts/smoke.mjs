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
  { name: "home-mobile-portrait", hash: "", viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
  { name: "hotseat-mobile-portrait", hash: "#/hotseat", viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
  { name: "gallery-mobile-portrait", hash: "#/gallery", viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
  { name: "rules-mobile-portrait", hash: "#/rules", viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
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

  // Portrait phone: the board must keep the log in a drawer, expose a
  // horizontally scrollable full-size hand, and still accept card taps.
  {
    const page = await browser.newPage();
    const rec = watchPage(page);
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto(BASE + "#/hotseat", { waitUntil: "load", timeout: 60000 });
    await new Promise(r => setTimeout(r, 1200));
    const audit = await page.evaluate(() => {
      const card = document.querySelector(".kp-card-clickable");
      const logButton = [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "LOG");
      const permanentLog = [...document.querySelectorAll(".kp-section-label")].some(el => el.textContent.trim() === "GAME LOG");
      const before = card?.getAttribute("data-card-id") || null;
      card?.click();
      logButton?.click();
      return { before, hasLogButton: !!logButton, permanentLog, documentOverflow: document.documentElement.scrollWidth > window.innerWidth + 1 };
    });
    await new Promise(r => setTimeout(r, 500));
    const drawerOpen = await page.evaluate(() => [...document.querySelectorAll(".kp-section-label")].some(el => el.textContent.trim() === "Game Log"));
    await page.screenshot({ path: path.join(OUT, "interaction-mobile-portrait.png") }).catch(() => {});
    const errs = realErrors(rec);
    results.push({name:`mobile portrait interaction (${audit.before || "no card"})`,ok:!!audit.before&&audit.hasLogButton&&!audit.permanentLog&&!audit.documentOverflow&&drawerOpen&&!errs.length,errs:[...errs,...(!audit.hasLogButton?["LOG drawer button missing"]:[]),...(audit.permanentLog?["permanent log visible"]:[]),...(audit.documentOverflow?["document has horizontal overflow"]:[]),...(!drawerOpen?["log drawer did not open"]:[])]});
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
