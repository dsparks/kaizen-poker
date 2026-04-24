const hasUmami = () =>
  typeof window !== "undefined" &&
  !!window.umami &&
  typeof window.umami.track === "function";

const sanitizePayload = payload =>
  Object.fromEntries(
    Object.entries(payload || {}).filter(([, value]) => value != null && value !== "")
  );

export function trackUmami(eventName, payload = {}) {
  if (!hasUmami() || !eventName) return;
  try {
    window.umami.track(eventName, sanitizePayload(payload));
  } catch {}
}

export function trackUmamiScreen(screen, payload = {}) {
  if (!screen) return;
  const locationPayload =
    typeof window === "undefined"
      ? {}
      : {
          path: window.location.pathname,
          search: window.location.search || "",
          hash: window.location.hash || "",
          url: `${window.location.pathname}${window.location.search || ""}${window.location.hash || ""}`,
        };
  trackUmami("screen_view", { screen, ...locationPayload, ...payload });
}
