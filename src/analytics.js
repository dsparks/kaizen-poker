export const APP_VERSION = "0.1.0";
export const RULES_VERSION = "2026-04-stats-v1";
export const ANALYTICS_SOURCE = "local_hotseat";
export const SOLO_ANALYTICS_SOURCE = "solo_variant";
export const ONLINE_ANALYTICS_SOURCE = "online_guest";
export const TUTORIAL_ANALYTICS_SOURCE = "tutorial";
const ACTIVE_GAME_KEY = "kaizenPoker.activeTrackedGame";
const COMPLETED_GAMES_KEY = "kaizenPoker.completedTrackedGames";
const GUEST_PROFILE_PREFIX = "kaizenPoker.guestProfile.";

const hasStorage = () => typeof window !== "undefined" && !!window.localStorage;
const mkId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `kp-${Date.now()}-${Math.random().toString(16).slice(2)}`);
const nowIso = () => new Date().toISOString();
const clone = value => JSON.parse(JSON.stringify(value));

export function getOrCreateGuestProfile(slot, displayName = `Guest ${slot}`) {
  if (!hasStorage()) return { id: mkId(), authUserId: null, isGuest: true, displayName };
  const key = `${GUEST_PROFILE_PREFIX}${slot}`;
  const raw = window.localStorage.getItem(key);
  if (raw) return JSON.parse(raw);
  const profile = { id: mkId(), authUserId: null, isGuest: true, displayName };
  window.localStorage.setItem(key, JSON.stringify(profile));
  return profile;
}

const analyticsSourceForMode = mode =>
  mode === "tutorial"
    ? TUTORIAL_ANALYTICS_SOURCE
    : mode === "solo"
    ? SOLO_ANALYTICS_SOURCE
    : mode === "online"
    ? ONLINE_ANALYTICS_SOURCE
    : ANALYTICS_SOURCE;

export function buildTrackedGame(gs) {
  const startedAt = gs._createdAt || nowIso();
  const source = analyticsSourceForMode(gs.mode);
  const players = {
    A: getOrCreateGuestProfile("A", gs.mode === "solo" ? "Solo Player" : gs.mode === "tutorial" ? "Learner" : "Guest A"),
    B: gs.mode === "solo"
      ? getOrCreateGuestProfile("SOLO_CHALLENGER", "Challenger")
      : gs.mode === "tutorial"
      ? getOrCreateGuestProfile("TUTORIAL_GUIDE", "Tutorial Computer")
      : getOrCreateGuestProfile("B", "Guest B"),
  };
  const tracked = {
    gameId: gs._gameId || mkId(),
    source,
    appVersion: APP_VERSION,
    rulesVersion: RULES_VERSION,
    startedAt,
    players: {
      A: { profileId: players.A.id, isGuest: true, displayName: players.A.displayName },
      B: { profileId: players.B.id, isGuest: true, displayName: players.B.displayName },
    },
    initialState: {
      aInitialDeck: [...(gs._aInitialDeck || gs.aDeck || [])],
      bInitialDeck: [...(gs._bInitialDeck || gs.bDeck || [])],
      aInitialHand: [...(gs._aInitialHand || gs.aHand || [])],
      bInitialHand: [...(gs._bInitialHand || gs.bHand || [])],
      initialFirstPlayer: gs.firstPlayer,
      initialRound: gs.round || 1,
      initialState: clone(gs),
    },
    events: [],
    rounds: [],
    outcome: null,
  };
  return appendInitialEvents(tracked, gs);
}

function appendInitialEvents(tracked, gs) {
  let next = tracked;
  next = appendTrackedEvent(next, gs, "game_started", {
    gameId: next.gameId,
    source: next.source,
    mode: gs.mode || "hotseat",
    appVersion: next.appVersion,
    rulesVersion: next.rulesVersion,
    aInitialDeck: next.initialState.aInitialDeck,
    bInitialDeck: next.initialState.bInitialDeck,
    aInitialHand: next.initialState.aInitialHand,
    bInitialHand: next.initialState.bInitialHand,
    firstPlayer: next.initialState.initialFirstPlayer,
  }, { phase: "setup" });
  next = appendTrackedEvent(next, gs, "initial_deal", {
    playerSlot: "A",
    cards: next.initialState.aInitialHand,
  }, { playerSlot: "A", phase: "setup" });
  next = appendTrackedEvent(next, gs, "initial_deal", {
    playerSlot: "B",
    cards: next.initialState.bInitialHand,
  }, { playerSlot: "B", phase: "setup" });
  next = appendTrackedEvent(next, gs, "round_started", {
    roundNumber: gs.round || 1,
    firstPlayer: gs.firstPlayer,
    aHand: [...(gs.aHand || [])],
    bHand: [...(gs.bHand || [])],
    aActionsRequired: gs._aReq || 2,
    bActionsRequired: gs._bReq || 2,
    aCardsDrawn: (gs.aHand || []).length,
    bCardsDrawn: (gs.bHand || []).length,
  }, { phase: "action" });
  return next;
}

export function appendTrackedEvent(tracked, gs, eventType, eventPayload = {}, opts = {}) {
  if (!tracked) return tracked;
  const event = {
    id: mkId(),
    seq: tracked.events.length + 1,
    roundNumber: opts.roundNumber ?? gs?.round ?? 1,
    phase: opts.phase ?? gs?.phase ?? "action",
    playerSlot: opts.playerSlot ?? gs?.currentPlayer ?? null,
    eventType,
    eventPayload,
    createdAt: nowIso(),
  };
  return { ...tracked, events: [...tracked.events, event] };
}

export function upsertTrackedRound(tracked, roundSummary) {
  if (!tracked) return tracked;
  const existing = tracked.rounds.findIndex(r => r.roundNumber === roundSummary.roundNumber);
  if (existing === -1) return { ...tracked, rounds: [...tracked.rounds, roundSummary] };
  const rounds = [...tracked.rounds];
  rounds[existing] = { ...rounds[existing], ...roundSummary };
  return { ...tracked, rounds };
}

export function buildRoundSummary(gs) {
  return {
    id: mkId(),
    roundNumber: gs.round,
    firstPlayer: gs.firstPlayer,
    aActionsRequired: gs._aReq || 2,
    bActionsRequired: gs._bReq || 2,
    aCardsDrawn: (gs.aHand || []).length + (gs.aPlay || []).length,
    bCardsDrawn: (gs.bHand || []).length + (gs.bPlay || []).length,
    winnerPlayerSlot: gs._revealWinner === "TIE" ? null : gs._revealWinner,
    aHandRank: gs._revealAE?.handName || null,
    bHandRank: gs._revealBE?.handName || null,
    roundSummary: {
      mode: gs.mode || "hotseat",
      aHand: [...(gs.aHand || [])],
      bHand: [...(gs.bHand || [])],
      aMods: clone(gs.aMods || []),
      bMods: clone(gs.bMods || []),
      challengerReveal: gs.mode === "solo" ? clone(gs._soloReveal || null) : null,
      winner: gs._revealWinner || null,
      aChips: gs.aChips,
      bChips: gs.bChips,
    },
  };
}

export function finalizeTrackedGame(tracked, gs, winner) {
  if (!tracked) return tracked;
  const finished = {
    ...tracked,
    finishedAt: nowIso(),
    outcome: {
      winner,
      aChips: gs.aChips,
      bChips: gs.bChips,
    },
    finalState: clone(gs),
  };
  return appendTrackedEvent(finished, gs, "game_finished", {
    winner,
    aChips: gs.aChips,
    bChips: gs.bChips,
  }, { phase: "game_over", playerSlot: winner === "TIE" ? null : winner });
}

export function saveActiveTrackedGame(tracked) {
  if (!hasStorage() || !tracked) return;
  window.localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(tracked));
}

export function archiveCompletedTrackedGame(tracked) {
  if (!hasStorage() || !tracked) return;
  const existing = loadCompletedTrackedGames();
  const next = [tracked, ...existing].slice(0, 100);
  window.localStorage.setItem(COMPLETED_GAMES_KEY, JSON.stringify(next));
  window.localStorage.removeItem(ACTIVE_GAME_KEY);
}

export function loadCompletedTrackedGames() {
  if (!hasStorage()) return [];
  const raw = window.localStorage.getItem(COMPLETED_GAMES_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export function deriveAnalyticsRows(tracked) {
  if (!tracked) return { decks: [], cardPresence: [], cardUsage: [] };
  const usageMap = new Map();
  const touchUsage = (playerSlot, cardId, field) => {
    const key = `${playerSlot}:${cardId}`;
    const base = usageMap.get(key) || {
      id: mkId(),
      game_id: tracked.gameId,
      player_slot: playerSlot,
      profile_id: tracked.players[playerSlot]?.profileId || null,
      card_id: cardId,
      times_drawn: 0,
      times_played_face_up: 0,
      times_played_face_down: 0,
      times_in_scoring_hand: 0,
      times_scrapped: 0,
    };
    base[field] += 1;
    usageMap.set(key, base);
  };

  for (const evt of tracked.events) {
    const p = evt.playerSlot;
    if (!p) continue;
    if (evt.eventType === "card_drawn" && evt.eventPayload.cardId) touchUsage(p, evt.eventPayload.cardId, "times_drawn");
    if (evt.eventType === "action_played" && evt.eventPayload.cardId) {
      touchUsage(p, evt.eventPayload.cardId, evt.eventPayload.faceDown ? "times_played_face_down" : "times_played_face_up");
    }
    if (evt.eventType === "card_scrapped" && evt.eventPayload.cardId) touchUsage(p, evt.eventPayload.cardId, "times_scrapped");
  }

  for (const round of tracked.rounds) {
    const aCards = round.roundSummary?.aHand || [];
    const bCards = round.roundSummary?.bHand || [];
    for (const cardId of aCards) touchUsage("A", cardId, "times_in_scoring_hand");
    for (const cardId of bCards) touchUsage("B", cardId, "times_in_scoring_hand");
  }

  const decks = ["A", "B"].map(playerSlot => {
    const won = tracked.outcome ? tracked.outcome.winner === playerSlot : null;
    return {
      id: mkId(),
      game_id: tracked.gameId,
      player_slot: playerSlot,
      profile_id: tracked.players[playerSlot]?.profileId || null,
      deck_cards: [...tracked.initialState[`${playerSlot.toLowerCase()}InitialDeck`]],
      opening_hand: [...tracked.initialState[`${playerSlot.toLowerCase()}InitialHand`]],
      won,
    };
  });

  const cardPresence = [];
  for (const playerSlot of ["A", "B"]) {
    const deckCards = tracked.initialState[`${playerSlot.toLowerCase()}InitialDeck`];
    const opening = new Set(tracked.initialState[`${playerSlot.toLowerCase()}InitialHand`]);
    const won = tracked.outcome ? tracked.outcome.winner === playerSlot : null;
    for (const cardId of deckCards) {
      cardPresence.push({
        id: mkId(),
        game_id: tracked.gameId,
        player_slot: playerSlot,
        profile_id: tracked.players[playerSlot]?.profileId || null,
        card_id: cardId,
        in_deck: true,
        in_opening_hand: opening.has(cardId),
        won,
      });
    }
  }

  return { decks, cardPresence, cardUsage: [...usageMap.values()] };
}
