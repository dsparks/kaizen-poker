// Card Gallery: "The Viewing Glass". The deck is scattered on a table with a
// brass magnifying glass; whatever card is under the glass shows its printed
// (illustrated) version large in the side panel. Drag cards under the glass,
// double-click/tap one to send it there, or cycle with the arrow keys/buttons.
// "Full screen" opens a zoomable view of the print. Table cards render in the
// player's chosen aesthetic (CardRenderContext); the panel always shows the print.
// Styles: .kp-glass* in theme.css. Positions are written straight to the DOM
// (refs) so dragging never re-renders 52 cards.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CARDS, CM, RO, SO, SC, TI } from "./gameData.js";
import { getRenderedCardSrc } from "./renderedCardImageMap.js";
import { Btn, BTN_PRIMARY, BTN_QUIET, Card, SUIT_NAMES } from "./components.jsx";

const ORDER = SO.flatMap(s => RO.map(r => CARDS.find(c => c.rank === r && c.suit === s))).filter(Boolean).map(c => c.id);
const RANK_NAMES = { J: "Jack", Q: "Queen", K: "King", A: "Ace" };
const rankLabel = c => `${RANK_NAMES[c.rank] || c.rank} of ${SUIT_NAMES[c.suit]}`;
const PRINT_RATIO = 816 / 1110;
const CARD_PX = 180; // the full-size Card component's width; zoomed down to table size
const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// The print in the side panel; flips in from the direction you're moving.
function PrintFlip({ id, dir, onOpen }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (reducedMotion() || !ref.current) return;
    ref.current.animate(
      [{ transform: `rotateY(${dir * 75}deg) translateX(${dir * 50}px)`, opacity: 0 }, { transform: "none", opacity: 1 }],
      { duration: 540, easing: "cubic-bezier(.2,.9,.25,1)" },
    );
  }, [id, dir]);
  const c = CM[id];
  return <button ref={ref} type="button" className="kp-glass-print" onClick={onOpen} aria-label={`${c.name}, printed card. Open full screen`}>
    <img src={getRenderedCardSrc(c.name)} alt="" draggable={false} />
  </button>;
}

// Full-screen print: wheel / pinch / double-click to zoom, drag to pan.
function ZoomViewer({ id, onClose, onStep }) {
  const frameRef = useRef(null), imgRef = useRef(null), closeRef = useRef(null);
  const z = useRef({ s: 1, x: 0, y: 0 }), ptrs = useRef(new Map()), pinch = useRef(null);
  const [box, setBox] = useState(null);
  const fit = useCallback(() => {
    const top = 64, bottom = 96, side = window.innerWidth < 700 ? 12 : 90;
    const maxH = window.innerHeight - top - bottom, maxW = window.innerWidth - side * 2;
    const h = Math.min(maxH, maxW / PRINT_RATIO), w = h * PRINT_RATIO;
    setBox({ left: (window.innerWidth - w) / 2, top: top + (maxH - h) / 2, width: w, height: h });
  }, []);
  const apply = () => {
    const f = frameRef.current; if (!f || !imgRef.current) return;
    const w = f.clientWidth, h = f.clientHeight, s = z.current;
    s.x = Math.min(0, Math.max(w - w * s.s, s.x)); s.y = Math.min(0, Math.max(h - h * s.s, s.y));
    imgRef.current.style.transform = `translate(${s.x}px,${s.y}px) scale(${s.s})`;
    f.classList.toggle("zoomed", s.s > 1.01);
  };
  const zoomAt = (scale, cx, cy) => {
    const r = frameRef.current.getBoundingClientRect(), s = z.current, n = Math.max(1, Math.min(4, scale));
    const mx = cx - r.left, my = cy - r.top;
    s.x = mx - (mx - s.x) * (n / s.s); s.y = my - (my - s.y) * (n / s.s); s.s = n; apply();
  };
  useLayoutEffect(() => { fit(); }, [fit]);
  useEffect(() => { z.current = { s: 1, x: 0, y: 0 }; apply(); }, [id]);
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    window.addEventListener("resize", fit);
    const f = frameRef.current;
    const wheel = e => { e.preventDefault(); zoomAt(z.current.s * Math.exp(-e.deltaY * .0016), e.clientX, e.clientY); };
    f?.addEventListener("wheel", wheel, { passive: false });
    return () => { window.removeEventListener("resize", fit); f?.removeEventListener("wheel", wheel); };
  }, [fit, box === null]);
  const c = CM[id];
  return <div className="kp-glass-zoom" role="dialog" aria-modal="true" aria-label={`${c.name}, printed card`}>
    <div className="kp-glass-zoom-bg" onClick={onClose} />
    {box && <div ref={frameRef} className="kp-glass-zoom-frame" style={box}
      onDoubleClick={e => zoomAt(z.current.s > 1.4 ? 1 : 2.6, e.clientX, e.clientY)}
      onPointerDown={e => { ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); e.currentTarget.setPointerCapture(e.pointerId); if (ptrs.current.size === 2) { const [a, b] = [...ptrs.current.values()]; pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), s: z.current.s }; } }}
      onPointerMove={e => {
        const p = ptrs.current.get(e.pointerId); if (!p) return;
        if (ptrs.current.size === 2 && pinch.current) { p.x = e.clientX; p.y = e.clientY; const [a, b] = [...ptrs.current.values()]; zoomAt(pinch.current.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.d, (a.x + b.x) / 2, (a.y + b.y) / 2); return; }
        if (z.current.s > 1.01) { z.current.x += e.clientX - p.x; z.current.y += e.clientY - p.y; apply(); }
        p.x = e.clientX; p.y = e.clientY;
      }}
      onPointerUp={e => { ptrs.current.delete(e.pointerId); if (ptrs.current.size < 2) pinch.current = null; }}
      onPointerCancel={e => { ptrs.current.delete(e.pointerId); pinch.current = null; }}>
      <img ref={imgRef} src={getRenderedCardSrc(c.name)} alt="" draggable={false} onLoad={apply} />
    </div>}
    <div className="kp-glass-zoom-cap">
      <span style={{ color: SC[c.suit] }}>{rankLabel(c)}</span> · <span style={{ color: TI[c.type].bd }}>{c.type}</span>
      <strong>{c.name}</strong>
      <small>Scroll, pinch or double-click to zoom · drag to pan · ← → to browse · Esc to close</small>
    </div>
    <button type="button" className="kp-glass-zoom-btn prev" aria-label="Previous card" onClick={() => onStep(-1)}>‹</button>
    <button type="button" className="kp-glass-zoom-btn next" aria-label="Next card" onClick={() => onStep(1)}>›</button>
    <button ref={closeRef} type="button" className="kp-glass-zoom-btn close" aria-label="Close" onClick={onClose}>✕</button>
  </div>;
}

export default function GalleryGlass({ compact = false, onCardShown }) {
  const tableRef = useRef(null), lensRef = useRef(null), cloneRef = useRef(null);
  const els = useRef({}), items = useRef({}), geo = useRef({ w: 86, h: 120, L: 210, M: 1.85, lx: 0, ly: 0 });
  const drag = useRef(null), lastTap = useRef({ t: 0, id: null }), zTop = useRef(60), curRef = useRef(null);
  const lens = useRef({ id: null, transform: "", opacity: 0, animate: false, focused: false });
  const [cardW, setCardW] = useState(86);
  const [cur, setCur] = useState(null);
  const [dir, setDir] = useState(1);
  const [lensId, setLensId] = useState(null);
  const [full, setFull] = useState(false);
  const RM = reducedMotion();

  const pos = it => {
    const el = els.current[it.id]; if (!el) return;
    el.style.transform = `translate(${it.x.toFixed(1)}px,${it.y.toFixed(1)}px) rotate(${it.r.toFixed(2)}deg) scale(${it.held ? 1.08 : 1})`;
    el.style.zIndex = it.z;
  };
  const glide = (it, x, y, r, ms = 650) => {
    const el = els.current[it.id]; Object.assign(it, { x, y, r });
    if (el) { el.style.transition = RM ? "none" : `transform ${ms}ms cubic-bezier(.2,.9,.2,1)`; clearTimeout(it.t); it.t = setTimeout(() => { el.style.transition = ""; }, ms + 30); }
    pos(it);
  };
  const randomSpot = () => {
    const g = geo.current, t = tableRef.current, maxX = g.lx - g.L / 2 - g.w - 24;
    return { x: 8 + Math.random() * Math.max(30, maxX - 8), y: 56 + Math.random() * Math.max(20, t.clientHeight - g.h - 64), r: (Math.random() - .5) * 60 };
  };
  const overGlass = it => { const g = geo.current; return Math.hypot(it.x + g.w / 2 - g.lx, it.y + g.h / 2 - g.ly) < g.L * .46; };

  // The glass shows a magnified clone of the card under it.
  const applyLens = () => {
    const el = cloneRef.current, s = lens.current;
    lensRef.current?.classList.toggle("focused", !!s.focused);
    if (!el) return;
    el.style.transition = s.animate && !RM ? "transform .65s cubic-bezier(.2,.9,.2,1), opacity .2s" : "opacity .2s";
    el.style.opacity = s.opacity; el.style.transform = s.transform;
  };
  const showLens = (it, animate) => {
    if (!it) { lens.current = { ...lens.current, opacity: 0, focused: false }; applyLens(); return; }
    const g = geo.current, cx = it.x + g.w / 2, cy = it.y + g.h / 2;
    const changed = lens.current.id !== it.id;
    lens.current = {
      id: it.id, opacity: 1, animate: animate && !changed, focused: Math.hypot(cx - g.lx, cy - g.ly) < g.L * .5,
      transform: `translate(-50%,-50%) translate(${((cx - g.lx) * g.M).toFixed(1)}px,${((cy - g.ly) * g.M).toFixed(1)}px) rotate(${it.r.toFixed(2)}deg) scale(${g.M})`,
    };
    if (changed) setLensId(it.id); else applyLens();
  };
  useLayoutEffect(applyLens, [lensId, cardW]);

  const eject = it => { const s = randomSpot(); glide(it, s.x, s.y, s.r); };
  const place = useCallback((id, d = 1) => {
    const it = items.current[id]; if (!it) return;
    const prev = curRef.current;
    if (prev && prev !== id) eject(items.current[prev]);
    curRef.current = id; it.z = ++zTop.current;
    const g = geo.current;
    glide(it, g.lx - g.w / 2, g.ly - g.h / 2, 0);
    showLens(it, true);
    setDir(d); setCur(id); onCardShown?.(id);
  }, [onCardShown]);
  const clear = () => { curRef.current = null; setCur(null); showLens(null); };
  const cycle = useCallback(d => {
    const i = curRef.current ? ORDER.indexOf(curRef.current) : (d > 0 ? -1 : 0);
    place(ORDER[(i + d + ORDER.length) % ORDER.length], d);
  }, [place]);

  const layout = useCallback(() => {
    const t = tableRef.current; if (!t) return;
    const W = t.clientWidth, H = t.clientHeight, small = compact || W < 560;
    const w = small ? 64 : 86, L = small ? 150 : 206;
    geo.current = { w, h: w * (252 / 180), L, M: 1.85, lx: W - L / 2 - (small ? 22 : 44), ly: H / 2 + 8 };
    const lensEl = lensRef.current;
    if (lensEl) { lensEl.style.setProperty("--L", L + "px"); lensEl.style.left = (geo.current.lx - L / 2) + "px"; lensEl.style.top = (geo.current.ly - L / 2) + "px"; }
    setCardW(w);
  }, [compact]);

  // First layout: scatter the deck and start with the Ace of Spades under the glass.
  useLayoutEffect(() => {
    layout();
    ORDER.forEach((id, i) => { items.current[id] = { id, ...randomSpot(), z: i + 1, held: false }; pos(items.current[id]); });
    place("AS");
    const onResize = () => {
      layout();
      const g = geo.current, t = tableRef.current;
      Object.values(items.current).forEach(it => {
        if (it.id === curRef.current) return;
        it.x = Math.min(Math.max(-g.w * .3, it.x), t.clientWidth - g.w * .7); it.y = Math.min(Math.max(48, it.y), t.clientHeight - g.h * .7); pos(it);
      });
      if (curRef.current) { const it = items.current[curRef.current]; glide(it, g.lx - g.w / 2, g.ly - g.h / 2, 0, 0); showLens(it, false); }
    };
    let timer; const debounced = () => { clearTimeout(timer); timer = setTimeout(onResize, 120); };
    window.addEventListener("resize", debounced);
    return () => { window.removeEventListener("resize", debounced); clearTimeout(timer); };
  }, []);

  // Arrow keys cycle the glass (and the full-screen view); Enter opens it; Esc closes it.
  useEffect(() => {
    const onKey = e => {
      if (e.target?.closest?.("input,textarea")) return;
      if (e.key === "ArrowRight" || (!full && e.key === "ArrowDown")) { cycle(1); e.preventDefault(); }
      if (e.key === "ArrowLeft" || (!full && e.key === "ArrowUp")) { cycle(-1); e.preventDefault(); }
      if (e.key === "Enter" && !full && curRef.current && !e.target?.closest?.("button")) { setFull(true); e.preventDefault(); }
      if (e.key === "Escape" && full) { setFull(false); e.preventDefault(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cycle, full]);

  const onPointerDown = e => {
    const el = e.target.closest(".kp-glass-card"); if (!el) return;
    const it = items.current[el.dataset.id], r = tableRef.current.getBoundingClientRect();
    it.held = true; it.z = ++zTop.current; el.style.transition = ""; el.classList.add("held");
    drag.current = { it, el, ox: e.clientX - r.left - it.x, oy: e.clientY - r.top - it.y, sx: e.clientX, sy: e.clientY };
    tableRef.current.setPointerCapture(e.pointerId); pos(it); e.preventDefault();
  };
  const onPointerMove = e => {
    const d = drag.current; if (!d) return;
    const r = tableRef.current.getBoundingClientRect();
    d.it.x = e.clientX - r.left - d.ox; d.it.y = e.clientY - r.top - d.oy; d.it.r *= .93; pos(d.it);
    const curIt = curRef.current ? items.current[curRef.current] : null;
    showLens(overGlass(d.it) || d.it.id === curRef.current ? d.it : curIt && overGlass(curIt) ? curIt : null, false);
  };
  const onPointerUp = e => {
    const d = drag.current; if (!d) return; drag.current = null;
    const { it, el } = d; it.held = false; el.classList.remove("held");
    const tap = Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 6, now = performance.now();
    if (tap && lastTap.current.id === it.id && now - lastTap.current.t < 340) { lastTap.current = { t: 0, id: null }; place(it.id); return; }
    if (tap) lastTap.current = { t: now, id: it.id };
    if (overGlass(it)) {
      if (curRef.current === it.id) { const g = geo.current; glide(it, g.lx - g.w / 2, g.ly - g.h / 2, 0, 320); showLens(it, true); }
      else place(it.id);
      return;
    }
    if (curRef.current === it.id) clear();
    pos(it);
  };

  const scatter = () => Object.values(items.current).forEach(it => { if (it.id !== curRef.current) { const s = randomSpot(); glide(it, s.x, s.y, s.r, 800); } });
  const tidy = () => {
    const g = geo.current, maxX = g.lx - g.L / 2 - 16, cols = Math.max(4, Math.floor((maxX - 8) / (g.w * .62))), gx = (maxX - 8 - g.w) / (cols - 1);
    ORDER.filter(id => id !== curRef.current).forEach((id, i) => { const it = items.current[id]; it.z = i + 1; glide(it, 8 + (i % cols) * gx, 56 + Math.floor(i / cols) * g.h * .5, 0, 800); });
  };

  const zoom = cardW / CARD_PX;
  const c = cur ? CM[cur] : null;
  return <div className="kp-glass">
    <div ref={tableRef} className="kp-glass-table" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      aria-label="Card table. Drag a card under the magnifying glass, double-click a card, or use the arrow keys.">
      <div className="kp-glass-tools"><button type="button" className="kp-pill kp-touch-control" onClick={scatter}>Scatter</button><button type="button" className="kp-pill kp-touch-control" onClick={tidy}>Tidy</button></div>
      {ORDER.map(id => <div key={id} ref={el => { els.current[id] = el; }} data-id={id} className={`kp-glass-card${id === cur ? " on-glass" : ""}`}>
        <div style={{ zoom }}><Card id={id} /></div>
      </div>)}
      <div ref={lensRef} className="kp-glass-lens" aria-hidden="true">
        <div className="kp-glass-handle" />
        <div className="kp-glass-view">{lensId && <div ref={cloneRef} className="kp-glass-clone"><div style={{ zoom }}><Card id={lensId} /></div></div>}</div>
        <div className="kp-glass-ring" />
        <div className="kp-glass-hint">Slide a card under the glass</div>
      </div>
    </div>
    <aside className="kp-glass-panel" aria-label="Printed card">
      <div className="kp-glass-frame">
        {c ? <PrintFlip key={cur} id={cur} dir={dir} onOpen={() => setFull(true)} />
          : <div className="kp-glass-empty">The glass is empty<span>Drag a card under it, or press →</span></div>}
      </div>
      <div className="kp-glass-cap" aria-live="polite">
        {c && <>
          <div className="kp-glass-sub"><span style={{ color: SC[c.suit] }}>{rankLabel(c)}</span> · <span style={{ color: TI[c.type].bd }}>{c.type}</span></div>
          <h2>{c.name}</h2>
          <p>{c.text}</p>
        </>}
      </div>
      <div className="kp-glass-ctl">
        <Btn label="‹ Prev" bg={BTN_QUIET} onClick={() => cycle(-1)} />
        <Btn label="Full screen" bg={BTN_PRIMARY} onClick={() => curRef.current && setFull(true)} disabled={!c} />
        <Btn label="Next ›" bg={BTN_QUIET} onClick={() => cycle(1)} />
      </div>
    </aside>
    {full && cur && <ZoomViewer id={cur} onClose={() => setFull(false)} onStep={cycle} />}
  </div>;
}
