const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
};

const jsonHeaders = {
  ...headers,
  Prefer: "return=representation",
};

const isConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const mkId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `kp-live-${Date.now()}-${Math.random().toString(16).slice(2)}`);

function tableUrl(path = "") {
  return `${SUPABASE_URL}/rest/v1/live_games${path}`;
}

async function readJson(res, fallbackMessage) {
  if (!res.ok) {
    let detail = fallbackMessage;
    try {
      const body = await res.json();
      detail = body?.message || body?.error || body?.hint || fallbackMessage;
    } catch {}
    throw new Error(detail);
  }
  return res.status === 204 ? null : res.json();
}

export function multiplayerEnabled() {
  return isConfigured();
}

export function makeSeatToken() {
  return mkId();
}

export async function createLiveGame({ gameId, state, tracked, playerAToken }) {
  if (!isConfigured()) throw new Error("Supabase is not configured for multiplayer.");
  const row = {
    id: gameId || mkId(),
    mode: "online",
    status: "waiting",
    state,
    tracked: tracked || null,
    version: 1,
    player_a_token: playerAToken,
    player_b_token: null,
  };
  const res = await fetch(tableUrl(""), {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(row),
  });
  const body = await readJson(res, "Unable to create online game.");
  return Array.isArray(body) ? body[0] : body;
}

export async function fetchLiveGame(gameId) {
  if (!isConfigured()) throw new Error("Supabase is not configured for multiplayer.");
  const res = await fetch(tableUrl(`?id=eq.${encodeURIComponent(gameId)}&select=*`), {
    method: "GET",
    headers,
  });
  const body = await readJson(res, "Unable to load online game.");
  return Array.isArray(body) ? body[0] || null : body;
}

export async function claimSeat(gameId, seat, token) {
  if (!isConfigured()) throw new Error("Supabase is not configured for multiplayer.");
  const seatColumn = seat === "A" ? "player_a_token" : "player_b_token";
  const nullFilter = `${seatColumn}=is.null`;
  const res = await fetch(tableUrl(`?id=eq.${encodeURIComponent(gameId)}&${nullFilter}`), {
    method: "PATCH",
    headers: jsonHeaders,
    body: JSON.stringify({ [seatColumn]: token, status: "active" }),
  });
  const body = await readJson(res, `Unable to claim seat ${seat}.`);
  return Array.isArray(body) ? body[0] || null : body;
}

export async function updateLiveGame({ gameId, state, tracked, expectedVersion, seat, token, status }) {
  if (!isConfigured()) throw new Error("Supabase is not configured for multiplayer.");
  const seatColumn = seat === "A" ? "player_a_token" : "player_b_token";
  const query = `?id=eq.${encodeURIComponent(gameId)}&version=eq.${expectedVersion}&${seatColumn}=eq.${encodeURIComponent(token)}&select=*`;
  const res = await fetch(tableUrl(query), {
    method: "PATCH",
    headers: jsonHeaders,
    body: JSON.stringify({
      state,
      tracked: tracked || null,
      version: expectedVersion + 1,
      status: status || "active",
      updated_at: new Date().toISOString(),
    }),
  });
  const body = await readJson(res, "Unable to update online game.");
  if (Array.isArray(body) && !body.length) throw new Error("Online game changed in another browser. Resyncing.");
  return Array.isArray(body) ? body[0] || null : body;
}
