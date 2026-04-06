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
      message: "You did it. You have seen the Action phase, the Score phase, face-down play, the difference between discard and scrap, and a Remember effect paying off from the scrap pile. When you are ready, hit MENU and start a real game.",
      expect: { kind: "menu" },
    };
  }

  const round = gs._tutorialRound || 1;
  const aActions = (gs.aPlay || []).length;
  const ack = gs._tutorialAck || "";

  if (round === 1) {
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 0) return {
      title: "First Action",
      message: "I'm Chippy. Welcome to Kaizen Poker. Each round has two parts. First, both players take two Actions. After that, both players score their best five-card poker hand. Start by playing Loot.",
      expect: { kind: "playCard", value: "3D" },
    };
    if (modal?.type === "pickDiscard" && /^Loot/.test(modal.title || "")) return {
      title: "Draw Then Discard",
      message: "Loot already helped. You drew Nerf, which is more useful here than Prune, so discard Prune. Enacts often improve your hand right away.",
      expect: { kind: "modalCard", value: "2C" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 1) return {
      title: "Second Action",
      message: "Now play Buff. Buff is a Modify. Modifies wait in play during the Action phase, then ask for their real choice during scoring.",
      expect: { kind: "playCard", value: "10H" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "B") return {
      title: "Opponent Turn",
      message: "Now the opponent takes a turn. First they will mill cards into their discard pile. Then they will use Trim to scrap one of those milled cards and thin their deck a little. Click OK and watch their side of the table.",
      expect: { kind: "ack", value: "opp-turn" },
    };
    if (gs.phase === "score" && !modal && !(gs.aMods || []).length) return {
      title: "Score Phase",
      message: "The Action phase is over, so now both hands are scored. Click Reveal and Score. Because you played Buff earlier, the game will now ask how that Modify changes your scoring hand.",
      expect: { kind: "reveal" },
    };
    if (modal?.type === "pickFromList" && /Buff/.test(modal.title || "")) return {
      title: "Choose The Target",
      message: "Pick Nerf. We are going to turn that 10 into a King.",
      expect: { kind: "modalCard", value: "10S" },
    };
    if (modal?.type === "pickRank" && /Buff/.test(modal.title || "")) return {
      title: "Choose The New Rank",
      message: "Pick K. That gives you three Kings plus a pair of Nines, which makes a Full House. That is your first real Modify choice.",
      expect: { kind: "modalRank", value: "K" },
    };
    if (gs.phase === "reveal") return {
      title: "Round One Complete",
      message: "Nice work. You started with Two Pair and used Buff to turn it into a Full House. Hit Next Round and I will show you the default face-down option.",
      expect: { kind: "next" },
    };
  }

  if (round === 2) {
    if (modal?.type === "refreshOpts") return {
      title: "Default Face-Down Reward",
      message: "This is the normal face-down reward: Refresh. Refresh means you discard a card from hand, then draw a replacement. Choose Refresh so you see the default version first.",
      expect: { kind: "refreshChoice", value: "refresh" },
    };
    if (modal?.type === "pickDiscard" && /^Refresh/.test(modal.title || "")) return {
      title: "Refresh",
      message: "Discard Recall. The face-down card is already gone from your hand, so Refresh now lets you trade away a less useful card while keeping the stronger shape of your hand.",
      expect: { kind: "modalCard", value: "5H" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 0) return {
      title: "A Simple First Action",
      message: "Play Freeze. Freeze is an Amend, which means it changes the rules of the round instead of changing one scoring card.",
      expect: { kind: "playCard", value: "7C" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 1 && !fdMode) return {
      title: "Face-Down Play",
      message: "For your second Action, ignore a card's printed text. Click Play Face-Down. Any card can become a face-down utility action when its normal text is not what you need.",
      expect: { kind: "faceDownToggle" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && fdMode) return {
      title: "Pick A Card To Hide",
      message: "Now choose Exchange to play face-down. This lesson is about the face-down system itself, not Exchange's printed effect.",
      expect: { kind: "playFaceDownCard", value: "6H" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "B") return {
      title: "Opponent Turn",
      message: "Good. You just used the default face-down option. The opponent will peek at the top of their deck, then use another card face-down for a plain Refresh. Click OK to continue.",
      expect: { kind: "ack", value: "opp-turn" },
    };
    if (gs.phase === "score" && !modal) return {
      title: "Reveal Again",
      message: "Click Reveal and Score. This round is mainly about seeing how face-down play gives you a flexible fallback action.",
      expect: { kind: "reveal" },
    };
    if (gs.phase === "reveal") return {
      title: "Face-Down Basics",
      message: "Perfect. You have now seen the default face-down option, Refresh. Hit Next Round and I will show you how discard and scrap can matter across rounds.",
      expect: { kind: "next" },
    };
  }

  if (round === 3) {
    if (modal?.type === "rejuvenate") return {
      title: "Discard Camouflage",
      message: "Choose only Camouflage. Rejuvenate is putting that Remember card into your own discard pile so you can see exactly where it goes before you scrap it.",
      expect: { kind: "none" },
    };
    if (modal?.type === "pickFromList" && /Impeach/.test(modal.title || "")) return {
      title: "Scrap Camouflage",
      message: "Pick Camouflage from your discard pile. Impeach scraps a face card, so this is the moment you move that Remember card from discard into scrap.",
      expect: { kind: "modalCard", value: "QD" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 0) return {
      title: "Build The Lesson Yourself",
      message: "We are staying in the same game, so the earlier cards are still exactly where they landed. Now play Rejuvenate. It will let you discard Camouflage from your hand into your own discard pile.",
      expect: { kind: "playCard", value: "KH" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 1 && ack !== "zone:aDiscard") return {
      title: "Inspect Your Discard",
      message: "Now click A Discard. That opens your discard pile so you can see Camouflage sitting there face-up. Discard is a public zone that many cards care about.",
      tagKey: "aDiscard",
      expect: { kind: "inspectZone", value: "aDiscard" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 1) return {
      title: "Move It To Scrap",
      message: "Good. Now play Impeach. Impeach scraps a face card from your discard, which is exactly how we are going to move Camouflage into scrap.",
      expect: { kind: "playCard", value: "9D" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 2 && ack !== "zone:scrap") return {
      title: "Inspect Scrap",
      message: "Now click Scrap. Scrap is different from discard. Cards in scrap are more permanent, but Remember cards can keep affecting the game from there.",
      tagKey: "scrap",
      expect: { kind: "inspectZone", value: "scrap" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "B") return {
      title: "Continuity Matters",
      message: "See how natural that was? You put Camouflage into your discard yourself, then scrapped it yourself. The opponent will take two quiet Actions now, and then you will see Camouflage pay off in scoring. Click OK to continue.",
      expect: { kind: "ack", value: "opp-turn" },
    };
    if (gs.phase === "score" && !modal) return {
      title: "Remember Payoff",
      message: "Click Reveal and Score. Because Camouflage is now in scrap, your unmodified Sculpt is about to gain a special suit-changing option.",
      expect: { kind: "reveal" },
    };
    if (modal?.type === "queen2") return {
      title: "This Comes From Scrap",
      message: "Choose Suit Only. This extra option is available because Camouflage is being Remembered from the scrap pile.",
      expect: { kind: "queenChoice", value: "suit" },
    };
    if (modal?.type === "pickSuit" && /Camouflage/.test(modal.title || "")) return {
      title: "Complete The Flush",
      message: "Pick Clubs. That turns Sculpt into a Club and completes your Flush. This is the payoff for understanding how scrap and Remember effects work.",
      expect: { kind: "modalSuit", value: "C" },
    };
    if (gs.phase === "reveal") return {
      title: "Tutorial Wrap-Up",
      message: "Beautiful. You carried one continuous game all the way from Round 1 to here, and Camouflage only mattered because you moved it through discard and into scrap yourself. Hit Finish Tutorial, then use MENU whenever you want to start a real game.",
      expect: { kind: "next" },
    };
  }

  return {
    title: "Tutorial",
    message: "Follow along and I will keep explaining what is happening and why it matters.",
    expect: { kind: "none" },
  };
}
