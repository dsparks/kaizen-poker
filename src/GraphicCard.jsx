// Illustration-free card face ("Counted Rings"): the default card aesthetic.
// Production layout — rank/suit index top-left and inverted bottom-right, name
// running up a suit-colored rail on the left edge. The suit emblem encodes rank
// as layers: Ace = 1 solid glyph, 2 = solid with a paper glyph inside, 3 =
// solid/paper/solid ... King = 13, always ink outermost. A rule sits at the
// card's exact vertical center; the Action type and rules text fill the lower
// half, with the rules text sized to fit (measured once per card, cached).
// Everything is sized in cqw (the face is a size container), so one layout
// serves every card size. Styles: .kp-gc* in theme.css.
import { memo, useLayoutEffect, useRef } from "react";
import { CM } from "./gameData.js";
import { SUIT_SHAPES } from "./suitShapes.js";

// Print-safe four-color suit inks (deeper than the UI's suit colors).
const GC_SUIT_INK = { C: "#1d7a4e", D: "#c9620f", H: "#c42a22", S: "#1c3f8a" };
const GC_TYPE_INK = { Enact: "#8d6e63", Modify: "#b8892a", Amend: "#a5463b", React: "#3f7f62", Remember: "#6a57a0" };
const GC_PAPER = "#fbfbf8";
const LAYER_COUNT = { A: 1, J: 11, Q: 12, K: 13 };

function SuitPath({ suit }) {
  const s = SUIT_SHAPES[suit];
  return <path transform={s.transform} d={s.d} />;
}
export function SuitGlyph({ suit, className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><SuitPath suit={suit} /></svg>;
}
function CountedEmblem({ card }) {
  const n = LAYER_COUNT[card.rank] || Number(card.rank);
  const layers = [];
  for (let k = 0; k < n; k++) {
    const s = 1 - k / n;
    layers.push(<g key={k} transform={`translate(12 12.4) scale(${s}) translate(-12 -12.4)`} fill={k % 2 ? GC_PAPER : "currentColor"}><SuitPath suit={card.suit} /></g>);
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true">{layers}</svg>;
}

// Rules text: reminder text (in parentheses) set lighter; game keywords bold.
const KEYWORDS = /\b(Scrap|scrap|scrapped|Refresh(?:es)?|Modify|Action)\b/;
function rulesNodes(text) {
  const out = [];
  text.split(/(\([^)]*\))/).forEach((chunk, i) => {
    if (!chunk) return;
    const parts = chunk.split(new RegExp(KEYWORDS.source, "g"));
    const nodes = parts.map((p, j) => (j % 2 ? <b key={j}>{p}</b> : p));
    out.push(chunk.startsWith("(") ? <span key={i} className="kp-gc-rem">{nodes}</span> : <span key={i}>{nodes}</span>);
  });
  return out;
}
// Single-line name fitted to the rail: font size in cqw from the name length.
const fitName = (name, avail, max) => Math.min(max, avail / (name.length * 0.5)).toFixed(2) + "cqw";

// Rules-text fit, cached per card once Archivo has loaded (cqw makes the result
// size-independent). document.fonts.ready alone isn't enough: it can resolve
// before Archivo has even been requested, so load the faces we measure with.
const fitCache = new Map();
let fontsReady = typeof document === "undefined" || !document.fonts;
const fontsReadyPromise = fontsReady ? Promise.resolve() : Promise.all(
  ["500 16px Archivo", "750 16px Archivo"].map(f => document.fonts.load(f).catch(() => null)),
).then(() => { fontsReady = true; });
function measureFit(el) {
  let lo = 4.4, hi = 8.8;
  for (let i = 0; i < 10; i++) {
    const mid = (lo + hi) / 2;
    el.style.setProperty("--fs", mid + "cqw");
    if (el.scrollHeight <= el.clientHeight + 0.5) lo = mid; else hi = mid;
  }
  // lo is the largest size that *exactly* fits, so it sits on a line-wrap edge:
  // round down and back off a little so rounding or slightly different font
  // rendering can never push a line over.
  return Math.floor((lo - 0.15) * 100) / 100;
}
function useFittedRules(ref, id, enabled) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return undefined;
    let cancelled = false;
    const apply = () => {
      if (cancelled || !ref.current) return;
      const node = ref.current;
      if (fitCache.has(id)) { node.style.setProperty("--fs", fitCache.get(id) + "cqw"); return; }
      if (!node.clientHeight) return; // not laid out (hidden); try again on next mount
      const v = measureFit(node);
      node.style.setProperty("--fs", v + "cqw");
      if (fontsReady) fitCache.set(id, v);
    };
    apply();
    if (!fontsReady) fontsReadyPromise.then(apply);
    return () => { cancelled = true; };
  }, [id, enabled]);
}

export const GraphicCardFace = memo(function GraphicCardFace({ id, small = false }) {
  const c = CM[id];
  const textRef = useRef(null);
  useFittedRules(textRef, id, !small && !!c);
  if (!c) return null;
  const ten = c.rank === "10" ? " kp-gc-ten" : "";
  const index = <><span>{c.rank}</span><SuitGlyph suit={c.suit} /></>;
  return (
    <div className={`kp-gc${small ? " kp-gc-mini" : ""}`} style={{ "--suit": GC_SUIT_INK[c.suit], "--type": GC_TYPE_INK[c.type] }}>
      <div className={`kp-gc-idx${ten}`}>{index}</div>
      <div className="kp-gc-rail">
        <h3 style={{ "--nfs": fitName(c.name, 84, 10), "--nfs-mini": fitName(c.name, 76, 17) }}>{c.name}</h3>
      </div>
      <div className="kp-gc-emblem"><CountedEmblem card={c} /></div>
      {!small && <>
        <div className={`kp-gc-idx kp-gc-flip${ten}`} aria-hidden="true">{index}</div>
        <div className="kp-gc-mid" />
        <div className="kp-gc-type"><i />{c.type}</div>
        <p className="kp-gc-text" ref={textRef}><span className="kp-gc-corner" aria-hidden="true" />{rulesNodes(c.text)}</p>
      </>}
    </div>
  );
});
