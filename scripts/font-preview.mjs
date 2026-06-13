// One-off design aid: renders the vertical card name in several candidate
// fonts over real card art (both the black spade/club and white heart/diamond
// treatments) with the heavy outline, then screenshots it for comparison.
// Not wired into any npm script. Output: smoke_output/font-preview.png
import fs from "node:fs";
import path from "node:path";
import { launchBrowser } from "./edge-launcher.mjs";

const OUT = path.resolve("smoke_output");
fs.mkdirSync(OUT, { recursive: true });
const ART_DIR = path.resolve("web_art/illustrations");

const dataUri = name => {
  const buf = fs.readFileSync(path.join(ART_DIR, `${name}.webp`));
  return `data:image/webp;base64,${buf.toString("base64")}`;
};

// rank/suit/name + which art file to use. Two black-text (S/C) and two
// white-text (H/D) samples, with short and long names for fit testing.
const SAMPLES = [
  { rank: "6", suit: "S", sym: "♠", name: "Banish",     art: "Banish" },
  { rank: "9", suit: "C", sym: "♣", name: "Accumulate", art: "Accumulate" },
  { rank: "J", suit: "H", sym: "♥", name: "Brainstorm", art: "Brainstorm" },
  { rank: "Q", suit: "D", sym: "♦", name: "Camouflage", art: "Camouflage" },
];

const FONTS = [
  { label: "Lilita One (current)", family: "'Lilita One'" },
  { label: "Anton",                family: "'Anton'" },
  { label: "Oswald 700",           family: "'Oswald'", weight: 700 },
  { label: "Bebas Neue",           family: "'Bebas Neue'" },
  { label: "Fjalla One",           family: "'Fjalla One'" },
  { label: "Staatliches",          family: "'Staatliches'" },
  { label: "Archivo Black",        family: "'Archivo Black'" },
];

const GF = "https://fonts.googleapis.com/css2?family=Lilita+One&family=Anton&family=Oswald:wght@700&family=Bebas+Neue&family=Fjalla+One&family=Staatliches&family=Archivo+Black&display=swap";

const art = Object.fromEntries(SAMPLES.map(s => [s.art, dataUri(s.art)]));

const card = (s, font) => {
  const dark = s.suit === "S" || s.suit === "C";
  const textColor = dark ? "#05070a" : "#ffffff";
  const halo = dark ? "#ffffff" : "#05070a";
  const stroke = 1.5;
  const shadow = [
    `${stroke}px 0 0 ${halo}`, `-${stroke}px 0 0 ${halo}`,
    `0 ${stroke}px 0 ${halo}`, `0 -${stroke}px 0 ${halo}`,
    `${stroke}px ${stroke}px 0 ${halo}`, `-${stroke}px ${stroke}px 0 ${halo}`,
    `${stroke}px -${stroke}px 0 ${halo}`, `-${stroke}px -${stroke}px 0 ${halo}`,
    "0 2px 5px rgba(0,0,0,.5)",
  ].join(",");
  const cornerColor = dark ? "#05070a" : "#ffffff";
  const cornerHalo = dark ? "#ffffff" : "#05070a";
  const fw = font.weight || 900;
  return `
  <div style="position:relative;width:180px;height:252px;border-radius:11px;overflow:hidden;border:3px solid #f4e9d8;box-shadow:0 5px 0 rgba(0,0,0,.32),0 9px 18px rgba(0,0,0,.28);flex:0 0 auto;">
    <img src="${art[s.art]}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 42%;filter:saturate(1.04) contrast(.98);"/>
    <div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.68) 0%,rgba(0,0,0,.34) 22%,rgba(0,0,0,0) 48%);"></div>
    <div style="position:absolute;top:8px;left:7px;display:flex;align-items:center;gap:2px;font-family:'Lilita One',sans-serif;line-height:1;text-shadow:.75px 0 0 ${cornerHalo},-.75px 0 0 ${cornerHalo},0 .75px 0 ${cornerHalo},0 -.75px 0 ${cornerHalo},0 2px 4px rgba(0,0,0,.4);">
      <span style="font-size:42px;font-weight:900;color:${cornerColor};">${s.rank}</span>
      <span style="font-size:26px;color:${cornerColor};">${s.sym}</span>
    </div>
    <div style="position:absolute;left:7px;top:70px;bottom:12px;writing-mode:vertical-rl;transform:rotate(180deg);font-size:21px;font-weight:${fw};color:${textColor};font-family:${font.family},sans-serif;letter-spacing:.6px;line-height:1;text-shadow:${shadow};display:flex;align-items:center;justify-content:flex-end;white-space:nowrap;">${s.name}</div>
  </div>`;
};

const rows = FONTS.map(font => `
  <div style="display:flex;align-items:center;gap:18px;padding:18px 24px;border-bottom:1px solid rgba(255,255,255,.08);">
    <div style="width:190px;flex:0 0 auto;color:#f5f1e8;font-family:'Nunito',sans-serif;">
      <div style="font-size:20px;font-weight:800;">${font.label}</div>
      <div style="font-size:13px;color:#8d89a8;margin-top:4px;">${font.family.replace(/'/g, "")}</div>
    </div>
    ${SAMPLES.map(s => card(s, font)).join("")}
  </div>`).join("");

const html = `<!doctype html><html><head><meta charset="utf-8"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="${GF}" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@800&display=swap" rel="stylesheet"/>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:radial-gradient(ellipse at 50% -20%,#2f9c5c 0%,#1c6b3e 38%,#0c331d 75%,#06180e 100%);padding:8px 0;}</style>
</head><body>
<div style="padding:18px 24px;color:#f5b942;font-family:'Lilita One',sans-serif;font-size:26px;">Card-name font options</div>
${rows}
</body></html>`;

const { browser, close } = await launchBrowser();
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 980, height: 600, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: "load", timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(OUT, "font-preview.png"), fullPage: true });
  console.log("saved", path.join(OUT, "font-preview.png"));
} finally {
  await close();
}
