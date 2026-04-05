export const TUTORIAL_TOTAL_ROUNDS = 5;
export const TUTORIAL_ANALYTICS_SOURCE = "tutorial";

const fill = (...cards) => cards;

export const TUTORIAL_INITIAL_DECKS = {
  A: [
    "2H","2D","3D","4C","4D","5C","5H","6C","6S","7C","8C","9C","9D",
    "9H","10H","10S","JC","QC","KC","KD","KH","AD","AH","AS","AC","QS"
  ],
  B: [
    "2C","2S","3C","3H","3S","4H","4S","5D","5S","6D","6H","7D","7H",
    "7S","8D","8H","8S","9S","10C","10D","JS","JD","JH","QD","QH","KS"
  ],
};

export const TUTORIAL_ROUNDS = {
  1: {
    aHand: ["3D","10H","4C","4D","KC","KH","9H"],
    aDeck: fill("2C","4C","5S","7D","8D","JC","QS","AH"),
    bHand: ["5C","8C","2D","4H","6S","8H","KD"],
    bDeck: fill("3C","4S","9H","QC","2H","6C"),
    scrap: [],
    aDiscard: [],
    bDiscard: [],
    computerActions: ["5C","8C"],
  },
  2: {
    aHand: ["8C","4D","2H","5H","6C","9D","KH"],
    aDeck: fill("QC","3S","7S","JD","AC","4C"),
    bHand: ["7C","5C","2S","4S","6D","8H","KD"],
    bDeck: fill("3H","9S","QS","2C","6H","10D"),
    scrap: ["QH"],
    aDiscard: [],
    bDiscard: [],
    computerActions: ["7C","5C"],
  },
  3: {
    aHand: ["8C","7C","2D","5C","9C","KC","AC"],
    aDeck: fill("6D","10C","AS","4D","JH","3S"),
    bHand: ["5C","8C","3D","4S","6H","KD","AS"],
    bDeck: fill("2C","7S","9D","QH","4H","JD"),
    scrap: ["QD"],
    aDiscard: [],
    bDiscard: [],
    computerActions: ["5C","8C"],
  },
  4: {
    aHand: ["8C","7C","2H","4D","6S","9H","KD"],
    aDeck: fill("3C","5D","JS","AH","QC","10D"),
    bHand: ["5C","7C","KC","KD","KH","2S","4D"],
    bDeck: fill("3H","6D","8H","AS","QD","9S"),
    scrap: [],
    aDiscard: ["3C"],
    bDiscard: [],
    computerActions: ["5C","7C"],
  },
  5: {
    aHand: ["7C","10S","9C","9D","KC","AD","KH"],
    aDeck: fill("2H","4S","5D","JS","QC","8D"),
    bHand: ["5C","2C","4D","6S","8H","KD","AS"],
    bDeck: fill("3C","7S","9H","QH","4H","JD"),
    scrap: [],
    aDiscard: [],
    bDiscard: [],
    computerActions: ["5C","2C"],
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
      message: "You did it. You have now seen the Action phase, the Score phase, Enacts, Modifies, Reacts, Amends, Remembers, and face-down play. Hit MENU whenever you are ready to leave the tutorial and start a real game.",
      expect: { kind: "menu" },
    };
  }

  const round = gs._tutorialRound || 1;
  const aActions = (gs.aPlay || []).length;

  if (round === 1) {
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 0) return {
      title: "First Action",
      message: "I’m Chippy. Welcome to Kaizen Poker. Every round has two big parts. First comes the Action phase, where each player takes two Actions. After that comes the Score phase, where both players compare their best five-card poker hand. Right now you are in the Action phase, and it is your turn. Start by playing Loot.",
      expect: { kind: "playCard", value: "3D" },
    };
    if (modal?.type === "pickDiscard" && /^Loot/.test(modal.title || "")) return {
      title: "Draw Then Discard",
      message: "Loot drew you one extra card, and now you must discard one. Discard the 2♣ you just drew. Enacts like Loot help you see more cards than you keep, which improves hand quality over time.",
      expect: { kind: "modalCard", value: "2C" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 1) return {
      title: "Second Action",
      message: "Good. You still get one more Action this turn. Play Buff. Buff is a Modify, which means it waits in play during the Action phase and only asks for its actual choice during scoring.",
      expect: { kind: "playCard", value: "10H" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "B") return {
      title: "Opponent Turn",
      message: "Your two Actions are finished for the round. Now the tutorial opponent takes its two Actions. You do not need to click anything here. I want you to notice the turn structure: one player finishes Actions, then the other player does the same.",
      expect: { kind: "none" },
    };
    if (gs.phase === "score" && !modal && !(gs.aMods || []).length) return {
      title: "Score Phase",
      message: "Now the Action phase is over and the Score phase begins. Click Reveal & Score. Because you played Buff earlier, the game will now ask how that Modify changes your scoring hand.",
      expect: { kind: "reveal" },
    };
    if (modal?.type === "pickFromList" && /Buff/.test(modal.title || "")) return {
      title: "Choose The Target",
      message: "Pick the 9♥. We are going to raise that card into a King so it becomes part of a much stronger five-card poker hand.",
      expect: { kind: "modalCard", value: "9H" },
    };
    if (modal?.type === "pickRank" && /Buff/.test(modal.title || "")) return {
      title: "Choose The New Rank",
      message: "Pick K. That gives you three Kings plus a pair of Fours, which makes a Full House. This is the heart of a Modify: it changes a scoring card at the moment scoring matters.",
      expect: { kind: "modalRank", value: "K" },
    };
    if (gs.phase === "reveal") return {
      title: "First Full Round",
      message: "Excellent. You just played through the full structure of a round: Actions first, scoring choices second, then the showdown. Hit Next Round and I’ll introduce face-down play.",
      expect: { kind: "next" },
    };
  }

  if (round === 2) {
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 0) return {
      title: "A React",
      message: "Play Capitulate. Capitulate is a React. Reacts usually do not do anything immediately. Instead, they stay in play and wait for a later condition to happen.",
      expect: { kind: "playCard", value: "8C" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 1 && !fdMode) return {
      title: "Face-Down Play",
      message: "For your second Action, do not use the card’s printed text. Click Play Face-Down. Any card can be used face-down, and that gives you a fallback utility effect when the printed action is not what you want.",
      expect: { kind: "faceDownToggle" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && fdMode) return {
      title: "Pick A Card To Hide",
      message: "Now choose Gamble to play face-down. The important lesson here is the face-down system itself, not Gamble’s normal text.",
      expect: { kind: "playFaceDownCard", value: "4D" },
    };
    if (modal?.type === "refreshOpts") return {
      title: "Refresh Upgraded",
      message: "Normally, a face-down card gives Refresh. But there is a Remember card called Sift in the scrap pile, so your face-down utility has been upgraded. Choose Sift. Scrap pile effects can quietly reshape the rules like this.",
      expect: { kind: "refreshChoice", value: "sift" },
    };
    if (modal?.type === "pickDiscard" && /^Sift/.test(modal.title || "")) return {
      title: "One More Look",
      message: "Discard the Queen you just drew. Sift is draw-then-discard, which is often stronger than discard-then-draw because you make the discard choice with more information.",
      expect: { kind: "modalCard", value: "QC" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "B") return {
      title: "Watch The Turn Pass",
      message: "Good. The tutorial opponent will finish the Action phase now. Notice that face-down play still consumed an Action, but it gave you useful filtering instead of a normal card effect.",
      expect: { kind: "none" },
    };
    if (gs.phase === "score" && !modal) return {
      title: "Score Again",
      message: "Now click Reveal & Score so you can see how the round settles after that face-down play. Face-down actions are often about staying flexible rather than making a flashy combo.",
      expect: { kind: "reveal" },
    };
    if (gs.phase === "reveal") return {
      title: "Why Face-Down Matters",
      message: "That is the main reason face-down play exists: it gives weak or awkward cards another job. Hit Next Round and we’ll look at a Remember effect that changes a 2 during scoring.",
      expect: { kind: "next" },
    };
  }

  if (round === 3) {
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 0) return {
      title: "Set Up The Round",
      message: "Play Capitulate first. This round’s main lesson is actually about the scrap pile, but I want to keep your Action phase simple and easy to follow.",
      expect: { kind: "playCard", value: "8C" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 1) return {
      title: "An Amend",
      message: "Now play Freeze. Freeze is an Amend. Amends change the round’s rules rather than changing a single scoring card directly. You will get an even clearer Amend example in the final round.",
      expect: { kind: "playCard", value: "7C" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "B") return {
      title: "Then We Score",
      message: "The tutorial opponent is finishing its Actions. After that, the Score phase will show you how a Remember card in scrap can create a brand-new scoring option.",
      expect: { kind: "none" },
    };
    if (gs.phase === "score" && !modal) return {
      title: "Remember Time",
      message: "Click Reveal & Score. Camouflage is in the scrap pile, so your unmodified 2 is about to gain a special option during scoring.",
      expect: { kind: "reveal" },
    };
    if (modal?.type === "queen2") return {
      title: "The Scrap Pile Matters",
      message: "Choose Suit Only. This extra choice is not coming from the 2 itself. It exists because Camouflage is sitting in the scrap pile and being Remembered.",
      expect: { kind: "queenChoice", value: "suit" },
    };
    if (modal?.type === "pickSuit" && /Camouflage/.test(modal.title || "")) return {
      title: "Complete The Flush",
      message: "Pick Clubs. That changes the suit of your 2 and completes a Flush. The important lesson here is that the Score phase can include special decisions created by cards that are no longer in your hand.",
      expect: { kind: "modalSuit", value: "C" },
    };
    if (gs.phase === "reveal") return {
      title: "Remember Effects",
      message: "Great. Remember cards keep mattering from the scrap pile. Hit Next Round and I’ll show you a React actually triggering after a loss.",
      expect: { kind: "next" },
    };
  }

  if (round === 4) {
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 0) return {
      title: "Setting Up A React",
      message: "Play Capitulate again. This time I want you to see the whole point of a React: it can wait patiently through the round and then trigger only if the right condition happens.",
      expect: { kind: "playCard", value: "8C" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 1) return {
      title: "One More Action",
      message: "Now play Freeze. It will not save this round, but that is okay. Tutorial rounds are allowed to have losses too. This one is here to teach timing.",
      expect: { kind: "playCard", value: "7C" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "B") return {
      title: "Losing Can Still Teach",
      message: "The tutorial opponent is going to win this round, and that is intentional. I want you to see what happens after the winner is decided when a React is waiting in play.",
      expect: { kind: "none" },
    };
    if (gs.phase === "score" && !modal) return {
      title: "Watch The Aftermath",
      message: "Click Reveal & Score. After the hands are compared, keep watching. Some effects happen only after the round result is known.",
      expect: { kind: "reveal" },
    };
    if (modal?.type === "pickFromList" && /Capitulate/.test(modal.title || "")) return {
      title: "Now It Triggers",
      message: "Capitulate triggered because you lost. Scrap Defer. This is the timing lesson: Reacts often care more about what happened than about what you clicked earlier.",
      expect: { kind: "modalCard", value: "3C" },
    };
    if (gs.phase === "reveal") return {
      title: "That Was A React",
      message: "Perfect. You lost the chip, but your React still gave you value afterward. Hit Next Round for one final lesson that ties Modifies and Amends together.",
      expect: { kind: "next" },
    };
  }

  if (round === 5) {
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 0) return {
      title: "Round Rule Change",
      message: "Play Freeze. This round is your clearest example of an Amend doing visible work. Freeze changes the rules for the whole round by preventing scrapping.",
      expect: { kind: "playCard", value: "7C" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "A" && aActions === 1) return {
      title: "A Second Modify",
      message: "Now play Nerf. Nerf is another Modify, but unlike Buff it lowers a card instead of raising it. By now you should be seeing the pattern: play the Modify during Actions, choose the exact change during Scoring.",
      expect: { kind: "playCard", value: "10S" },
    };
    if (gs.phase === "action" && gs.currentPlayer === "B") return {
      title: "Freeze In Action",
      message: "Watch the tutorial opponent’s second action fizzle. Freeze says no one can scrap this round, so the rule of the round overrides that action.",
      expect: { kind: "none" },
    };
    if (gs.phase === "score" && !modal && !(gs.aMods || []).length) return {
      title: "Final Score Phase",
      message: "Click Reveal & Score. Then use Nerf to lower your Ace into a King. This final round ties together turn order, Modifies, Amends, and the Score phase.",
      expect: { kind: "reveal" },
    };
    if (modal?.type === "pickFromList" && /Nerf/.test(modal.title || "")) return {
      title: "Choose The Target",
      message: "Pick the Ace of Diamonds. Nerf lowers a card to any lower rank, so you are about to turn that Ace into something much more useful.",
      expect: { kind: "modalCard", value: "AD" },
    };
    if (modal?.type === "pickRank" && /Nerf/.test(modal.title || "")) return {
      title: "Choose The Lower Rank",
      message: "Pick K. That gives you three Kings plus a pair of Nines, which makes another Full House. This is your second example of how scoring-time card changes can reshape a hand.",
      expect: { kind: "modalRank", value: "K" },
    };
    if (gs.phase === "reveal") return {
      title: "Tutorial Wrap-Up",
      message: "That is the end of the guided lesson. After this round, the tutorial will stop and I’ll let you head back to the menu whenever you want.",
      expect: { kind: "next" },
    };
  }

  return {
    title: "Tutorial",
    message: "Follow along and I’ll keep explaining what phase you are in, what the game is asking for, and why the current choice matters.",
    expect: { kind: "none" },
  };
}
