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

function rpcUrl(name){
  return `${SUPABASE_URL}/rest/v1/rpc/${name}`;
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
  const res = await fetch(rpcUrl("create_live_game"), {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      p_game_id:gameId||mkId(),
      p_state:state,
      p_tracked:tracked||null,
      p_player_a_token:playerAToken,
    }),
  });
  const body = await readJson(res, "Unable to create online game.");
  return body;
}

export async function fetchLiveGame(gameId,seatToken=null) {
  if (!isConfigured()) throw new Error("Supabase is not configured for multiplayer.");
  const res = await fetch(rpcUrl("get_live_game"), {
    method: "POST",
    headers:jsonHeaders,
    body:JSON.stringify({p_game_id:gameId,p_seat_token:seatToken}),
  });
  const body = await readJson(res, "Unable to load online game.");
  return body||null;
}

export async function claimSeat(gameId, seat, token) {
  if (!isConfigured()) throw new Error("Supabase is not configured for multiplayer.");
  if(seat!=="B")throw new Error("Only the Player B seat can be claimed.");
  const res = await fetch(rpcUrl("claim_live_game_seat"), {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({p_game_id:gameId,p_player_b_token:token}),
  });
  const body = await readJson(res, `Unable to claim seat ${seat}.`);
  return body||null;
}

export async function updateLiveGame({ gameId, state, tracked, expectedVersion, seat, token, status }) {
  if (!isConfigured()) throw new Error("Supabase is not configured for multiplayer.");
  if(!["A","B"].includes(seat))throw new Error("A claimed seat is required.");
  const res = await fetch(rpcUrl("update_live_game"), {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      p_game_id:gameId,
      p_seat_token:token,
      p_expected_version:expectedVersion,
      p_state:state,
      p_tracked:tracked||null,
      p_status:status||"active",
    }),
  });
  const body = await readJson(res, "Unable to update online game.");
  return body||null;
}
