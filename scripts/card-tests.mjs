// Deterministic card-effect tests for the high cards (A, K, Q, J, 10).
// Drives the real app: injects a precise game state via the playtest bridge
// (window.__kp), plays/scores one specific card, answers its modals by clicking
// known options, then reads the resulting state back and asserts the exact
// outcome. This catches a card doing the WRONG thing, not just crashing.
//
//   node scripts/card-tests.mjs
import { spawn, execSync } from "node:child_process";
import { launchBrowser } from "./edge-launcher.mjs";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:5173/kaizen-poker/";
const URL = BASE + "?playtest=1#/hotseat";
const GLYPH = { C: "♣", D: "♦", H: "♥", S: "♠" };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const serverUp = async () => { try { return (await fetch(BASE, { signal: AbortSignal.timeout(2000) })).ok; } catch { return false; } };
let devServer = null;
const ensureServer = async () => {
  if (await serverUp()) return;
  console.log("dev server not running; starting one...");
  devServer = spawn("npx", ["vite"], { stdio: "ignore", shell: true });
  for (let i = 0; i < 60; i++) { await sleep(1000); if (await serverUp()) return; }
  throw new Error("dev server never came up at " + BASE);
};

// ---- in-page driving helpers ----
async function evalUntil(page, fn, arg, { timeout = 5000, interval = 70 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const v = await page.evaluate(fn, arg);
    if (v) return v;
    await sleep(interval);
  }
  return null;
}
const getState = page => page.evaluate(() => (window.__kp ? window.__kp.getState() : null));
const setState = (page, gs) => page.evaluate(s => window.__kp.setState(s), gs);

async function clickHand(page, id) {
  const ok = await evalUntil(page, cid => !!document.querySelector(`.kp-card-clickable[data-card-id="${cid}"]`), id);
  if (!ok) throw new Error(`hand card ${id} not clickable`);
  await page.evaluate(cid => document.querySelector(`.kp-card-clickable[data-card-id="${cid}"]`).click(), id);
}
async function clickReveal(page) {
  const ok = await evalUntil(page, () => [...document.querySelectorAll(".kp-btn")].some(b => !b.disabled && b.textContent.trim() === "REVEAL & SCORE"));
  if (!ok) throw new Error("REVEAL & SCORE not available");
  await page.evaluate(() => [...document.querySelectorAll(".kp-btn")].find(b => b.textContent.trim() === "REVEAL & SCORE").click());
}
async function clickModalCard(page, id) {
  // Some pick modals render the card twice: a non-clickable "YOUR SCORING HAND"
  // display row plus the real clickable pick list. Click the interactive one
  // (cursor: pointer), falling back to any match.
  const ok = await evalUntil(page, cid => {
    const m = document.querySelector(".kp-modal-shell"); if (!m) return false;
    return [...m.querySelectorAll(`[data-card-id="${cid}"]`)].some(el => getComputedStyle(el).cursor === "pointer");
  }, id);
  if (!ok) throw new Error(`clickable modal card ${id} not present`);
  await page.evaluate(cid => {
    const els = [...document.querySelector(".kp-modal-shell").querySelectorAll(`[data-card-id="${cid}"]`)];
    (els.find(el => getComputedStyle(el).cursor === "pointer") || els[0]).click();
  }, id);
}
async function clickModalText(page, text) {
  const ok = await evalUntil(page, t => { const m = document.querySelector(".kp-modal-shell"); return !!(m && [...m.querySelectorAll("button")].some(b => !b.disabled && b.textContent.trim() === t)); }, text);
  if (!ok) throw new Error(`modal button "${text}" not present`);
  await page.evaluate(t => [...document.querySelector(".kp-modal-shell").querySelectorAll("button")].find(b => b.textContent.trim() === t).click(), text);
}
async function clickModalStarts(page, prefix) {
  const ok = await evalUntil(page, p => { const m = document.querySelector(".kp-modal-shell"); return !!(m && [...m.querySelectorAll("button")].some(b => !b.disabled && b.textContent.trim().startsWith(p))); }, prefix);
  if (!ok) throw new Error(`modal button starting "${prefix}" not present`);
  await page.evaluate(p => [...document.querySelector(".kp-modal-shell").querySelectorAll("button")].find(b => !b.disabled && b.textContent.trim().startsWith(p)).click(), prefix);
}
async function maybeClickPlayIt(page) {
  const present = await evalUntil(page, () => { const m = document.querySelector(".kp-modal-shell"); return !!(m && [...m.querySelectorAll("button")].some(b => b.textContent.trim() === "Play It")); }, null, { timeout: 700 });
  if (present) await page.evaluate(() => [...document.querySelector(".kp-modal-shell").querySelectorAll("button")].find(b => b.textContent.trim() === "Play It").click());
}
const waitReveal = page => evalUntil(page, () => { const g = window.__kp.getState(); return g && g.phase === "reveal"; }, null, { timeout: 8000 });
const waitNoModal = page => evalUntil(page, () => !document.querySelector(".kp-modal-shell"), null, { timeout: 4000 });
const waitPhase = (page, phase) => evalUntil(page, ph => { const g = window.__kp.getState(); return g && g.phase === ph; }, phase, { timeout: 8000 });
const waitPlayerB = page => evalUntil(page, () => { const g = window.__kp.getState(); return g && g.currentPlayer === "B" && g.phase === "action"; });
// Click a button anywhere on the page (e.g. the reveal "Next Round ->" button,
// which lives in the showdown overlay, not a modal shell).
async function clickAnyBtnStarts(page, prefix) {
  const ok = await evalUntil(page, p => [...document.querySelectorAll(".kp-btn")].some(b => !b.disabled && b.textContent.trim().startsWith(p)), prefix);
  if (!ok) throw new Error(`button starting "${prefix}" not present`);
  await page.evaluate(p => [...document.querySelectorAll(".kp-btn")].find(b => !b.disabled && b.textContent.trim().startsWith(p)).click(), prefix);
}

// ---- scenario builders ----
const B_HAND = ["6C", "6D", "7C", "8S", "JD"]; // pair of 6s, no 2s (no B queen prompts)
const RESET = {
  bonusActions: 0, aMods: [], bMods: [], aForecast: [], bForecast: [],
  _scoreFlow: null, _revealAE: null, _revealBE: null, _revealWinner: null,
  _remotePrompt: null, newCards: [], aChips: 0, bChips: 0, round: 1, _aReq: 2, _bReq: 2,
  amends: { aFreeze: false, bFreeze: false, aNegate: false, bNegate: false },
  aPlay: [], bPlay: [], aDiscard: [], bDiscard: [], scrap: [], aDeck: [], bDeck: [],
};
const scoreScenario = (base, over) => ({ ...structuredClone(base), ...RESET, phase: "score", currentPlayer: "A", firstPlayer: "A", regularActionsPlayed: 2, actionsRequired: 2, bHand: B_HAND, ...over });
const actionScenario = (base, over) => ({ ...structuredClone(base), ...RESET, phase: "action", currentPlayer: "A", firstPlayer: "A", regularActionsPlayed: 0, actionsRequired: 2, bHand: B_HAND, ...over });

// ---- assertions ----
const fail = msg => { throw new Error(msg); };
const mod = (gs, target) => (gs.aMods || []).find(m => m.target === target);
const eqArrSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));

// ---- the tests ----
// Each returns nothing on success or throws with a detail message.
const TESTS = [
  // ===== 10s: rank/suit modifies resolved at scoring =====
  { name: "10H Buff — raise 2S to 9 makes Four of a Kind", run: async (page, base) => {
    await setState(page, scoreScenario(base, { aHand: ["9C", "9D", "9H", "2S", "3C"], aPlay: [{ id: "10H", faceDown: false }] }));
    await clickReveal(page);
    await clickModalCard(page, "2S");           // choose which scoring card
    await clickModalText(page, "9");            // new (higher) rank
    if (!await waitReveal(page)) fail("scoring never reached reveal");
    const g = await getState(page); const m = mod(g, "2S");
    if (!m || m.rank !== "9") fail(`expected 2S→9 mod, got ${JSON.stringify(m)}`);
    if (g._revealAE.handName !== "Four of a Kind") fail(`expected Four of a Kind, got ${g._revealAE.handName}`);
  } },
  { name: "10S Nerf — lower KS to 9 makes Four of a Kind", run: async (page, base) => {
    await setState(page, scoreScenario(base, { aHand: ["9C", "9D", "9H", "KS", "3C"], aPlay: [{ id: "10S", faceDown: false }] }));
    await clickReveal(page);
    await clickModalCard(page, "KS");
    await clickModalText(page, "9");
    if (!await waitReveal(page)) fail("scoring never reached reveal");
    const g = await getState(page); const m = mod(g, "KS");
    if (!m || m.rank !== "9") fail(`expected KS→9, got ${JSON.stringify(m)}`);
    if (g._revealAE.handName !== "Four of a Kind") fail(`expected Four of a Kind, got ${g._revealAE.handName}`);
  } },
  { name: "10C Nudge — move 10S down to 9 makes Four of a Kind", run: async (page, base) => {
    await setState(page, scoreScenario(base, { aHand: ["9C", "9D", "9H", "10S", "3C"], aPlay: [{ id: "10C", faceDown: false }] }));
    await clickReveal(page);
    await clickModalCard(page, "10S");
    await clickModalText(page, "9");            // adjacent rank (10 -> 9)
    if (!await waitReveal(page)) fail("scoring never reached reveal");
    const g = await getState(page); const m = mod(g, "10S");
    if (!m || m.rank !== "9") fail(`expected 10S→9, got ${JSON.stringify(m)}`);
    if (g._revealAE.handName !== "Four of a Kind") fail(`expected Four of a Kind, got ${g._revealAE.handName}`);
  } },
  { name: "10D Disguise — recolor 9C to ♥ makes a Flush", run: async (page, base) => {
    await setState(page, scoreScenario(base, { aHand: ["9C", "2H", "3H", "4H", "5H"], aPlay: [{ id: "10D", faceDown: false }] }));
    await clickReveal(page);
    await clickModalCard(page, "9C");
    await clickModalText(page, GLYPH.H);        // new suit ♥
    if (!await waitReveal(page)) fail("scoring never reached reveal");
    const g = await getState(page); const m = mod(g, "9C");
    if (!m || m.suit !== "H") fail(`expected 9C→♥, got ${JSON.stringify(m)}`);
    if (g._revealAE.handName !== "Flush") fail(`expected Flush, got ${g._revealAE.handName}`);
  } },

  // ===== J modifies (Clone, Reminisce) =====
  { name: "JC Clone — copy 9C onto 2S makes Three of a Kind", run: async (page, base) => {
    await setState(page, scoreScenario(base, { aHand: ["9C", "9D", "2S", "3H", "4C"], aPlay: [{ id: "JC", faceDown: false }] }));
    await clickReveal(page);
    await clickModalCard(page, "2S");           // overwrite target
    await clickModalCard(page, "9C");           // copy source
    if (!await waitReveal(page)) fail("scoring never reached reveal");
    const g = await getState(page); const m = mod(g, "2S");
    if (!m || m.rank !== "9" || m.suit !== "C") fail(`expected 2S→9C copy, got ${JSON.stringify(m)}`);
    if (g._revealAE.handName !== "Three of a Kind") fail(`expected Three of a Kind, got ${g._revealAE.handName}`);
  } },
  { name: "JS Reminisce — copy discard 9H onto 2S makes Three of a Kind", run: async (page, base) => {
    await setState(page, scoreScenario(base, { aHand: ["9C", "9D", "2S", "3H", "4C"], aDiscard: ["9H"], aPlay: [{ id: "JS", faceDown: false }] }));
    await clickReveal(page);
    await clickModalCard(page, "2S");           // overwrite target
    await clickModalCard(page, "9H");           // copy from discard
    if (!await waitReveal(page)) fail("scoring never reached reveal");
    const g = await getState(page); const m = mod(g, "2S");
    if (!m || m.rank !== "9" || m.suit !== "H") fail(`expected 2S→9H copy, got ${JSON.stringify(m)}`);
    if (g._revealAE.handName !== "Three of a Kind") fail(`expected Three of a Kind, got ${g._revealAE.handName}`);
  } },

  // ===== Q "Remember" passives (active while scrapped) on unmodified 2s =====
  { name: "QC Miscalculate — scrapped, retag 2S to 9 makes Four of a Kind", run: async (page, base) => {
    await setState(page, scoreScenario(base, { aHand: ["9C", "9D", "9H", "2S", "3C"], scrap: ["QC"] }));
    await clickReveal(page);
    await clickModalText(page, "Rank Only");
    await clickModalText(page, "9");
    if (!await waitReveal(page)) fail("scoring never reached reveal");
    const g = await getState(page); const m = mod(g, "2S");
    if (!m || m.rank !== "9") fail(`expected 2S→9, got ${JSON.stringify(m)}`);
    if (g._revealAE.handName !== "Four of a Kind") fail(`expected Four of a Kind, got ${g._revealAE.handName}`);
  } },
  { name: "QD Camouflage — scrapped, recolor 2S to ♥ makes a Flush", run: async (page, base) => {
    await setState(page, scoreScenario(base, { aHand: ["2S", "3H", "5H", "9H", "KH"], scrap: ["QD"] }));
    await clickReveal(page);
    await clickModalText(page, "Suit Only");
    await clickModalText(page, GLYPH.H);
    if (!await waitReveal(page)) fail("scoring never reached reveal");
    const g = await getState(page); const m = mod(g, "2S");
    if (!m || m.suit !== "H") fail(`expected 2S→♥, got ${JSON.stringify(m)}`);
    if (g._revealAE.handName !== "Flush") fail(`expected Flush, got ${g._revealAE.handName}`);
  } },

  // ===== K enacts (immediate, action phase) =====
  { name: "KC Brainstorm — draw 3, put the 3 drawn back on top", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["KC", "2C", "2D", "3C", "4D"], aDeck: ["9H", "9S", "9D", "5C", "5D"] }));
    await clickHand(page, "KC"); await maybeClickPlayIt(page);
    for (const id of ["9H", "9S", "9D"]) await clickModalCard(page, id);  // tap 3 (in order)
    await clickModalStarts(page, "Put 3/3");
    if (!await waitNoModal(page)) fail("brainstorm modal never closed");
    await sleep(250); const g = await getState(page);
    if (!eqArrSet(g.aDeck.slice(0, 3), ["9H", "9S", "9D"])) fail(`deck top3=${g.aDeck.slice(0, 3)}`);
    if (["9H", "9S", "9D"].some(id => g.aHand.includes(id))) fail(`drawn cards still in hand: ${g.aHand}`);
  } },
  { name: "KD Improvise — mill 3, take 5H from discard, discard 2C", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["KD", "2C", "2D", "3C"], aDeck: ["9H", "9S", "9D", "5C"], aDiscard: ["5H", "6H"] }));
    await clickHand(page, "KD"); await maybeClickPlayIt(page);
    await clickModalCard(page, "5H");   // take from discard
    await clickModalCard(page, "2C");   // discard from hand
    if (!await waitNoModal(page)) fail("improvise modal never closed");
    await sleep(250); const g = await getState(page);
    for (const id of ["9H", "9S", "9D"]) if (!g.aDiscard.includes(id)) fail(`milled ${id} not in discard: ${g.aDiscard}`);
    if (!g.aHand.includes("5H")) fail(`5H not taken to hand: ${g.aHand}`);
    if (!g.aDiscard.includes("2C") || g.aHand.includes("2C")) fail(`2C not discarded: hand=${g.aHand} disc=${g.aDiscard}`);
  } },
  { name: "KH Rejuvenate — discard 2C,2D then draw 2", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["KH", "2C", "2D", "3C", "4D"], aDeck: ["9H", "9S", "9D"] }));
    await clickHand(page, "KH"); await maybeClickPlayIt(page);
    await clickModalCard(page, "2C"); await clickModalCard(page, "2D");
    await clickModalStarts(page, "Discard");
    if (!await waitNoModal(page)) fail("rejuvenate modal never closed");
    await sleep(250); const g = await getState(page);
    if (!g.aDiscard.includes("2C") || !g.aDiscard.includes("2D")) fail(`discards missing: ${g.aDiscard}`);
    if (!g.aHand.includes("9H") || !g.aHand.includes("9S")) fail(`did not draw 2: ${g.aHand}`);
    if (g.aHand.length !== 4) fail(`hand size ${g.aHand.length}, expected 4`);
  } },
  { name: "KS Bury — scrap 5H,6H from discard", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["KS", "2C", "3C"], aDiscard: ["5H", "6H", "7H", "8C"] }));
    await clickHand(page, "KS"); await maybeClickPlayIt(page);
    await clickModalCard(page, "5H"); await clickModalCard(page, "6H");
    await clickModalStarts(page, "Confirm");
    if (!await waitNoModal(page)) fail("bury modal never closed");
    await sleep(250); const g = await getState(page);
    if (!g.scrap.includes("5H") || !g.scrap.includes("6H")) fail(`not scrapped: ${g.scrap}`);
    if (g.aDiscard.includes("5H") || g.aDiscard.includes("6H")) fail(`still in discard: ${g.aDiscard}`);
  } },

  // ===== A enacts (each grants a bonus action: turn must stay with A) =====
  { name: "AC Salvage — take 9H from scrap, keep the turn (bonus)", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["AC", "2C", "3C"], scrap: ["9H", "8C"], regularActionsPlayed: 1 }));
    await clickHand(page, "AC"); await maybeClickPlayIt(page);
    await clickModalCard(page, "9H");
    await sleep(300); const g = await getState(page);
    if (!g.aHand.includes("9H") || g.scrap.includes("9H")) fail(`9H not salvaged: hand=${g.aHand} scrap=${g.scrap}`);
    if (g.currentPlayer !== "A" || g.phase !== "action") fail(`bonus action not granted: player=${g.currentPlayer} phase=${g.phase}`);
  } },
  { name: "AD Explore — draw 9H, keep the turn (bonus)", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["AD", "2C"], aDeck: ["9H", "9S"], regularActionsPlayed: 1 }));
    await clickHand(page, "AD"); await maybeClickPlayIt(page);
    await sleep(300); const g = await getState(page);
    if (!g.aHand.includes("9H")) fail(`did not draw 9H: ${g.aHand}`);
    if (g.currentPlayer !== "A" || g.phase !== "action") fail(`bonus action not granted: player=${g.currentPlayer} phase=${g.phase}`);
  } },
  { name: "AH Retrieve — return 2D from play, keep the turn (bonus)", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["AH", "3C"], aPlay: [{ id: "2D", faceDown: false }], regularActionsPlayed: 1 }));
    await clickHand(page, "AH"); await maybeClickPlayIt(page);
    await clickModalCard(page, "2D");
    await sleep(300); const g = await getState(page);
    if (!g.aHand.includes("2D") || g.aPlay.some(a => a.id === "2D")) fail(`2D not retrieved: hand=${g.aHand} play=${JSON.stringify(g.aPlay)}`);
    if (g.currentPlayer !== "A" || g.phase !== "action") fail(`bonus action not granted: player=${g.currentPlayer} phase=${g.phase}`);
  } },
  { name: "AS Reanimate — return 9H from discard, keep the turn (bonus)", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["AS", "3C"], aDiscard: ["9H", "8C"], regularActionsPlayed: 1 }));
    await clickHand(page, "AS"); await maybeClickPlayIt(page);
    await clickModalCard(page, "9H");
    await sleep(300); const g = await getState(page);
    if (!g.aHand.includes("9H") || g.aDiscard.includes("9H")) fail(`9H not reanimated: hand=${g.aHand} disc=${g.aDiscard}`);
    if (g.currentPlayer !== "A" || g.phase !== "action") fail(`bonus action not granted: player=${g.currentPlayer} phase=${g.phase}`);
  } },

  // ===== 9s: scrap from your own discard (with filters) =====
  { name: "9C Terminate — scrap non-face 3D from discard", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["9C", "2C"], aDiscard: ["3D", "KD"] }));
    await clickHand(page, "9C"); await maybeClickPlayIt(page);
    await clickModalCard(page, "3D");
    await sleep(250); const g = await getState(page);
    if (!g.scrap.includes("3D") || g.aDiscard.includes("3D")) fail(`3D not scrapped: scrap=${g.scrap} disc=${g.aDiscard}`);
  } },
  { name: "9D Impeach — scrap face KD from discard", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["9D", "2C"], aDiscard: ["KD", "3D"] }));
    await clickHand(page, "9D"); await maybeClickPlayIt(page);
    await clickModalCard(page, "KD");
    await sleep(250); const g = await getState(page);
    if (!g.scrap.includes("KD") || g.aDiscard.includes("KD")) fail(`KD not scrapped: scrap=${g.scrap}`);
  } },
  { name: "9H Accumulate — scrap 5D matching scrapped 5C", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["9H", "2C"], aDiscard: ["5D", "9S"], scrap: ["5C"] }));
    await clickHand(page, "9H"); await maybeClickPlayIt(page);
    await clickModalCard(page, "5D");
    await sleep(250); const g = await getState(page);
    if (!g.scrap.includes("5D") || g.aDiscard.includes("5D")) fail(`5D not scrapped: scrap=${g.scrap}`);
  } },
  { name: "9S Reap — scrap 5D matching another discard card (5H)", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["9S", "2C"], aDiscard: ["5D", "5H", "8C"] }));
    await clickHand(page, "9S"); await maybeClickPlayIt(page);
    await clickModalCard(page, "5D");
    await sleep(250); const g = await getState(page);
    if (!g.scrap.includes("5D") || g.aDiscard.includes("5D")) fail(`5D not scrapped: scrap=${g.scrap}`);
  } },

  // ===== 8s: React/Modify (post-reveal) + Reject =====
  { name: "8H Reject — scrap the revealed top card 9H", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["8H", "2C"], aDeck: ["9H", "7C"] }));
    await clickHand(page, "8H"); await maybeClickPlayIt(page);
    await clickModalText(page, "Scrap It");
    await sleep(250); const g = await getState(page);
    if (!g.scrap.includes("9H")) fail(`9H not scrapped: scrap=${g.scrap}`);
    if (g.aDeck[0] === "9H") fail("9H still on deck top");
  } },
  { name: "8D Vanish — after scoring, scrap a discard card matching a scoring suit", run: async (page, base) => {
    await setState(page, scoreScenario(base, { aHand: ["2C", "3D", "4H", "5S", "9C"], aPlay: [{ id: "8D", faceDown: false }], aDiscard: ["8H"] }));
    await clickReveal(page);
    if (!await waitReveal(page)) fail("never reached reveal");
    await clickAnyBtnStarts(page, "Next Round");
    await clickModalCard(page, "8H");   // ♥ matches 4♥ in the scoring hand
    await waitNoModal(page);            // scrap happens before the round flips
    await sleep(200); const g = await getState(page);
    if (!g.scrap.includes("8H")) fail(`Vanish did not scrap 8H: scrap=${g.scrap}`);
  } },
  { name: "8C Capitulate — on a loss, scrap a card from discard", run: async (page, base) => {
    await setState(page, scoreScenario(base, { aHand: ["2C", "3D", "4H", "5S", "7C"], bHand: ["9C", "9D", "9H", "9S", "3C"], aPlay: [{ id: "8C", faceDown: false }], aDiscard: ["6H"] }));
    await clickReveal(page);
    if (!await waitReveal(page)) fail("never reached reveal");
    const mid = await getState(page);
    if (mid._revealWinner !== "B") fail(`expected B to win, got ${mid._revealWinner}`);
    await clickAnyBtnStarts(page, "Next Round");
    await clickModalCard(page, "6H");
    await waitNoModal(page);            // scrap happens before the round flips
    await sleep(200); const g = await getState(page);
    if (!g.scrap.includes("6H")) fail(`Capitulate did not scrap 6H: scrap=${g.scrap}`);
  } },
  { name: "8S Capitalize — discarding 8♠ (via Rejuvenate) lets you scrap a card", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["KH", "8S", "2C"], aDiscard: ["9H"], aDeck: ["7C", "7D", "7H"] }));
    await clickHand(page, "KH"); await maybeClickPlayIt(page);
    await clickModalCard(page, "8S");          // Rejuvenate: discard 8♠
    await clickModalStarts(page, "Discard");
    await clickModalCard(page, "9H");          // Capitalize trigger: scrap a card
    await sleep(300); const g = await getState(page);
    if (!g.scrap.includes("9H")) fail(`Capitalize did not scrap 9H: scrap=${g.scrap}`);
    if (!g.aDiscard.includes("8S")) fail(`8S not in discard: ${g.aDiscard}`);
  } },

  // ===== 7s: amends (Freeze/Negate) + Abdicate/Nullify =====
  { name: "7C Freeze — opponent can't scrap this round", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["7C", "3D"], regularActionsPlayed: 1, bHand: ["2H", "3S"], bDiscard: ["8C"] }));
    await clickHand(page, "7C"); await maybeClickPlayIt(page);
    if (!await waitPlayerB(page)) fail("turn did not pass to B");
    if (!(await getState(page)).amends.bFreeze) fail("bFreeze not set by 7C");
    await clickHand(page, "2H"); await maybeClickPlayIt(page);   // B tries to scrap club 8C
    await sleep(300); const g = await getState(page);
    if (!g.bDiscard.includes("8C") || g.scrap.includes("8C")) fail(`Freeze did not block scrap: bDisc=${g.bDiscard} scrap=${g.scrap}`);
  } },
  { name: "7D Negate — opponent can't play Modify actions", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["7D", "3D"], regularActionsPlayed: 1, bHand: ["10H", "3S"] }));
    await clickHand(page, "7D"); await maybeClickPlayIt(page);
    if (!await waitPlayerB(page)) fail("turn did not pass to B");
    if (!(await getState(page)).amends.bNegate) fail("bNegate not set by 7D");
    await clickHand(page, "10H");   // B tries to play a Modify
    await sleep(300); const g = await getState(page);
    if (g.bPlay.some(a => a.id === "10H") || !g.bHand.includes("10H")) fail(`Negate did not block Modify: bPlay=${JSON.stringify(g.bPlay)} bHand=${g.bHand}`);
  } },
  { name: "7H Abdicate — opponent discards a face card (KD) then draws", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["7H", "2C"], bHand: ["KD", "3S", "4S", "5S", "6S"], bDeck: ["9H", "7S"] }));
    await clickHand(page, "7H"); await maybeClickPlayIt(page);
    await clickModalCard(page, "KD");
    await sleep(300); const g = await getState(page);
    if (!g.bDiscard.includes("KD") || g.bHand.includes("KD")) fail(`KD not discarded by B: disc=${g.bDiscard} hand=${g.bHand}`);
    if (!g.bHand.includes("9H")) fail(`B did not draw 9H: ${g.bHand}`);
  } },
  { name: "7S Nullify — send opponent's Modify (10H) to its owner's discard", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["7S", "2C"], bPlay: [{ id: "10H", faceDown: false }] }));
    await clickHand(page, "7S"); await maybeClickPlayIt(page);
    await clickModalCard(page, "10H");
    await sleep(250); const g = await getState(page);
    if (!g.bDiscard.includes("10H") || g.bPlay.some(a => a.id === "10H")) fail(`10H not nullified: bDisc=${g.bDiscard} bPlay=${JSON.stringify(g.bPlay)}`);
  } },

  // ===== 6s: discard/scrap manipulation across players =====
  { name: "6C Curse — move scrapped 9H into opponent's discard", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["6C", "2C"], scrap: ["9H"] }));
    await clickHand(page, "6C"); await maybeClickPlayIt(page);
    await clickModalCard(page, "9H");
    await sleep(250); const g = await getState(page);
    if (!g.bDiscard.includes("9H") || g.scrap.includes("9H")) fail(`9H not cursed to B: bDisc=${g.bDiscard} scrap=${g.scrap}`);
  } },
  { name: "6D Abduct — steal opponent action 3S into your discard, scrap 6D", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["6D", "2C"], bPlay: [{ id: "3S", faceDown: false }] }));
    await clickHand(page, "6D"); await maybeClickPlayIt(page);
    await clickModalCard(page, "3S");
    await sleep(250); const g = await getState(page);
    if (!g.aDiscard.includes("3S")) fail(`3S not stolen into A discard: ${g.aDiscard}`);
    if (g.bPlay.some(a => a.id === "3S")) fail("3S still in B play");
    if (!g.scrap.includes("6D")) fail(`6D not self-scrapped: ${g.scrap}`);
  } },
  { name: "6H Exchange — swap your 5D for opponent's 9H", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["6H", "2C"], aDiscard: ["5D"], bDiscard: ["9H"] }));
    await clickHand(page, "6H"); await maybeClickPlayIt(page);
    await clickModalCard(page, "9H");   // from opponent's discard
    await clickModalCard(page, "5D");   // your card to trade away
    await sleep(250); const g = await getState(page);
    if (!g.aDiscard.includes("9H") || g.aDiscard.includes("5D")) fail(`A discard wrong after swap: ${g.aDiscard}`);
    if (!g.bDiscard.includes("5D") || g.bDiscard.includes("9H")) fail(`B discard wrong after swap: ${g.bDiscard}`);
  } },
  { name: "6S Banish — scrap a card from opponent's discard", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["6S", "2C"], bDiscard: ["9H"] }));
    await clickHand(page, "6S"); await maybeClickPlayIt(page);
    await clickModalCard(page, "9H");
    await sleep(250); const g = await getState(page);
    if (!g.scrap.includes("9H") || g.bDiscard.includes("9H")) fail(`9H not banished: scrap=${g.scrap} bDisc=${g.bDiscard}`);
  } },

  // ===== 5s: Mill / Forecast / Recall / Reclaim =====
  { name: "5C Mill — top 3 of deck go to discard", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["5C", "2C"], aDeck: ["9H", "9S", "9D", "7C"] }));
    await clickHand(page, "5C"); await maybeClickPlayIt(page);
    await sleep(250); const g = await getState(page);
    for (const id of ["9H", "9S", "9D"]) if (!g.aDiscard.includes(id)) fail(`${id} not milled: ${g.aDiscard}`);
    if (g.aDeck[0] !== "7C") fail(`deck top wrong after mill: ${g.aDeck}`);
  } },
  { name: "5D Forecast — saved scoring card carries onto next deck top", run: async (page, base) => {
    // Both decks need >=7 cards so the next round can actually deal full hands.
    await setState(page, scoreScenario(base, {
      aHand: ["9C", "9D", "2S", "3H", "4C"], aPlay: [{ id: "5D", faceDown: false }],
      aDeck: ["7H", "7S", "6H", "6S", "5H", "5S", "4H", "4D"],
      bDeck: ["2C", "2D", "2H", "3C", "3D", "3S", "4S"],
    }));
    await clickReveal(page);
    await clickModalCard(page, "9C");   // mark 9C for Forecast
    if (!await waitReveal(page)) fail("never reached reveal");
    await clickAnyBtnStarts(page, "Next Round");
    if (!await waitPhase(page, "action")) fail("next round never started");
    await sleep(200); const g = await getState(page);
    if (!g.aHand.includes("9C")) fail(`Forecast 9C not carried into next hand: ${g.aHand}`);
    if (g.aDiscard.includes("9C")) fail("Forecast 9C wrongly discarded");
  } },
  { name: "5H Recall — return your action 2D from play, then discard 3C", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["5H", "3C"], aPlay: [{ id: "2D", faceDown: false }] }));
    await clickHand(page, "5H"); await maybeClickPlayIt(page);
    await clickModalCard(page, "2D");   // recall target
    await clickModalCard(page, "3C");   // discard
    await sleep(250); const g = await getState(page);
    if (!g.aHand.includes("2D")) fail(`2D not returned to hand: ${g.aHand}`);
    if (g.aPlay.some(a => a.id === "2D")) fail("2D still in play");
    if (!g.aDiscard.includes("3C") || g.aHand.includes("3C")) fail(`3C not discarded: hand=${g.aHand} disc=${g.aDiscard}`);
  } },
  { name: "5S Reclaim — put 9H from discard on top of deck", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["5S", "2C"], aDiscard: ["9H"], aDeck: ["7C"] }));
    await clickHand(page, "5S"); await maybeClickPlayIt(page);
    await clickModalCard(page, "9H");
    await sleep(250); const g = await getState(page);
    if (g.aDeck[0] !== "9H") fail(`9H not on deck top: ${g.aDeck}`);
    if (g.aDiscard.includes("9H")) fail("9H still in discard");
  } },

  // ===== 2s: scrap from your OWN discard, filtered by suit =====
  { name: "2C Prune — scrap a ♦ (5D) from discard, not the ♣", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["2C", "3C"], aDiscard: ["5D", "8C"] }));
    await clickHand(page, "2C"); await maybeClickPlayIt(page);
    await clickModalCard(page, "5D");
    await sleep(250); const g = await getState(page);
    if (!g.scrap.includes("5D") || g.aDiscard.includes("5D")) fail(`5D not scrapped: scrap=${g.scrap} disc=${g.aDiscard}`);
  } },
  { name: "2D Sculpt — scrap a ♥ (5H) from discard", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["2D", "3C"], aDiscard: ["5H", "8C"] }));
    await clickHand(page, "2D"); await maybeClickPlayIt(page);
    await clickModalCard(page, "5H");
    await sleep(250); const g = await getState(page);
    if (!g.scrap.includes("5H") || g.aDiscard.includes("5H")) fail(`5H not scrapped: scrap=${g.scrap}`);
  } },
  { name: "2H Extract — scrap a ♠ (5S) from discard", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["2H", "3C"], aDiscard: ["5S", "9D"] }));
    await clickHand(page, "2H"); await maybeClickPlayIt(page);
    await clickModalCard(page, "5S");
    await sleep(250); const g = await getState(page);
    if (!g.scrap.includes("5S") || g.aDiscard.includes("5S")) fail(`5S not scrapped: scrap=${g.scrap}`);
  } },
  { name: "2S Trim — scrap a ♣ (5C) from discard", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["2S", "3C"], aDiscard: ["5C", "9H"] }));
    await clickHand(page, "2S"); await maybeClickPlayIt(page);
    await clickModalCard(page, "5C");
    await sleep(250); const g = await getState(page);
    if (!g.scrap.includes("5C") || g.aDiscard.includes("5C")) fail(`5C not scrapped: scrap=${g.scrap}`);
  } },

  // ===== 3s: look-at-top + refresh =====
  { name: "3C Defer — put the revealed top card (9H) on the bottom", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["3C", "2C"], aDeck: ["9H", "7H", "6H"] }));
    await clickHand(page, "3C"); await maybeClickPlayIt(page);
    await clickModalText(page, "Put on Bottom");
    await sleep(250); const g = await getState(page);
    if (g.aDeck[0] === "9H") fail(`9H still on top: ${g.aDeck}`);
    if (g.aDeck[g.aDeck.length - 1] !== "9H") fail(`9H not on bottom: ${g.aDeck}`);
  } },
  { name: "3D Loot — draw 9H, then discard 2C", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["3D", "2C"], aDeck: ["9H", "7H"] }));
    await clickHand(page, "3D"); await maybeClickPlayIt(page);
    await clickModalCard(page, "2C");
    await sleep(250); const g = await getState(page);
    if (!g.aHand.includes("9H")) fail(`did not draw 9H: ${g.aHand}`);
    if (!g.aDiscard.includes("2C") || g.aHand.includes("2C")) fail(`2C not discarded: hand=${g.aHand} disc=${g.aDiscard}`);
  } },
  { name: "3H Rummage (You Refresh) — discard 2C then draw 9H", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["3H", "2C", "5S"], aDeck: ["9H"] }));
    await clickHand(page, "3H"); await maybeClickPlayIt(page);
    await clickModalText(page, "You Refresh");
    await clickModalCard(page, "2C");
    await sleep(250); const g = await getState(page);
    if (!g.aDiscard.includes("2C")) fail(`2C not discarded: ${g.aDiscard}`);
    if (!g.aHand.includes("9H")) fail(`did not draw 9H: ${g.aHand}`);
  } },
  { name: "3S Consider — discard the revealed top card 9H", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["3S", "2C"], aDeck: ["9H", "7H"] }));
    await clickHand(page, "3S"); await maybeClickPlayIt(page);
    await clickModalText(page, "Discard It");
    await sleep(250); const g = await getState(page);
    if (!g.aDiscard.includes("9H")) fail(`9H not discarded: ${g.aDiscard}`);
    if (g.aDeck[0] !== "7H") fail(`deck top wrong: ${g.aDeck}`);
  } },

  // ===== 4s: deck search / shuffle =====
  { name: "4C Entomb — search deck for 9H and put it into discard", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["4C", "2C"], aDeck: ["9H", "7H", "6H"] }));
    await clickHand(page, "4C"); await maybeClickPlayIt(page);
    await clickModalCard(page, "9H");
    await sleep(250); const g = await getState(page);
    if (!g.aDiscard.includes("9H")) fail(`9H not entombed to discard: ${g.aDiscard}`);
    if (g.aDeck.includes("9H")) fail("9H still in deck");
  } },
  { name: "4D Gamble — search 9H to hand, random discard one (structure)", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["4D", "2C"], aDeck: ["9H", "7H", "6H"] }));
    await clickHand(page, "4D"); await maybeClickPlayIt(page);
    await clickModalCard(page, "9H");   // search the deck, take to hand
    await sleep(250); const g = await getState(page);
    if (g.aDeck.includes("9H")) fail("9H still in deck after search");
    const union = [...g.aHand, ...g.aDiscard];
    if (!union.includes("9H") || !union.includes("2C")) fail(`2C/9H not split between hand and discard: hand=${g.aHand} disc=${g.aDiscard}`);
    if (g.aDiscard.length !== 1) fail(`expected exactly one random discard, got ${g.aDiscard.length}: ${g.aDiscard}`);
  } },
  { name: "4H Cultivate — search deck for 9H and put it on top", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["4H", "2C"], aDeck: ["9H", "7H", "6H"] }));
    await clickHand(page, "4H"); await maybeClickPlayIt(page);
    await clickModalCard(page, "9H");
    await sleep(250); const g = await getState(page);
    if (g.aDeck[0] !== "9H") fail(`9H not on top after cultivate: ${g.aDeck}`);
  } },
  { name: "4S Unearth — return 9H from discard to hand, then discard 2C", run: async (page, base) => {
    await setState(page, actionScenario(base, { aHand: ["4S", "2C"], aDiscard: ["9H", "8C"] }));
    await clickHand(page, "4S"); await maybeClickPlayIt(page);
    await clickModalCard(page, "9H");   // return from discard
    await clickModalCard(page, "2C");   // then discard
    await sleep(250); const g = await getState(page);
    if (!g.aHand.includes("9H")) fail(`9H not returned to hand: ${g.aHand}`);
    if (!g.aDiscard.includes("2C") || g.aHand.includes("2C")) fail(`2C not discarded: hand=${g.aHand} disc=${g.aDiscard}`);
  } },
];

// ---- run ----
const { browser, close } = await launchBrowser();
const results = [];
const pageErrors = [];
try {
  await ensureServer();
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1 });
  page.on("pageerror", e => pageErrors.push(String(e?.message || e)));
  await page.goto(URL, { waitUntil: "load", timeout: 60000 });
  const base = await evalUntil(page, () => { const g = window.__kp && window.__kp.getState(); return g && g.aHand ? g : null; }, null, { timeout: 15000 });
  if (!base) throw new Error("playtest bridge / hotseat game never became available");

  for (const t of TESTS) {
    const before = pageErrors.length;
    try {
      await t.run(page, base);
      const errs = pageErrors.slice(before);
      if (errs.length) results.push({ name: t.name, pass: false, detail: "page error: " + errs[0] });
      else results.push({ name: t.name, pass: true });
    } catch (e) {
      results.push({ name: t.name, pass: false, detail: String(e.message || e) });
    }
    // settle + clear any stray modal before next test
    await page.evaluate(() => { try { window.__kp.setState(window.__kp.getState()); } catch {} });
    await sleep(150);
  }
} finally {
  await close();
  if (devServer) { try { execSync(`taskkill /F /T /PID ${devServer.pid}`, { stdio: "ignore" }); } catch {} }
}

console.log("\n=== CARD-EFFECT TESTS (A, K, Q, J, 10, 9, 8, 7, 6, 5) ===");
let passed = 0;
for (const r of results) {
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}`);
  if (!r.pass) console.log(`        ${r.detail}`);
  if (r.pass) passed++;
}
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
