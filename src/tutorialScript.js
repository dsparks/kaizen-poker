export const TUTORIAL_TOTAL_ROUNDS = 3;
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
      message: "Nice work. Now that you've seen how the game works, you're ready to play. Press MENU whenever you want to start a fresh game.",
      expect: { kind: "menu" },
    };
  }

  const round = gs._tutorialRound || 1;
  const aActions = (gs.aPlay || []).length;
  const ack = gs._tutorialAck || "";

  if (round === 1) {
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 0) return {
      title: "First Action",
      message: "Hi! I'm Chippy. Welcome to Kaizen Poker.\nEach round starts with two Actions for each player, then both hands score. Go ahead and start by clicking Loot, to play it as an Action.",
      expect: { kind: "playCard", value: "3D" },
    };
    if (modal?.type === "pickDiscard" && /^Loot/.test(modal.title || "")) return {
      title: "Draw Then Discard",
      message: "Keep Nerf and let Prune go. Loot gives you the opportunity to see an additional card, so the question is which card helps this hand less right now.",
      expect: { kind: "modalCard", value: "2C" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 1) return {
      title: "Second Action",
      message: "Now play Buff. Buff is a Modify action, so it waits in play for now and you'll assign it to one of your scoring cards later.",
      expect: { kind: "playCard", value: "10H" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "B") return {
      title: "Opponent Turn",
      message: "Your turn is done. Your opponent plays Mill to put some cards into their discard, then Trim to scrap one of those discarded cards.",
      expect: { kind: "ack", value: "opp-turn" },
    };
    if (gs.phase === "score" && !modal && !(gs.aMods || []).length) return {
      title: "Score Phase",
      message: "The Action phase is over; time for the Score phase. Because Buff is still in play, you'll choose how it changes your scoring hand.",
      expect: { kind: "reveal" },
    };
    if (modal?.type === "pickFromList" && /Buff/.test(modal.title || "")) return {
      title: "Choose The Target",
      message: "Pick Nerf. We're about to turn that 10 into a King.",
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
      message: "If you don't have any Actions you want to play, you can always play a card facedown. The default face-down ability is Refresh. You discard a card, then draw a replacement. Click Refresh.",
      expect: { kind: "refreshChoice", value: "refresh" },
    };
    if (modal?.type === "pickDiscard" && /^Refresh/.test(modal.title || "")) return {
      title: "Refresh",
      message: "Discard Recall. The face-down card is already spent, so Refresh lets you trade away a card you don't want and keep the rest.",
      expect: { kind: "modalCard", value: "5H" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 0) return {
      title: "A Simple First Action",
      message: "Play Freeze. Freeze is an Amend Action, so it changes the rules of the round instead of changing a scoring card.",
      expect: { kind: "playCard", value: "7C" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 1 && !fdMode) return {
      title: "Face-Down Play",
      message: "For your second Action, play a card face-down. Click Play Face-Down. Any card can become a simple utility action this way.",
      expect: { kind: "faceDownToggle" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && fdMode) return {
      title: "Pick A Card To Hide",
      message: "Now play Exchange. We don't want its ability here; we'll use the face-down effect instead.",
      expect: { kind: "playFaceDownCard", value: "6H" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "B") return {
      title: "Opponent Turn",
      message: "Good. Now watch the other side: they'll check the top of the deck with Reject, then use another card face-down for a plain Refresh. Click OK to continue.",
      expect: { kind: "ack", value: "opp-turn" },
    };
    if (gs.phase === "score" && !modal) return {
      title: "Reveal Again",
      message: "Reveal and score. Now you've seen how face-down play gives you a flexible fallback.",
      expect: { kind: "reveal" },
    };
    if (gs.phase === "reveal") return {
      title: "Face-Down Basics",
      message: "When you don't love any of the actions your cards offer, face-down play gives you a nice fallback option. Press Next Round.",
      expect: { kind: "next" },
    };
  }

  if (round === 3) {
    if (modal?.type === "rejuvenate") return {
      title: "Discard Camouflage",
      message: "Choose only Camouflage. We want it in your discard first, you'll scrap it soon.",
      expect: { kind: "none" },
    };
    if (modal?.type === "pickFromList" && /Impeach/.test(modal.title || "")) return {
      title: "Scrap Camouflage",
      message: "Pick Camouflage. Impeach scraps a face card, moving it from your discard to the scrap pile.",
      expect: { kind: "modalCard", value: "QD" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 0) return {
      title: "Build The Lesson Yourself",
      message: "Play Rejuvenate. (We're going to use it to move Camouflage into your discard, then scrap it.)",
      expect: { kind: "playCard", value: "KH" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 1 && ack !== "zone:aDiscard") return {
      title: "Inspect Your Discard",
      message: "Click the A Discard to see what's in your own discard pile. It's often useful to know what's in your own or your opponent's discard pile. You should see Camouflage sitting there now.",
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
      message: "Your opponent will take two quiet Actions, and then you'll see Camouflage pay off during scoring. Click OK when you're ready.",
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
      message: "There is a lot more to explore in Kaizen Poker, but now you know some of the basics. Press Finish Tutorial when you're ready.",
      expect: { kind: "next" },
    };
  }

  return {
    title: "Tutorial",
    message: "Follow along. I'll keep pointing out what matters as you go.",
    expect: { kind: "none" },
  };
}
