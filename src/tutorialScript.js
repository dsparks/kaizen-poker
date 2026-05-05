import { CHIPPY_COPY } from "./chippyCopy.jsx";

export const TUTORIAL_TOTAL_ROUNDS = 3;
export const TUTORIAL_INITIAL_DECKS = {
  A: [
    "3D", "10H", "KC", "KD", "9H", "9C", "2C", "6D",
    "7C", "6H", "5H", "4D", "4S", "AC", "QC", "AD",
    "KH", "9D", "QD", "2D", "4C", "8C", "3C", "6C",
    "5D", "QH",
  ],
  B: [
    "5C", "2S", "7H", "7S", "3H", "3S", "KS", "10S",
    "JD", "AS", "8H", "7D", "10C", "4H", "JH", "QS",
    "6S", "5S", "2H", "10D", "JC", "AH", "8D", "9S",
    "8S", "JS",
  ],
};

export const TUTORIAL_ROUNDS = {
  1: {
    computerActions: [
      { cardId: "5C" },
      { cardId: "2S", choice: { target: "JD" } },
    ],
  },
  2: {
    computerActions: [
      { cardId: "8H", choice: { decision: "keep" } },
      { cardId: "7D", faceDown: true, choice: { discard: "JH" } },
    ],
  },
  3: {
    computerActions: [
      { cardId: "2H", choice: { target: "AS" } },
      { cardId: "8S" },
    ],
  },
};

export function getTutorialRoundSetup(roundNumber) {
  return TUTORIAL_ROUNDS[roundNumber] || null;
}

export function getTutorialPrompt(gs, modal, fdMode) {
  if (!gs || gs.mode !== "tutorial") return null;
  const copy = CHIPPY_COPY.tutorial;

  if (gs._tutorialComplete || gs.phase === "gameOver" || gs.phase === "tutorialDone") {
    return {
      title: copy.complete.title,
      message: copy.complete.message,
      expect: { kind: "menu" },
    };
  }

  const round = gs._tutorialRound || 1;
  const aActions = (gs.aPlay || []).length;
  const ack = gs._tutorialAck || "";

  if (round === 1) {
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 0) return {
      title: copy.round1.firstAction.title,
      message: copy.round1.firstAction.message,
      expect: { kind: "playCard", value: "3D" },
    };
    if (modal?.type === "pickDiscard" && /^Loot/.test(modal.title || "")) return {
      title: copy.round1.drawThenDiscard.title,
      message: copy.round1.drawThenDiscard.message,
      expect: { kind: "modalCard", value: "2C" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 1) return {
      title: copy.round1.secondAction.title,
      message: copy.round1.secondAction.message,
      expect: { kind: "playCard", value: "10H" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "B") return {
      title: copy.round1.opponentTurn.title,
      message: copy.round1.opponentTurn.message,
      expect: { kind: "ack", value: "opp-turn" },
    };
    if (gs.phase === "score" && !modal && !(gs.aMods || []).length) return {
      title: copy.round1.scorePhase.title,
      message: copy.round1.scorePhase.message,
      expect: { kind: "reveal" },
    };
    if (modal?.type === "pickFromList" && /Buff/.test(modal.title || "")) return {
      title: copy.round1.chooseTarget.title,
      message: copy.round1.chooseTarget.message,
      expect: { kind: "modalCard", value: "6D" },
    };
    if (modal?.type === "pickRank" && /Buff/.test(modal.title || "")) return {
      title: copy.round1.chooseRank.title,
      message: copy.round1.chooseRank.message,
      expect: { kind: "modalRank", value: "K" },
    };
    if (gs.phase === "reveal") return {
      title: copy.round1.roundComplete.title,
      message: copy.round1.roundComplete.message,
      expect: { kind: "next" },
    };
  }

  if (round === 2) {
    if (modal?.type === "refreshOpts") return {
      title: copy.round2.defaultFaceDownReward.title,
      message: copy.round2.defaultFaceDownReward.message,
      expect: { kind: "refreshChoice", value: "refresh" },
    };
    if (modal?.type === "pickDiscard" && /^Refresh/.test(modal.title || "")) return {
      title: copy.round2.refresh.title,
      message: copy.round2.refresh.message,
      expect: { kind: "modalCard", value: "5H" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 0) return {
      title: copy.round2.firstAction.title,
      message: copy.round2.firstAction.message,
      expect: { kind: "playCard", value: "7C" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 1 && !fdMode) return {
      title: copy.round2.faceDownPlay.title,
      message: copy.round2.faceDownPlay.message,
      expect: { kind: "faceDownToggle" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && fdMode) return {
      title: copy.round2.pickCardToHide.title,
      message: copy.round2.pickCardToHide.message,
      expect: { kind: "playFaceDownCard", value: "6H" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "B") return {
      title: copy.round2.opponentTurn.title,
      message: copy.round2.opponentTurn.message,
      expect: { kind: "ack", value: "opp-turn" },
    };
    if (gs.phase === "score" && !modal) return {
      title: copy.round2.revealAgain.title,
      message: copy.round2.revealAgain.message,
      expect: { kind: "reveal" },
    };
    if (gs.phase === "reveal") return {
      title: copy.round2.faceDownBasics.title,
      message: copy.round2.faceDownBasics.message,
      expect: { kind: "next" },
    };
  }

  if (round === 3) {
    if (modal?.type === "rejuvenate") return {
      title: copy.round3.discardCamouflage.title,
      message: copy.round3.discardCamouflage.message,
      expect: { kind: "none" },
    };
    if (modal?.type === "pickFromList" && /Impeach/.test(modal.title || "")) return {
      title: copy.round3.scrapCamouflage.title,
      message: copy.round3.scrapCamouflage.message,
      expect: { kind: "modalCard", value: "QD" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 0) return {
      title: copy.round3.buildLessonYourself.title,
      message: copy.round3.buildLessonYourself.message,
      expect: { kind: "playCard", value: "KH" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 1 && ack !== "zone:aDiscard") return {
      title: copy.round3.inspectDiscard.title,
      message: copy.round3.inspectDiscard.message,
      tagKey: "aDiscard",
      expect: { kind: "inspectZone", value: "aDiscard" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 1) return {
      title: copy.round3.moveItToScrap.title,
      message: copy.round3.moveItToScrap.message,
      expect: { kind: "playCard", value: "9D" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 2 && ack !== "zone:scrap") return {
      title: copy.round3.inspectScrap.title,
      message: copy.round3.inspectScrap.message,
      tagKey: "scrap",
      expect: { kind: "inspectZone", value: "scrap" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "B") return {
      title: copy.round3.continuityMatters.title,
      message: copy.round3.continuityMatters.message,
      expect: { kind: "ack", value: "opp-turn" },
    };
    if (gs.phase === "score" && !modal) return {
      title: copy.round3.rememberPayoff.title,
      message: copy.round3.rememberPayoff.message,
      expect: { kind: "reveal" },
    };
    if (modal?.type === "queen2") return {
      title: copy.round3.thisComesFromScrap.title,
      message: copy.round3.thisComesFromScrap.message,
      expect: { kind: "queenChoice", value: "suit" },
    };
    if (modal?.type === "pickSuit" && /Camouflage/.test(modal.title || "")) return {
      title: copy.round3.completeFlush.title,
      message: copy.round3.completeFlush.message,
      expect: { kind: "modalSuit", value: "C" },
    };
    if (gs.phase === "reveal") return {
      title: copy.round3.wrapUp.title,
      message: copy.round3.wrapUp.message,
      expect: { kind: "next" },
    };
  }

  return {
    title: copy.fallback.title,
    message: copy.fallback.message,
    expect: { kind: "none" },
  };
}
