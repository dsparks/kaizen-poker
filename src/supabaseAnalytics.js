import { deriveAnalyticsRows } from "./analytics.js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SYNC_ENABLED = import.meta.env.VITE_ENABLE_ANALYTICS_SYNC === "true";

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal,resolution=merge-duplicates",
};

const isConfigured = () => Boolean(SYNC_ENABLED && SUPABASE_URL && SUPABASE_ANON_KEY);

async function restUpsert(table, rows, onConflict) {
  if (!rows || (Array.isArray(rows) && !rows.length) || !isConfigured()) return;
  const qs = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : "";
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}${qs}`, {
    method: "POST",
    headers,
    body: JSON.stringify(rows),
  });
  if (!response.ok) throw new Error(`Supabase upsert failed for ${table}: ${response.status}`);
}

function gameRow(tracked) {
  const winnerSlot = tracked.outcome?.winner === "TIE" ? null : tracked.outcome?.winner || null;
  return {
    id: tracked.gameId,
    status: tracked.finishedAt ? "finished" : "active",
    mode: tracked.source,
    winner_player_slot: winnerSlot,
    winner_profile_id: winnerSlot ? tracked.players[winnerSlot]?.profileId || null : null,
    a_profile_id: tracked.players.A?.profileId || null,
    b_profile_id: tracked.players.B?.profileId || null,
    started_at: tracked.startedAt,
    finished_at: tracked.finishedAt || null,
    app_version: tracked.appVersion,
    rules_version: tracked.rulesVersion,
    source: tracked.source,
    final_state: tracked.finalState || null,
  };
}

function initialStateRow(tracked) {
  const rawInitial = tracked.initialState.initialState || {};
  return {
    game_id: tracked.gameId,
    a_initial_deck: tracked.initialState.aInitialDeck,
    b_initial_deck: tracked.initialState.bInitialDeck,
    a_initial_hand: tracked.initialState.aInitialHand,
    b_initial_hand: tracked.initialState.bInitialHand,
    a_initial_discard: rawInitial.aDiscard || [],
    b_initial_discard: rawInitial.bDiscard || [],
    initial_first_player: tracked.initialState.initialFirstPlayer,
    initial_round: tracked.initialState.initialRound,
    initial_state: tracked.initialState.initialState,
  };
}

function eventRows(tracked) {
  return tracked.events.map(evt => ({
    id: evt.id,
    game_id: tracked.gameId,
    seq: evt.seq,
    round_number: evt.roundNumber,
    phase: evt.phase,
    player_slot: evt.playerSlot,
    event_type: evt.eventType,
    event_payload: evt.eventPayload,
    created_at: evt.createdAt,
  }));
}

function roundRows(tracked) {
  return tracked.rounds.map(round => ({
    id: round.id,
    game_id: tracked.gameId,
    round_number: round.roundNumber,
    first_player: round.firstPlayer,
    a_actions_required: round.aActionsRequired,
    b_actions_required: round.bActionsRequired,
    a_cards_drawn: round.aCardsDrawn,
    b_cards_drawn: round.bCardsDrawn,
    winner_player_slot: round.winnerPlayerSlot,
    a_hand_rank: round.aHandRank,
    b_hand_rank: round.bHandRank,
    round_summary: round.roundSummary,
  }));
}

function profileRows(tracked) {
  return ["A", "B"].map(slot => ({
    id: tracked.players[slot].profileId,
    auth_user_id: null,
    is_guest: tracked.players[slot].isGuest,
    display_name: tracked.players[slot].displayName || `Guest ${slot}`,
    created_at: tracked.startedAt,
  }));
}

export async function syncTrackedGame(tracked) {
  if (!tracked || !isConfigured()) return { skipped: true };
  const derived = deriveAnalyticsRows(tracked);
  await restUpsert("player_profiles", profileRows(tracked), "id");
  await restUpsert("games", [gameRow(tracked)], "id");
  await restUpsert("game_initial_state", [initialStateRow(tracked)], "game_id");
  await restUpsert("game_events", eventRows(tracked), "id");
  await restUpsert("game_rounds", roundRows(tracked), "game_id,round_number");
  await restUpsert("game_player_decks", derived.decks, "game_id,player_slot");
  await restUpsert("game_player_card_presence", derived.cardPresence, "game_id,player_slot,card_id");
  await restUpsert("game_player_card_usage", derived.cardUsage, "game_id,player_slot,card_id");
  return { skipped: false };
}

export function analyticsSyncEnabled() {
  return isConfigured();
}
