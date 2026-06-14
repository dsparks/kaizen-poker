// Builds a print-quality PDF rulebook styled like the analog game: cream
// card-stock pages, Lilita One headers + a serif body echoing the card faces,
// gold/green accents, and the real rendered card images. Renders via headless
// Edge (page.pdf). Also writes per-page PNG previews to smoke_output/.
//
//   node scripts/build-rulebook.mjs
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { launchBrowser } from "./edge-launcher.mjs";

const ART = path.resolve("web_art/rendered");
const OUT_PDF = path.resolve("Kaizen Poker Rulebook.pdf");
const PREVIEW = path.resolve("smoke_output");
fs.mkdirSync(PREVIEW, { recursive: true });

// Cards never display wider than ~170px; downscale to 340px before embedding so
// Chrome's page.pdf (which re-embeds images decompressed) doesn't bloat the file.
const uri = async name => {
  const p = path.join(ART, `${name}.webp`);
  if (!fs.existsSync(p)) { console.warn("missing card image:", name); return ""; }
  const buf = await sharp(p).resize({ width: 340 }).webp({ quality: 82 }).toBuffer();
  return `data:image/webp;base64,${buf.toString("base64")}`;
};
const CARDS = ["Brainstorm", "Salvage", "Disguise", "Banish", "Cultivate", "Extract", "Nudge",
  "Capitalize", "Freeze", "Camouflage", "Reanimate", "Curse", "Forecast", "Improvise", "Explore",
  "Buff", "Vanish", "Mill", "Trim", "Bury", "Exchange", "Terminate", "Sculpt", "Rejuvenate"];
const img = Object.fromEntries(await Promise.all(CARDS.map(async n => [n, await uri(n)])));
// A fan of cards anchored at the bottom of a sparse page (analog "cards on the felt").
const flourish = names => `<div class="flourish">${names.map((n, i) =>
  `<img src="${img[n]}" style="transform:rotate(${(i - (names.length - 1) / 2) * 8}deg)" alt="${n}"/>`).join("")}</div>`;
// The five Action types, illustrated by one card each.
const typestrip = () => `<div class="typestrip">${[["Extract", "Enact"], ["Capitalize", "React"], ["Nudge", "Modify"], ["Freeze", "Amend"], ["Camouflage", "Remember"]]
  .map(([n, t]) => `<div class="ts"><img src="${img[n]}" alt="${n}"/><span>${t}</span></div>`).join("")}</div>`;

const GF = "https://fonts.googleapis.com/css2?family=Lilita+One&family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Oswald:wght@500;600;700&display=swap";

const HANDS = [
  ["High Card", "Highest single card; nothing else made."],
  ["Pair", "Two cards of one rank."],
  ["Twins", "Two cards of the same rank <em>and</em> suit.", true],
  ["Two Pair", "Two different pairs."],
  ["Three of a Kind", "Three cards of one rank."],
  ["Straight", "Five in sequence, any suits."],
  ["Flush", "Five of one suit, any ranks."],
  ["Full House", "Three of a kind plus a pair."],
  ["Four of a Kind", "Four cards of one rank."],
  ["Straight Flush", "Five in sequence, one suit."],
  ["Royal Flush", "A 10–A straight flush."],
  ["Five of a Kind", "Five cards of one rank.", true],
  ["Flush House", "A full house, all one suit.", true],
  ["Flush Five", "Five identical cards — same rank and suit.", true],
];

const TYPES = [
  ["Enact", "#8d6e63", "Resolves immediately when played."],
  ["React", "#4d8b6f", "Stays in play and resolves later, when its trigger occurs."],
  ["Modify", "#c89b3c", "When you reveal your scoring hand, assign one scoring card to this Action; it changes that card’s rank or suit."],
  ["Amend", "#a85045", "Changes the rules of the game while it is in play."],
  ["Remember", "#6d5b9c", "Does nothing as an Action — but changes the rules for both players while it sits in the scrap pile."],
];

const CHALLENGER = [
  ["2", "High Card"], ["3", "Pair"], ["4", "Twins"], ["5", "Two Pair"], ["6", "Three of a Kind"],
  ["7", "Straight"], ["8", "Flush"], ["9", "Full House"], ["10", "Four of a Kind"], ["J", "Straight Flush"],
  ["Q", "Royal Flush"], ["K", "Five of a Kind"], ["A", "Flush House / Flush Five"],
];

const card = (name, w = 150, rot = 0, cls = "") =>
  `<img class="card ${cls}" src="${img[name]}" style="width:${w}px;transform:rotate(${rot}deg)" alt="${name}"/>`;

const sec = (n, title) => `<div class="sec"><span class="secnum">${n}</span><h2>${title}</h2></div>`;

const html = `<!doctype html><html><head><meta charset="utf-8"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="${GF}" rel="stylesheet"/>
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root{ --ink:#2c2317; --cream:#f4ecda; --paper:#fbf5e6; --green:#1c6b3e; --green-deep:#0c331d;
    --gold:#bd9233; --gold-br:#e3b955; --rule:#dccdaa; --muted:#7a6c52; }
  html{ -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body{ font-family:"Lora",Georgia,serif; color:var(--ink); }
  .page{ width:210mm; height:297mm; position:relative; overflow:hidden; page-break-after:always;
    background:var(--cream); padding:18mm 17mm 16mm; }
  .page:last-child{ page-break-after:auto; }
  .page::after{ content:""; position:absolute; inset:7mm; border:1.5px solid var(--rule); border-radius:3mm; pointer-events:none; }
  .inner{ position:relative; z-index:1; height:100%; }

  h2{ font-family:"Lilita One",sans-serif; font-weight:400; color:var(--green); font-size:23px; letter-spacing:.3px; }
  .sec{ display:flex; align-items:center; gap:10px; margin:0 0 9px; padding-bottom:6px; border-bottom:2px solid var(--gold); }
  .secnum{ font-family:"Lilita One",sans-serif; color:#fff; background:var(--green); width:27px; height:27px; border-radius:50%;
    display:flex; align-items:center; justify-content:center; font-size:14px; box-shadow:0 2px 0 #0b2c1a; }
  .sub{ font-family:"Oswald",sans-serif; font-weight:600; text-transform:uppercase; letter-spacing:1.5px; font-size:12px; color:var(--gold); margin:14px 0 4px; }
  p{ font-size:14px; line-height:1.5; margin:7px 0; }
  p.lead{ font-size:15.5px; }
  em{ color:var(--green); font-style:italic; }
  b,strong{ color:var(--ink); }
  ol.phases{ list-style:none; margin:8px 0; }
  ol.phases li{ position:relative; padding:8px 0 8px 40px; border-bottom:1px solid var(--rule); font-size:14px; line-height:1.45; }
  ol.phases li:last-child{ border-bottom:none; }
  ol.phases .pn{ position:absolute; left:0; top:7px; font-family:"Lilita One",sans-serif; color:var(--gold); background:#fff;
    border:2px solid var(--gold); width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:13px; }
  .phases b{ font-family:"Oswald",sans-serif; text-transform:uppercase; letter-spacing:.5px; color:var(--green); }

  .note{ background:var(--paper); border:1px solid #e2d4ad; border-left:5px solid var(--gold); border-radius:5px;
    padding:10px 13px; margin:11px 0; box-shadow:0 2px 5px rgba(60,45,20,.06); }
  .note .lbl{ font-family:"Oswald",sans-serif; font-weight:700; text-transform:uppercase; letter-spacing:1px; font-size:11px; color:var(--gold); display:block; margin-bottom:3px; }
  .note p{ margin:3px 0; font-size:13px; }

  .types li, .vocab li, .themes li{ list-style:none; font-size:13.5px; line-height:1.45; margin:7px 0; }
  .types li{ padding-left:96px; position:relative; min-height:24px; }
  .types .tlbl{ position:absolute; left:0; top:1px; width:86px; text-align:center; font-family:"Oswald",sans-serif; font-weight:700;
    text-transform:uppercase; letter-spacing:.5px; font-size:11px; color:#fff; border-radius:4px; padding:3px 0; }
  .vocab li{ padding-left:14px; position:relative; }
  .vocab li::before{ content:"◆"; position:absolute; left:0; color:var(--gold); font-size:10px; top:3px; }
  .vocab b{ font-family:"Oswald",sans-serif; text-transform:uppercase; letter-spacing:.5px; color:var(--green); }
  .themes{ column-count:2; column-gap:22px; margin-top:6px; }
  .themes li{ break-inside:avoid; padding-left:16px; position:relative; margin:6px 0; }
  .themes li::before{ content:"♦"; position:absolute; left:0; color:var(--gold); top:1px; font-size:11px; }
  .themes b{ font-family:"Oswald",sans-serif; color:var(--green); }

  table{ width:100%; border-collapse:collapse; margin-top:8px; font-size:13px; }
  th{ font-family:"Oswald",sans-serif; text-transform:uppercase; letter-spacing:.8px; font-size:11px; background:var(--green);
    color:#fff; padding:7px 10px; text-align:left; }
  td{ padding:6px 10px; border-bottom:1px solid var(--rule); }
  tr:nth-child(even) td{ background:rgba(189,146,51,.07); }
  td.r{ font-family:"Lilita One",sans-serif; color:var(--green); width:42px; }
  .special td.h{ color:var(--gold); font-weight:600; }
  .special{ background:rgba(189,146,51,.10)!important; }
  .hand-rank{ font-family:"Lilita One",sans-serif; color:var(--green); width:30px; text-align:center; }

  .card{ border-radius:7px; box-shadow:0 5px 14px rgba(40,28,10,.28); border:1px solid rgba(0,0,0,.1); }
  .foot{ position:absolute; bottom:9mm; left:17mm; right:17mm; display:flex; justify-content:space-between;
    font-family:"Oswald",sans-serif; font-size:9px; letter-spacing:1px; text-transform:uppercase; color:var(--muted); }
  .flourish{ position:absolute; left:0; right:0; bottom:18mm; display:flex; justify-content:center; }
  .flourish img{ width:96px; border-radius:7px; border:2px solid #f4e9d8; box-shadow:0 9px 20px rgba(40,28,10,.32); margin:0 -13px; }
  .typestrip{ position:absolute; left:17mm; right:17mm; bottom:17mm; display:flex; justify-content:space-between; }
  .typestrip .ts{ text-align:center; }
  .typestrip .ts img{ width:97px; border-radius:7px; border:2px solid #f4e9d8; box-shadow:0 6px 15px rgba(40,28,10,.28); display:block; }
  .typestrip .ts span{ font-family:"Oswald",sans-serif; text-transform:uppercase; letter-spacing:1px; font-size:10px; color:var(--gold); margin-top:6px; display:block; }

  /* Cover */
  .cover{ background:radial-gradient(ellipse at 50% -10%, #2f9c5c 0%, #1c6b3e 36%, #0c331d 74%, #06180e 100%); padding:0; }
  .cover::after{ border-color:rgba(227,185,85,.45); inset:9mm; }
  .cover .inner{ display:flex; flex-direction:column; align-items:center; text-align:center; padding:34mm 20mm; }
  .kicker{ font-family:"Oswald",sans-serif; text-transform:uppercase; letter-spacing:5px; font-size:13px; color:#e7d9b0; margin-bottom:8px; }
  .title{ font-family:"Lilita One",sans-serif; font-size:74px; line-height:.95; color:var(--gold-br);
    text-shadow:0 3px 0 #5a3d0e, 0 6px 18px rgba(0,0,0,.5); letter-spacing:1px; }
  .tagline{ font-family:"Lora",serif; font-style:italic; font-size:21px; color:#f3ead4; margin-top:12px; }
  .fan{ position:relative; height:300px; margin-top:30px; width:100%; }
  .fan img{ position:absolute; left:50%; top:0; border-radius:9px; box-shadow:0 14px 30px rgba(0,0,0,.5); border:2px solid #f4e9d8; }
  .meta{ margin-top:24px; display:flex; gap:26px; }
  .meta .m{ font-family:"Oswald",sans-serif; text-transform:uppercase; letter-spacing:1.5px; font-size:12px; color:#e7d9b0; }
  .meta .m b{ display:block; font-family:"Lilita One",sans-serif; font-size:24px; color:var(--gold-br); letter-spacing:0; }

  /* Anatomy */
  .anat{ display:flex; gap:20px; align-items:center; }
  .anat .cardwrap{ position:relative; flex:0 0 auto; }
  .anat .dot{ position:absolute; width:22px; height:22px; border-radius:50%; background:var(--gold); color:#3a2c0a;
    font-family:"Lilita One",sans-serif; font-size:13px; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 5px rgba(0,0,0,.35); border:2px solid #fff; }
  .anat ol{ list-style:none; }
  .anat ol li{ position:relative; padding:6px 0 6px 32px; font-size:13.5px; line-height:1.4; border-bottom:1px solid var(--rule); }
  .anat ol li:last-child{ border-bottom:none; }
  .anat .n{ position:absolute; left:0; top:6px; width:21px; height:21px; border-radius:50%; background:var(--green); color:#fff;
    font-family:"Lilita One",sans-serif; font-size:12px; display:flex; align-items:center; justify-content:center; }
  .anat b{ font-family:"Oswald",sans-serif; text-transform:uppercase; letter-spacing:.5px; color:var(--green); }
  .two{ display:flex; gap:24px; }
  .two > div{ flex:1; }
</style></head><body>

<!-- ============ COVER ============ -->
<section class="page cover"><div class="inner">
  <div class="kicker">A Deckbuilding Poker Duel</div>
  <div class="title">KAIZEN<br/>POKER</div>
  <div class="tagline">Sculpt the perfect deck.</div>
  <div class="fan">
    <img src="${img.Banish}"   style="width:150px; transform:translateX(-330px) rotate(-22deg); top:34px;"/>
    <img src="${img.Salvage}"  style="width:158px; transform:translateX(-185px) rotate(-11deg); top:8px;"/>
    <img src="${img.Brainstorm}" style="width:166px; transform:translateX(-83px) rotate(0deg); top:-2px; z-index:3;"/>
    <img src="${img.Disguise}" style="width:158px; transform:translateX(27px) rotate(11deg); top:8px;"/>
    <img src="${img.Cultivate}" style="width:150px; transform:translateX(180px) rotate(22deg); top:34px;"/>
  </div>
  <div class="meta">
    <div class="m">Players<b>2–4</b></div>
    <div class="m">Time<b>25–35′</b></div>
    <div class="m">Ages<b>10+</b></div>
  </div>
</div></section>

<!-- ============ PAGE 2 ============ -->
<section class="page"><div class="inner">
  ${sec(1, "Overview")}
  <p class="lead">Each round, players take turns playing Actions, then simultaneously make the best poker hand they can. The catch: every card you spend on its Action is a card you can’t score.</p>
  <p>The game is best with 2 players; add a second 52-card deck to play 3 or 4. A game runs about 25–35 minutes.</p>

  ${sec(2, "Components")}
  <p><b>52 cards · 13 chips.</b> One deck supports a two-player game. For 3–4 players, combine two 52-card decks.</p>

  ${sec(3, "Setup")}
  <ol class="phases">
    <li><span class="pn">1</span><b>Decks.</b> Shuffle all cards and deal 26 to each player — these are your decks. Set any leftovers aside.</li>
    <li><span class="pn">2</span><b>First player.</b> The player with the best poker face goes first.</li>
  </ol>

  ${sec(4, "Objective")}
  <p>Each round, the best poker hand wins one of the 13 chips. The first player to an insurmountable lead — <b>7 chips</b> in a two-player game — wins.</p>

  ${flourish(["Forecast", "Improvise", "Explore"])}
  <div class="foot"><span>Kaizen Poker</span><span>2</span></div>
</div></section>

<!-- ============ PAGE 3 — HOW TO PLAY ============ -->
<section class="page"><div class="inner">
  ${sec(5, "How to Play")}
  <p>Each round has four phases:</p>
  <ol class="phases">
    <li><span class="pn">1</span><b>Draw.</b> Each player draws seven cards.</li>
    <li><span class="pn">2</span><b>Action.</b> In clockwise turn order, each player plays two cards as Actions, resolving each as it is played.</li>
    <li><span class="pn">3</span><b>Score.</b> Five cards now remain in hand. All players reveal at once; the best five-card poker hand wins a chip.</li>
    <li><span class="pn">4</span><b>Cleanup.</b> Move every played Action and revealed scoring card to its owner’s discard pile.</li>
  </ol>
  <div class="note"><span class="lbl">New to the game?</span><p>Learn the rhythm with <b>Introductory Mode</b> (back page) before using the printed Action abilities.</p></div>

  <div class="sub">Anatomy of a Card</div>
  <div class="anat">
    <div class="cardwrap">
      ${card("Brainstorm", 168)}
      <div class="dot" style="top:14px; left:14px;">1</div>
      <div class="dot" style="top:96px; left:-9px;">2</div>
      <div class="dot" style="bottom:74px; right:8px;">3</div>
      <div class="dot" style="bottom:30px; right:8px;">4</div>
    </div>
    <ol>
      <li><span class="n">1</span><b>Rank &amp; Suit.</b> Doubles as your scoring material when the card stays in hand.</li>
      <li><span class="n">2</span><b>Name.</b> The card’s identity.</li>
      <li><span class="n">3</span><b>Type.</b> When and how the Action resolves (see <em>Action Types</em>).</li>
      <li><span class="n">4</span><b>Ability.</b> What the Action does.</li>
    </ol>
  </div>
  <div class="foot"><span>Kaizen Poker</span><span>3</span></div>
</div></section>

<!-- ============ PAGE 4 — DETAILS ============ -->
<section class="page"><div class="inner">
  ${sec(6, "Action Types")}
  <ul class="types">
    ${TYPES.map(([t, c, d]) => `<li><span class="tlbl" style="background:${c}">${t}</span>${d}</li>`).join("")}
  </ul>
  <div class="note"><span class="lbl">Refresh</span><p>Instead of its printed Action, any card may be played <b>face down</b> as a Refresh: discard a card, then draw a card.</p></div>
  <div class="note"><span class="lbl">Modify, by example</span><p>Play <b>Nudge</b> as an Action. At scoring, assign it to one of your five cards to shift that card’s rank by one — turning a near-miss into a straight.</p></div>

  ${sec(7, "Table &amp; Terms")}
  <div class="sub">Layout</div>
  <p>Keep your deck and discard to one side. Lay Actions side by side so both players can read them, and when you reveal your scoring hand, make clear which cards any Modify is altering.</p>
  <div class="sub">Vocabulary</div>
  <ul class="vocab">
    <li><b>Scrap</b> — move a card from your <em>discard</em> (never your hand) to the scrap pile, shared by both players.</li>
    <li><b>Draw</b> — take the top card of your deck. If your deck is empty, shuffle your discard face down into a new deck and keep drawing.</li>
    <li><b>Target</b> — specify. If there is no legal target, the Action cannot resolve.</li>
  </ul>
  ${typestrip()}
  <div class="foot"><span>Kaizen Poker</span><span>4</span></div>
</div></section>

<!-- ============ PAGE 5 — HAND RANKINGS ============ -->
<section class="page"><div class="inner">
  ${sec(8, "Hand Rankings")}
  <p>Five-card hands, lowest to highest. Beyond the classics, Kaizen Poker recognizes four special hands (in gold).</p>
  <table>
    <thead><tr><th style="width:30px"></th><th>Hand</th><th>What it is</th></tr></thead>
    <tbody>
      ${HANDS.map(([h, d, sp], i) => `<tr class="${sp ? "special" : ""}"><td class="hand-rank">${i + 1}</td><td class="${sp ? "h" : ""}" style="font-weight:600">${h}</td><td>${d}</td></tr>`).join("")}
    </tbody>
  </table>
  <div class="note"><span class="lbl">Ties</span><p>Identical hands split nothing — no chip is awarded that round.</p></div>
  ${flourish(["Buff", "Vanish", "Reanimate"])}
  <div class="foot"><span>Kaizen Poker</span><span>5</span></div>
</div></section>

<!-- ============ PAGE 6 — ENDING + THEMES ============ -->
<section class="page"><div class="inner">
  ${sec(9, "Ending the Game")}
  <p>The first player to <b>7 of the 13 chips</b> wins. Two rules sharpen the endgame:</p>
  <div class="note"><span class="lbl">Sudden Death</span><p>At the start of any round in which a player could win, every <em>other</em> player draws eight cards and plays three Actions — still scoring five.</p></div>
  <div class="note"><span class="lbl">Running Dry</span><p>If a player cannot draw a full hand at the start of a round — even after reshuffling — they lose the game.</p></div>

  ${sec(10, "The Deck at a Glance")}
  <ul class="themes">
    <li><b>2s</b> — Enact; scrap a discard card of the listed suits.</li>
    <li><b>3s</b> — quick card selection.</li>
    <li><b>4s</b> — search out specific cards; discard as directed.</li>
    <li><b>5s &amp; Aces</b> — return an Action from play to your hand.</li>
    <li><b>6s &amp; 7s</b> — disrupt opponents, or steal from them.</li>
    <li><b>8s &amp; 9s</b> — scrap cards of various kinds.</li>
    <li><b>10s</b> — alter one scoring card’s rank or suit.</li>
    <li><b>Js</b> — some modify a scoring card; others enter as copies of an Action.</li>
    <li><b>Qs</b> — inert as Actions, but rewrite the rules for both players while scrapped.</li>
    <li><b>Ks</b> — big, splashy effects.</li>
    <li><b>As</b> — “go up a rank,” and grant an extra Action.</li>
  </ul>
  ${flourish(["Trim", "Mill", "Bury"])}
  <div class="foot"><span>Kaizen Poker</span><span>6</span></div>
</div></section>

<!-- ============ PAGE 7 — SOLO ============ -->
<section class="page"><div class="inner">
  ${sec(11, "Solo Variant")}
  <p>Deal two piles of 26: one is your deck, the other the <b>Challenger’s</b>. Play rounds as normal — draw seven, play two, score five. When you reveal your hand, flip the top card of the Challenger’s deck; its rank names the hand the Challenger made:</p>
  <table>
    <thead><tr><th>Card</th><th>Challenger’s hand</th></tr></thead>
    <tbody>
      ${CHALLENGER.map(([r, h]) => `<tr><td class="r">${r}</td><td>${h}</td></tr>`).join("")}
    </tbody>
  </table>
  <div class="note"><span class="lbl">Scoring</span><p>Beat the Challenger to take the chip; ties go to the Challenger. Play until the chips run out (about 13 rounds). Your final margin is your score — <b>7 or better is a win</b>. Cards that target an opponent do little here; consider cutting them from your deck.</p></div>
  ${flourish(["Curse", "Exchange", "Terminate"])}
  <div class="foot"><span>Kaizen Poker</span><span>7</span></div>
</div></section>

<!-- ============ PAGE 8 — INTRO MODE ============ -->
<section class="page"><div class="inner">
  ${sec(12, "Introductory Mode")}
  <p>To learn the rhythm, play once <b>ignoring every printed Action ability</b>. You still draw seven, play two cards as Actions, and score the remaining five — but each Action is played <em>face down</em>, and for each you choose one:</p>
  <ul class="vocab">
    <li>Draw a card, then discard a card; <em>or</em></li>
    <li>Scrap a card.</li>
  </ul>
  <p>Once the flow feels natural, start over and play with the abilities printed on the cards.</p>

  <div class="two" style="margin-top:18px; align-items:center;">
    <div>
      <div class="sub">A Note on the Art</div>
      <p style="font-size:13px">The illustrations in this prototype were generated with Google’s ImageFX, used in place of generic clip art to convey a specific direction for each card. The published edition is not intended to use generative art.</p>
    </div>
    <div style="text-align:center;">
      ${card("Sculpt", 120, -6)} ${card("Rejuvenate", 120, 6)}
    </div>
  </div>
  <div class="foot"><span>Kaizen Poker · Sculpt the perfect deck.</span><span>8</span></div>
</div></section>

</body></html>`;

const { browser, close } = await launchBrowser();
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: "load", timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 700));
  // PNG previews of each page (screen media) for review
  const pages = await page.$$(".page");
  for (let i = 0; i < pages.length; i++) {
    await pages[i].screenshot({ path: path.join(PREVIEW, `rulebook-p${i + 1}.png`) }).catch(() => {});
  }
  await page.pdf({ path: OUT_PDF, preferCSSPageSize: true, printBackground: true });
  console.log("wrote", OUT_PDF);
  console.log("previews in", PREVIEW);
} finally {
  await close();
}
