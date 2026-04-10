export const TUTORIAL_TOTAL_ROUNDS = 3;
export const TUTORIAL_ANALYTICS_SOURCE = "tutorial";

export const TUTORIAL_INITIAL_DECKS = {
  A: [
    "3D", "10H", "KC", "KD", "9H", "9C", "2C", "10S",
    "7C", "6H", "5H", "4D", "4S", "AC", "QC", "AD",
    "KH", "9D", "QD", "2D", "4C", "8C", "3C", "6C",
    "5D", "QH",
  ],
  B: [
    "5C", "2S", "7H", "7S", "3H", "3S", "KS", "6D",
    "JD", "AS", "8H", "7D", "10C", "4H", "JH", "QS",
    "6S", "2H", "5S", "10D", "JC", "AH", "8D", "9S",
    "8S", "JS",
  ],
};

export const TUTORIAL_ROUNDS = {
  1: {
    computerActions: [
      { cardId: "5C" },
      { cardId: "2S", choice: { target: "6D" } },
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
      { cardId: "5S", choice: { target: "JD" } },
    ],
  },
};

export function getTutorialRoundSetup(roundNumber) {
  return TUTORIAL_ROUNDS[roundNumber] || null;
}

export function getTutorialPrompt(gs, modal, fdMode) {
  if (!gs || gs.mode !== "tutorial") return null;

  if (gs._tutorialComplete || gs.phase === "gameOver" || gs.phase === "tutorialDone") {
    return {
      title: "Tutorial Complete",
      message: "Nice work. You have played through the full flow of a round, seen face-down play, and watched a Remember card pay off from scrap. Press MENU whenever you want to start a fresh game.",
      expect: { kind: "menu" },
    };
  }

  const round = gs._tutorialRound || 1;
  const aActions = (gs.aPlay || []).length;
  const ack = gs._tutorialAck || "";

  if (round === 1) {
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 0) return {
      title: "First Action",
      message: "I'm Chippy. Each round starts with two Actions for each player, then both hands score. Let's open with Loot.",
      expect: { kind: "playCard", value: "3D" },
    };
    if (modal?.type === "pickDiscard" && /^Loot/.test(modal.title || "")) return {
      title: "Draw Then Discard",
      message: "Keep Nerf and let Prune go. Loot gives you value right away, so the question is which card helps this hand less right now.",
      expect: { kind: "modalCard", value: "2C" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 1) return {
      title: "Second Action",
      message: "Now play Buff. Buff is a Modify, so it waits in play for now and makes its choice during scoring.",
      expect: { kind: "playCard", value: "10H" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "B") return {
      title: "Opponent Turn",
      message: "Your turn is done. Watch the other side now: Mill sends cards into discard, then Trim turns one of those cards into scrap. Click OK when you're ready.",
      expect: { kind: "ack", value: "opp-turn" },
    };
    if (gs.phase === "score" && !modal && !(gs.aMods || []).length) return {
      title: "Score Phase",
      message: "Action phase is over. Reveal and score. Because Buff is still in play, you'll choose how it changes your scoring hand.",
      expect: { kind: "reveal" },
    };
    if (modal?.type === "pickFromList" && /Buff/.test(modal.title || "")) return {
      title: "Choose The Target",
      message: "Pick Nerf. We're about to turn that Ten into a King.",
      expect: { kind: "modalCard", value: "10S" },
    };
    if (modal?.type === "pickRank" && /Buff/.test(modal.title || "")) return {
      title: "Choose The New Rank",
      message: "Choose K. That gives you three Kings and a pair of Nines: a Full House.",
      expect: { kind: "modalRank", value: "K" },
    };
    if (gs.phase === "reveal") return {
      title: "Round One Complete",
      message: "Strong start. Buff turned two pair into a Full House. Press Next Round and I'll show you the default face-down action.",
      expect: { kind: "next" },
    };
  }

  if (round === 2) {
    if (modal?.type === "refreshOpts") return {
      title: "Default Face-Down Reward",
      message: "This is the default face-down reward: Refresh. You discard a card, then draw a replacement. Choose Refresh.",
      expect: { kind: "refreshChoice", value: "refresh" },
    };
    if (modal?.type === "pickDiscard" && /^Refresh/.test(modal.title || "")) return {
      title: "Refresh",
      message: "Discard Recall. The face-down card is already spent, so Refresh lets you trade away the weaker piece and keep the rest.",
      expect: { kind: "modalCard", value: "5H" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 0) return {
      title: "A Simple First Action",
      message: "Play Freeze. Freeze is an Amend, so it changes the rules of the round instead of changing a scoring card.",
      expect: { kind: "playCard", value: "7C" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 1 && !fdMode) return {
      title: "Face-Down Play",
      message: "For your second Action, play a card face-down. Click Play Face-Down. Any card can become a simple utility action this way.",
      expect: { kind: "faceDownToggle" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && fdMode) return {
      title: "Pick A Card To Hide",
      message: "Choose Exchange. We don't want its printed text here; we want the face-down effect instead.",
      expect: { kind: "playFaceDownCard", value: "6H" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "B") return {
      title: "Opponent Turn",
      message: "Good. Now watch the other side: they'll check the top of the deck with Reject, then use another card face-down for a plain Refresh. Click OK to continue.",
      expect: { kind: "ack", value: "opp-turn" },
    };
    if (gs.phase === "score" && !modal) return {
      title: "Reveal Again",
      message: "Reveal and score. This round is here to show how face-down play gives you a flexible fallback.",
      expect: { kind: "reveal" },
    };
    if (gs.phase === "reveal") return {
      title: "Face-Down Basics",
      message: "That's the core idea. Face-down play gives you a dependable option when the printed text isn't what you need. Press Next Round.",
      expect: { kind: "next" },
    };
  }

  if (round === 3) {
    if (modal?.type === "rejuvenate") return {
      title: "Discard Camouflage",
      message: "Choose only Camouflage. We want it in your discard first so you can see exactly where it goes before it reaches scrap.",
      expect: { kind: "none" },
    };
    if (modal?.type === "pickFromList" && /Impeach/.test(modal.title || "")) return {
      title: "Scrap Camouflage",
      message: "Pick Camouflage. Impeach scraps a face card, so this is the move from discard into scrap.",
      expect: { kind: "modalCard", value: "QD" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 0) return {
      title: "Build The Lesson Yourself",
      message: "Stay with the same game and play Rejuvenate. We're going to move Camouflage from your hand into your discard first.",
      expect: { kind: "playCard", value: "KH" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 1 && ack !== "zone:aDiscard") return {
      title: "Inspect Your Discard",
      message: "Open A Discard. Camouflage is sitting there now, and plenty of actions care about that pile.",
      tagKey: "aDiscard",
      expect: { kind: "inspectZone", value: "aDiscard" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 1) return {
      title: "Move It To Scrap",
      message: "Now play Impeach. It scraps a face card from your discard, which is exactly what we want here.",
      expect: { kind: "playCard", value: "9D" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 2 && ack !== "zone:scrap") return {
      title: "Inspect Scrap",
      message: "Open Scrap. Cards there are much harder to get back, and Remember cards can keep affecting the game from that pile.",
      tagKey: "scrap",
      expect: { kind: "inspectZone", value: "scrap" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "B") return {
      title: "Continuity Matters",
      message: "Now the setup is in place. Your opponent will take two quiet Actions, and then you'll see Camouflage pay off during scoring. Click OK when you're ready.",
      expect: { kind: "ack", value: "opp-turn" },
    };
    if (gs.phase === "score" && !modal) return {
      title: "Remember Payoff",
      message: "Reveal and score. Because Camouflage is in scrap, Sculpt is about to get an extra suit-changing option.",
      expect: { kind: "reveal" },
    };
    if (modal?.type === "queen2") return {
      title: "This Comes From Scrap",
      message: "Choose Suit Only. That extra option is coming from Camouflage in the scrap pile.",
      expect: { kind: "queenChoice", value: "suit" },
    };
    if (modal?.type === "pickSuit" && /Camouflage/.test(modal.title || "")) return {
      title: "Complete The Flush",
      message: "Pick Clubs. That turns Sculpt into a Club and finishes the Flush.",
      expect: { kind: "modalSuit", value: "C" },
    };
    if (gs.phase === "reveal") return {
      title: "Tutorial Wrap-Up",
      message: "There it is. Camouflage only mattered because you carried it from hand to discard, then from discard to scrap. Press Finish Tutorial when you're ready.",
      expect: { kind: "next" },
    };
  }

  return {
    title: "Tutorial",
    message: "Follow along. I'll keep pointing out what matters as you go.",
    expect: { kind: "none" },
  };
}
