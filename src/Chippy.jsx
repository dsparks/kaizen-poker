import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

// Phones / short landscape windows: dock as a bottom sheet instead of floating.
const isCompactViewport = () => typeof window !== "undefined" && (window.innerWidth <= 700 || window.innerHeight <= 560);

export default function Chippy({
  title = "Chippy",
  message = "",
  visible = true,
  actionLabel = "",
  onAction = null,
  actionButtons = null,
  tag = null,
  initialPos = null,
  draggable = true,
}) {
  const rootRef = useRef(null);
  const boxRef = useRef(null);
  const dragRef = useRef(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [placed, setPlaced] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [compact, setCompact] = useState(isCompactViewport);

  // Each new tutorial step pops Chippy back open.
  useEffect(() => { setMinimized(false); }, [message, title]);

  useEffect(() => {
    const onResize = () => setCompact(isCompactViewport());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Eye tracking, throttled to one state update per animation frame.
  useEffect(() => {
    if (!visible || compact) return undefined;
    let frame = 0, last = null;
    const onMove = e => {
      last = { x: e.clientX, y: e.clientY };
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; setMouse(last); });
    };
    window.addEventListener("mousemove", onMove);
    return () => { window.removeEventListener("mousemove", onMove); if (frame) cancelAnimationFrame(frame); };
  }, [visible, compact]);

  useEffect(() => {
    if (!visible || placed || typeof window === "undefined") return;
    // Default: top of the board (over the action panels), clear of the hand,
    // whose rules text the tutorial is usually pointing at.
    setPos(initialPos || { x: Math.max(16, window.innerWidth - 820), y: 72 });
    setPlaced(true);
  }, [visible, placed, initialPos]);

  // Keep the whole bubble on screen (initial positions, long messages, resizes).
  useLayoutEffect(() => {
    if (compact || !placed || !boxRef.current) return;
    const r = boxRef.current.getBoundingClientRect();
    const x = Math.max(8, Math.min(window.innerWidth - r.width - 8, pos.x));
    const y = Math.max(8, Math.min(window.innerHeight - r.height - 8, pos.y));
    if (x !== pos.x || y !== pos.y) setPos({ x, y });
  });

  useEffect(() => {
    const onMove = e => {
      if (!dragRef.current) return;
      const { dx, dy } = dragRef.current;
      setPos({ x: e.clientX - dx, y: e.clientY - dy });
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const pupils = useMemo(() => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } };
    const s = rect.width / 86;
    const mk = (cx, cy) => {
      const dx = mouse.x - cx;
      const dy = mouse.y - cy;
      const mag = Math.max(1, Math.hypot(dx, dy));
      const max = 7;
      return { x: (dx / mag) * max, y: (dy / mag) * max };
    };
    return {
      left: mk(rect.left + 28 * s, rect.top + 26 * s),
      right: mk(rect.left + 56 * s, rect.top + 26 * s),
    };
  }, [mouse]);

  if (!visible || !message) return null;

  const buttons = Array.isArray(actionButtons) && actionButtons.length
    ? actionButtons
    : (actionLabel && onAction ? [{ label: actionLabel, onClick: onAction }] : []);

  const canDrag = draggable && !compact && !minimized;
  const startDrag = e => {
    if (!canDrag || e.target.closest("button")) return;
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
  };

  // Minimized: just the avatar, tucked in the corner; tap to reopen.
  if (minimized) {
    return (
      <button
        type="button"
        aria-label={`Show Chippy: ${title}`}
        onClick={() => setMinimized(false)}
        style={{ position: "fixed", right: 12, bottom: 12, zIndex: 1205, padding: 0, border: 0, background: "none", cursor: "pointer" }}
      >
        <ChippyFace rootRef={rootRef} pupils={pupils} size={56} />
      </button>
    );
  }

  return (
    <div
      ref={boxRef}
      role="dialog"
      aria-label={title}
      onPointerDown={startDrag}
      style={{
        position: "fixed",
        ...(compact
          // Docked at the top: on phones the hand (what the tutorial points at) is at the bottom.
          ? { left: 8, right: 8, top: 8, maxHeight: "48dvh", overflowY: "auto", justifyContent: "flex-end" }
          : { left: pos.x, top: pos.y }),
        zIndex: 1205,
        display: "flex",
        alignItems: "flex-end",
        gap: compact ? 8 : 12,
        pointerEvents: "auto",
        cursor: canDrag ? "grab" : "default",
        touchAction: canDrag ? "none" : "auto",
        userSelect: "none",
      }}
    >
      <div
        style={{
          maxWidth: compact ? "none" : 360,
          flex: compact ? "1 1 auto" : undefined,
          minWidth: 0,
          padding: compact ? "10px 12px" : "12px 14px",
          borderRadius: 14,
          border: "2px solid #34a3ff88",
          background: "linear-gradient(180deg,#252a4af8,#1a1d38fa)",
          color: "#e8e4f4",
          boxShadow: "0 5px 0 rgba(0,0,0,.35), 0 18px 40px #00000050, inset 0 2px 0 rgba(255,255,255,.08)",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
          <div style={{ flex: 1, fontSize: 12, fontFamily: "'Lilita One','Arial Black',sans-serif", letterSpacing: 1.2, textTransform: "uppercase", color: "#8fd0ff", textShadow: "0 2px 0 rgba(0,0,0,.35)" }}>
            {title}
          </div>
          <button
            type="button"
            aria-label="Minimize Chippy"
            title="Minimize"
            onClick={e => { e.stopPropagation(); setMinimized(true); }}
            style={{ width: 28, height: 28, marginTop: -4, marginRight: -4, borderRadius: 8, border: "1px solid #34a3ff55", background: "#12142a", color: "#8fd0ff", fontSize: 16, lineHeight: 1, cursor: "pointer", flexShrink: 0 }}
          >
            –
          </button>
        </div>
        {tag && (
          <div style={{ marginBottom: 8 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "3px 8px",
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 700,
                border: `1px solid ${tag.color}`,
                background: tag.background,
                color: tag.color,
                boxShadow: `0 0 0 1px ${tag.outline || "transparent"}, 0 0 16px ${tag.glow || "transparent"}`,
              }}
            >
              {tag.label}
            </span>
          </div>
        )}
        <div style={{ fontSize: compact ? 12 : 13, lineHeight: 1.5, whiteSpace: "pre-line" }}>{message}</div>
        {buttons.length>0 && (
          <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
            {buttons.map((button, index) => (
              <button
                key={`${button.label}-${index}`}
                onClick={e => {
                  e.stopPropagation();
                  button.onClick?.();
                }}
                className="kp-btn"
                style={{
                  pointerEvents: "auto",
                  padding: "7px 14px",
                  background: button.background || "#2173c2",
                  fontSize: 12,
                }}
              >
                {button.label}
              </button>
            ))}
          </div>
        )}
        <div
          style={{
            position: "absolute",
            right: -9,
            bottom: 20,
            width: 16,
            height: 16,
            background: "#1f2340",
            borderRight: "2px solid #34a3ff88",
            borderBottom: "2px solid #34a3ff88",
            transform: "rotate(-45deg)",
          }}
        />
      </div>
      <ChippyFace rootRef={rootRef} pupils={pupils} size={compact ? 52 : 86} />
    </div>
  );
}

// The round blue avatar. Drawn at 86px and scaled, so eyes stay proportional.
function ChippyFace({ rootRef, pupils, size = 86 }) {
  return (
    <div style={{ width: size, height: size, flexShrink: 0 }}>
      <div
        ref={rootRef}
        style={{
          width: 86,
          height: 86,
          borderRadius: "50%",
          background: "radial-gradient(circle at 35% 28%,#dff2ff 0%,#5bb8ff 22%,#2a84d4 52%,#125491 76%,#0a2c52 100%)",
          border: "5px solid #d5ecff",
          boxShadow: "0 20px 40px #00000055, inset 0 2px 0 #ffffff70",
          position: "relative",
          animation: "floatGlow 5s ease-in-out infinite",
          transform: size === 86 ? undefined : `scale(${size / 86})`,
          transformOrigin: "top left",
        }}
      >
        <div style={{ position: "absolute", inset: 9, borderRadius: "50%", border: "3px dashed #eaf6ffcc" }} />
        <Eye x={18} y={14} pupil={pupils.left} />
        <Eye x={46} y={14} pupil={pupils.right} />
        <div
          style={{
            position: "absolute",
            inset: "50px 20px 16px",
            borderRadius: "0 0 999px 999px",
            borderTop: "3px solid #e9f6ff",
            opacity: 0.9,
          }}
        />
      </div>
    </div>
  );
}

function Eye({ x, y, pupil }) {
  const pupilSize = 8;
  const eyeSize = 22;
  const pupilBase = (eyeSize - pupilSize) / 2;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 22,
        height: 22,
        borderRadius: "50%",
        background: "#f8fbff",
        border: "2px solid #103b66",
        boxShadow: "inset 0 1px 0 #ffffffcc",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: pupilBase + pupil.x,
          top: pupilBase + pupil.y,
          width: pupilSize,
          height: pupilSize,
          borderRadius: "50%",
          background: "#12263a",
        }}
      />
    </div>
  );
}
