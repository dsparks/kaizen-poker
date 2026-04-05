import { useEffect, useMemo, useRef, useState } from "react";

export default function Chippy({ title = "Chippy", message = "", visible = true, actionLabel = "", onAction = null }) {
  const rootRef = useRef(null);
  const dragRef = useRef(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [placed, setPlaced] = useState(false);

  useEffect(() => {
    if (!visible) return undefined;
    const onMove = e => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [visible]);

  useEffect(() => {
    if (!visible || placed || typeof window === "undefined") return;
    setPos({
      x: Math.max(16, window.innerWidth - 500),
      y: Math.max(16, window.innerHeight - 170),
    });
    setPlaced(true);
  }, [visible, placed]);

  useEffect(() => {
    const onMove = e => {
      if (!dragRef.current) return;
      const { dx, dy } = dragRef.current;
      const nextX = Math.max(8, Math.min(window.innerWidth - 120, e.clientX - dx));
      const nextY = Math.max(8, Math.min(window.innerHeight - 110, e.clientY - dy));
      setPos({ x: nextX, y: nextY });
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const pupils = useMemo(() => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } };
    const mk = (cx, cy) => {
      const dx = mouse.x - cx;
      const dy = mouse.y - cy;
      const mag = Math.max(1, Math.hypot(dx, dy));
      const max = 5;
      return { x: (dx / mag) * max, y: (dy / mag) * max };
    };
    return {
      left: mk(rect.left + 28, rect.top + 26),
      right: mk(rect.left + 56, rect.top + 26),
    };
  }, [mouse]);

  if (!visible || !message) return null;

  const startDrag = e => {
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
  };

  return (
    <div
      onMouseDown={startDrag}
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 1205,
        display: "flex",
        alignItems: "flex-end",
        gap: 12,
        pointerEvents: "auto",
        cursor: "grab",
        userSelect: "none",
      }}
    >
      <div
        style={{
          maxWidth: 360,
          padding: "12px 14px",
          borderRadius: 16,
          border: "1px solid #8fc5ff66",
          background: "linear-gradient(180deg,#132333f0,#0d1824f4)",
          color: "#dbeafe",
          boxShadow: "0 18px 40px #00000050, inset 0 1px 0 #ffffff18",
          position: "relative",
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: "#8fd0ff", marginBottom: 6 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.5 }}>{message}</div>
        {actionLabel && onAction && (
          <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={e => {
                e.stopPropagation();
                onAction();
              }}
              style={{
                pointerEvents: "auto",
                padding: "6px 12px",
                borderRadius: 999,
                border: "1px solid #8fc5ff66",
                background: "linear-gradient(180deg,#1f4d74,#173a59)",
                color: "#eaf6ff",
                fontSize: 11,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "inset 0 1px 0 #ffffff18",
              }}
            >
              {actionLabel}
            </button>
          </div>
        )}
        <div
          style={{
            position: "absolute",
            right: -8,
            bottom: 20,
            width: 16,
            height: 16,
            background: "#132333f0",
            borderRight: "1px solid #8fc5ff66",
            borderBottom: "1px solid #8fc5ff66",
            transform: "rotate(-45deg)",
          }}
        />
      </div>
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
          left: 8 + pupil.x,
          top: 8 + pupil.y,
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "#12263a",
        }}
      />
    </div>
  );
}
