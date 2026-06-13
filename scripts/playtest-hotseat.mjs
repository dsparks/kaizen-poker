// Automated hotseat playtest: drives a full hotseat game (or several) through
// the real UI, playing hand cards and generically resolving whatever modal
// each card pops, advancing through scoring/reveal/next-round to a winner.
// Scrapes the game log after every step so card effects can be read back, and
// fails on any uncaught page error or non-network console error.
//
//   node scripts/playtest-hotseat.mjs            play 1 game
//   GAMES=3 node scripts/playtest-hotseat.mjs    play 3 games
import fs from "node:fs";
import path from "node:path";
import { spawn, execSync } from "node:child_process";
import { launchBrowser } from "./edge-launcher.mjs";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:5173/kaizen-poker/";
const GAMES = parseInt(process.env.GAMES || "1", 10);
const OUT = path.resolve("smoke_output");
const IGNORABLE = [/net::ERR/i, /Failed to load resource/i, /umami/i, /supabase/i];
fs.mkdirSync(OUT, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));
// PLAYTEST_DELAY adds ms to each tick so a headed run is watchable.
const EXTRA = parseInt(process.env.PLAYTEST_DELAY || "0", 10);

const serverUp = async () => { try { return (await fetch(BASE, { signal: AbortSignal.timeout(2000) })).ok; } catch { return false; } };
let devServer = null;
const ensureServer = async () => {
  if (await serverUp()) return;
  console.log("dev server not running; starting one...");
  devServer = spawn("npx", ["vite"], { stdio: "ignore", shell: true });
  for (let i = 0; i < 60; i++) { await sleep(1000); if (await serverUp()) return; }
  throw new Error("dev server never came up at " + BASE);
};

// In-page helper: returns a snapshot of the current actionable affordances.
const probe = `(() => {
  const text = el => (el?.textContent || "").trim();
  const log = [...document.querySelectorAll(".kp-log-scroll div")].map(text);
  const modal = document.querySelector(".kp-modal-shell");
  const buttons = [...document.querySelectorAll("button")].map(b => ({
    label: text(b),
    cls: b.className,
    disabled: b.disabled,
    inModal: !!modal && modal.contains(b),
    cardId: b.getAttribute("data-card-id"),
    cursor: getComputedStyle(b).cursor,
  }));
  const clickableHand = [...document.querySelectorAll(".kp-card-clickable")].map(el => el.getAttribute("data-card-id"));
  let modalCards = [];
  if (modal) {
    modalCards = [...modal.querySelectorAll("[data-card-id]")]
      .filter(el => getComputedStyle(el).cursor === "pointer")
      .map(el => el.getAttribute("data-card-id"));
  }
  const bodyText = document.body.innerText;
  return { log, hasModal: !!modal, modalCards, clickableHand, buttons,
    gameOver: /Game Over|wins the solo run/i.test(bodyText) };
})()`;

// click helpers run in-page
async function clickModalCard(page, id) {
  return page.evaluate(cid => {
    const m = document.querySelector(".kp-modal-shell"); if (!m) return false;
    const el = m.querySelector(`[data-card-id="${cid}"]`);
    if (!el) return false; el.click(); return true;
  }, id);
}
async function clickButtonByLabel(page, label, inModalOnly = false) {
  return page.evaluate(({ label, inModalOnly }) => {
    const m = document.querySelector(".kp-modal-shell");
    const btns = [...document.querySelectorAll("button")];
    for (const b of btns) {
      if (b.disabled) continue;
      if (inModalOnly && !(m && m.contains(b))) continue;
      if ((b.textContent || "").trim() === label) { b.click(); return true; }
    }
    return false;
  }, { label, inModalOnly });
}
async function clickHandCard(page) {
  return page.evaluate(() => {
    const el = document.querySelector(".kp-card-clickable");
    if (!el) return null;
    const id = el.getAttribute("data-card-id"); el.click(); return id;
  });
}

const POSITIVE = ["Play It", "Confirm", "Leave on Top", "Keep on Top", "Leave It", "You Refresh", "Rank + Suit", "OK", "Okay", "Continue", "Yes"];
const NEGATIVE = ["Cancel", "No", "Quit to Home", "Return to Game", "Close", "Skip"];

// Resolve an open modal: prefer picking an enabled card; for multi-pick also
// hit Confirm. Otherwise click a rank/suit/plain button, then a positive
// button, and only fall back to a negative (cancel) button to escape.
async function resolveModal(page, snap) {
  if (snap.modalCards.length) {
    await clickModalCard(page, snap.modalCards[0]);
    await sleep(180);
    // multi-pick / brainstorm need an explicit confirm after selecting
    for (const lbl of ["Confirm", "Discard These", "Brainstorm", "Done"]) {
      if (await clickButtonByLabel(page, lbl, true)) { await sleep(150); break; }
    }
    return "card:" + snap.modalCards[0];
  }
  // plain rank/suit buttons inside modal (no kp-btn class, single glyph/short)
  const plain = snap.buttons.find(b => b.inModal && !b.disabled && !b.cls.includes("kp-btn") && b.label && b.label.length <= 3);
  if (plain) { await clickButtonByLabel(page, plain.label, true); return "pick:" + plain.label; }
  for (const lbl of POSITIVE) if (await clickButtonByLabel(page, lbl, true)) return "btn:" + lbl;
  // any enabled non-negative kp-btn in modal
  const other = snap.buttons.find(b => b.inModal && !b.disabled && b.cls.includes("kp-btn") && !NEGATIVE.includes(b.label));
  if (other) { await clickButtonByLabel(page, other.label, true); return "btn:" + other.label; }
  for (const lbl of NEGATIVE) if (await clickButtonByLabel(page, lbl, true)) return "escape:" + lbl;
  return "stuck";
}

async function playOneGame(browser, gameIndex, rec) {
  const page = await browser.newPage();
  rec.attach(page);
  await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1.5 });
  await page.goto(BASE + "#/hotseat", { waitUntil: "load", timeout: 60000 });
  await sleep(1200);

  const transcript = [];
  let lastLogLen = 0;
  let round = 0;
  let stuckTicks = 0;
  const MAX_TICKS = 1200;

  for (let tick = 0; tick < MAX_TICKS; tick++) {
    const snap = await page.evaluate(probe);
    // capture new log lines
    if (snap.log.length > lastLogLen) {
      for (const line of snap.log.slice(lastLogLen)) {
        transcript.push(line);
        if (line.startsWith("===")) {
          round++;
          await page.screenshot({ path: path.join(OUT, `playtest-g${gameIndex}-r${round}.png`) }).catch(() => {});
        }
      }
      lastLogLen = snap.log.length;
      stuckTicks = 0;
    }

    if (snap.gameOver) {
      await page.screenshot({ path: path.join(OUT, `playtest-g${gameIndex}-final.png`) }).catch(() => {});
      transcript.push("[GAME OVER reached]");
      break;
    }

    let acted = false;
    if (snap.hasModal) {
      const r = await resolveModal(page, snap);
      acted = r !== "stuck";
      if (r === "stuck") stuckTicks++;
    } else if (snap.buttons.some(b => !b.disabled && /Next Round/i.test(b.label))) {
      await clickButtonByLabel(page, snap.buttons.find(b => /Next Round/i.test(b.label)).label);
      acted = true;
    } else if (snap.buttons.some(b => !b.disabled && /REVEAL & SCORE/i.test(b.label))) {
      await clickButtonByLabel(page, "REVEAL & SCORE");
      acted = true;
    } else if (snap.clickableHand.length) {
      const id = await clickHandCard(page);
      acted = !!id;
    }

    if (!acted) stuckTicks++;
    if (stuckTicks > 40) { transcript.push("[STUCK — no actionable affordance for 40 ticks]"); break; }
    await sleep((acted ? 220 : 150) + EXTRA);
  }

  await sleep(300);
  const finalSnap = await page.evaluate(probe);
  await page.close();
  return { transcript, finalLog: finalSnap.log, gameOver: finalSnap.gameOver };
}

// ---- run ----
const { browser, close } = await launchBrowser();
const errors = [];
const rec = {
  attach(page) {
    page.on("pageerror", e => errors.push("pageerror: " + String(e?.message || e)));
    page.on("console", m => { if (m.type() === "error") { const t = m.text(); if (!IGNORABLE.some(rx => rx.test(t))) errors.push("console: " + t); } });
  },
};

const summaries = [];
try {
  await ensureServer();
  for (let g = 1; g <= GAMES; g++) {
    console.log(`\n===== GAME ${g} =====`);
    const res = await playOneGame(browser, g, rec);
    for (const line of res.transcript) console.log("  " + line);
    const winLine = res.finalLog.filter(l => /wins/i.test(l)).slice(-1)[0] || "(no winner line found)";
    summaries.push({ g, rounds: res.transcript.filter(l => l.startsWith("===")).length, gameOver: res.gameOver, winLine, lines: res.transcript.length });
  }
} finally {
  await close();
  if (devServer) { try { execSync(`taskkill /F /T /PID ${devServer.pid}`, { stdio: "ignore" }); } catch {} }
}

console.log("\n=== PLAYTEST SUMMARY ===");
for (const s of summaries) console.log(`Game ${s.g}: ${s.gameOver ? "COMPLETED" : "DID NOT COMPLETE"} | ${s.rounds} round-markers | ${s.lines} log lines | ${s.winLine}`);
console.log(`page/console errors: ${errors.length}`);
for (const e of errors.slice(0, 30)) console.log("  " + e.slice(0, 200));
const ok = errors.length === 0 && summaries.every(s => s.gameOver);
console.log(ok ? "\nRESULT: PASS" : "\nRESULT: FAIL");
process.exit(ok ? 0 : 1);
