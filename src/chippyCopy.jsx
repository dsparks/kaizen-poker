import { Fragment } from "react";

// Central home for Chippy/tutorial copy.
// Edit the strings here and I can ingest your changes without hunting through gameplay code.
// Supported format for links inside messages: [label](#/route) or [label](mailto:someone@example.com)

export const CHIPPY_COPY = {
  demo: {
    title: "Kaizen Poker Demo",
    message:
      "Welcome! This is a playable web version of Kaizen Poker. Start with the [rules](#/rules) or the short [tutorial](#/tutorial), or jump straight into a game: [two-player hotseat](#/hotseat), [solo against the Challenger deck](#/solo), or [two-player remote](#/remote).\n\nQuestions or feedback? Contact the designer [here](mailto:dsparks@gmail.com). Have fun!",
  },
  gallery: {
    title: "Card Image Gallery",
    message:
      "This gallery shows the current print prototype. The illustrations are AI-generated placeholders — the published game won't use this artwork. They're here to help the card names and abilities stick, and to show the visual direction the game is being designed around.",
  },
  soloIntro: {
    title: "Solo Mode",
    message:
      "Solo Mode is a race to seven chips against the Challenger deck. You play normally: take two Actions, then score your best five-card poker hand. The Challenger doesn't build a hand — at showdown it reveals its top card, and the Challenger Lookup table tells you which poker hand that card counts as. Beat it and you win the chip. Ties go to the Challenger.\n\nWant the Challenger deck face-up (Easy) or face-down (Difficult)?",
  },
  tutorial: {
    complete: {
      title: "Tutorial Complete",
      message:
        "That's the tutorial! You know enough to play a real game now. Press MENU whenever you're ready to start one.",
    },
    fallback: {
      title: "Tutorial",
      message: "Keep going — I'll chime in whenever something new comes up.",
    },
    round1: {
      firstAction: {
        title: "First Action",
        message:
          "Hi, I'm Chippy! I'll walk you through your first three rounds.\nEach round, both players take two Actions, then both hands are scored. Let's start simple: click Loot to play it as your first Action.",
      },
      drawThenDiscard: {
        title: "Draw, Then Discard",
        message:
          "Loot let you draw an extra card — now you discard one back. The real question is which card helps this hand least. Click Prune to discard it.",
      },
      secondAction: {
        title: "Second Action",
        message:
          "Now play Buff. It's a Modify Action: it sits in play for now, and when the round scores you'll point it at one of your scoring cards.",
      },
      opponentTurn: {
        title: "Opponent's Turn",
        message:
          "Your Actions are done. Your opponent plays Mill to put three cards into their discard, then Trim to scrap one of them. Click OK and watch.",
      },
      scorePhase: {
        title: "Score Phase",
        message:
          "Actions are over — time to score. Click REVEAL & SCORE. Since Buff is still in play, you'll get to choose how it improves your hand first.",
      },
      chooseTarget: {
        title: "Choose the Target",
        message: "Pick the 6. We're about to turn it into a King.",
      },
      chooseRank: {
        title: "Choose the New Rank",
        message: "Choose K. That gives you three Kings and a pair of Nines — a Full House.",
      },
      roundComplete: {
        title: "Round One Complete",
        message:
          "A Full House in round one — strong start. Buff turned two pair into something much bigger. Press Next Round and I'll show you face-down plays.",
      },
    },
    round2: {
      defaultFaceDownReward: {
        title: "Face-Down Effects",
        message:
          "A face-down card ignores its printed ability — instead, you choose a simple utility effect. The default is Refresh: discard a card, then draw a replacement. Click Refresh.",
      },
      refresh: {
        title: "Refresh",
        message:
          "Discard Recall — it isn't helping this hand. Refresh is how you trade away your least useful card.",
      },
      firstAction: {
        title: "A Simple First Action",
        message:
          "Play Freeze. It's an Amend Action: instead of touching any cards, it changes the rules for the rest of the round.",
      },
      faceDownPlay: {
        title: "Face-Down Play",
        message:
          "For your second Action, let's try playing a card face-down. Click the Play Face-Down button.",
      },
      pickCardToHide: {
        title: "Pick a Card to Hide",
        message: "Now click Exchange. We don't need its printed ability this round, so we'll spend it face-down instead.",
      },
      opponentTurn: {
        title: "Opponent's Turn",
        message:
          "Nice. Now watch the other side: your opponent checks the top of their deck with Reject, then plays a card face-down for a plain Refresh. Click OK to continue.",
      },
      revealAgain: {
        title: "Reveal Again",
        message: "Click REVEAL & SCORE and let's see how this round shakes out.",
      },
      faceDownBasics: {
        title: "Face-Down Basics",
        message:
          "That's the takeaway: when none of your cards' abilities appeal, a face-down play is always a solid fallback. Press Next Round.",
      },
    },
    round3: {
      discardCamouflage: {
        title: "Discard Camouflage",
        message: "Select only Camouflage, then confirm. We want it in your discard — you'll scrap it from there in a moment.",
      },
      scrapCamouflage: {
        title: "Scrap Camouflage",
        message: "Pick Camouflage. Impeach moves a face card from your discard to the scrap pile.",
      },
      buildLessonYourself: {
        title: "Set Up the Combo",
        message: "Play Rejuvenate. Here's the plan: use it to get Camouflage into your discard, then scrap Camouflage from there.",
      },
      inspectDiscard: {
        title: "Inspect Your Discard",
        message:
          "Click the A Discard button to look through your discard pile. Checking discards — yours and your opponent's — pays off constantly. Camouflage should be sitting there now.",
      },
      moveItToScrap: {
        title: "Move It to Scrap",
        message: "Now play Impeach. It scraps a face card from your discard — exactly what we need.",
      },
      inspectScrap: {
        title: "Inspect the Scrap Pile",
        message:
          "Now click Scrap. Cards there are very hard to get back — but Remember cards, like Camouflage, stay active from the scrap pile.",
      },
      continuityMatters: {
        title: "The Payoff Is Coming",
        message:
          "Your opponent takes two quiet Actions, and then Camouflage pays off during scoring. Click OK when you're ready.",
      },
      rememberPayoff: {
        title: "Remember Payoff",
        message:
          "Click REVEAL & SCORE. Because Camouflage is in the scrap pile, your 2 — Sculpt — is about to get a bonus option.",
      },
      thisComesFromScrap: {
        title: "Courtesy of the Scrap Pile",
        message: "Choose Suit Only. That extra option comes from Camouflage sitting in scrap.",
      },
      completeFlush: {
        title: "Complete the Flush",
        message: "Pick Clubs. Sculpt becomes a Club, and that finishes your Flush.",
      },
      wrapUp: {
        title: "Tutorial Wrap-Up",
        message:
          "And that's the basics! There's a lot more to discover, but you're ready for a real game. Press Finish Tutorial.",
      },
    },
  },
};

export function renderChippyMessage(message, linkStyle = {}) {
  if (typeof message !== "string" || !message) return message;
  const parts = [];
  const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(message)) !== null) {
    const [fullMatch, label, href] = match;
    if (match.index > lastIndex) {
      parts.push(message.slice(lastIndex, match.index));
    }
    parts.push(
      <a key={`${href}-${match.index}`} href={href} style={linkStyle}>
        {label}
      </a>,
    );
    lastIndex = match.index + fullMatch.length;
  }
  if (lastIndex < message.length) {
    parts.push(message.slice(lastIndex));
  }
  return <Fragment>{parts}</Fragment>;
}
