import { Fragment } from "react";

// Central home for Chippy/tutorial copy.
// Edit the strings here and I can ingest your changes without hunting through gameplay code.
// Supported format for links inside messages: [label](#/route) or [label](mailto:someone@example.com)

export const CHIPPY_COPY = {
  demo: {
    title: "Kaizen Poker Demo",
    message:
      "Welcome to the Kaizen Poker demo! In lieu of a demo video, I've put together a playable web version of the game. Feel free to peruse the [rules](#/rules), try an introductory [tutorial](#/tutorial), or play the full game: [two-player hotseat](#/hotseat), [solo versus a Challenger deck](#/solo), or even [two-player remote](#/remote).\n\nYou can contact the designer [here](mailto:dsparks@gmail.com). Have fun!",
  },
  soloIntro: {
    title: "Solo Mode",
    message:
      "Solo Mode is a race to seven chips against the \"Challenger Deck.\" You still take two Actions, then score the best five-card poker hand you can make. The Challenger never builds a normal hand; at showdown, reveal the top Challenger card and use the lookup table to see what it scores. Beat that result to win the chip. If the hands tie, the Challenger takes it.\n\nYou can play with the Challenger deck face-up (Easy), or face-down (Difficult). Which would you prefer?",
  },
  tutorial: {
    complete: {
      title: "Tutorial Complete",
      message:
        "Nice work. Now that you've seen how the game works, you're ready to play. Press MENU whenever you want to start a fresh game.",
    },
    fallback: {
      title: "Tutorial",
      message: "Follow along. I'll keep pointing out what matters as you go.",
    },
    round1: {
      firstAction: {
        title: "First Action",
        message:
          "Hi! I'm Chippy. Welcome to Kaizen Poker.\nEach round starts with two Actions for each player, then both hands score. Go ahead and start by clicking Loot, to play it as an Action.",
      },
      drawThenDiscard: {
        title: "Draw Then Discard",
        message:
          "Click Prune to discard it. Loot gives you the opportunity to see an additional card, so the question is which card helps this hand less right now.",
      },
      secondAction: {
        title: "Second Action",
        message:
          "Now play Buff. Buff is a Modify action, so it waits in play for now and you'll assign it to one of your scoring cards later.",
      },
      opponentTurn: {
        title: "Opponent Turn",
        message:
          "Your Action phase is done. Your opponent plays Mill to put some cards into their discard, then Trim to scrap one of those discarded cards.",
      },
      scorePhase: {
        title: "Score Phase",
        message:
          "The Action phase is over; time for the Score phase. Because Buff is still in play, you'll choose how it changes your scoring hand.",
      },
      chooseTarget: {
        title: "Choose The Target",
        message: "Pick the 6. We're about to turn it into a King.",
      },
      chooseRank: {
        title: "Choose The New Rank",
        message: "Choose K. That gives you three Kings and a pair of Nines: a Full House.",
      },
      roundComplete: {
        title: "Round One Complete",
        message:
          "Strong start. Buff turned two pair into a Full House. Press Next Round and I'll show you the default face-down action.",
      },
    },
    round2: {
      defaultFaceDownReward: {
        title: "Default Face-Down Reward",
        message:
          "If you don't have any Actions you want to play, you can always play a card facedown. The default face-down ability is Refresh. You discard a card, then draw a replacement. Click Refresh.",
      },
      refresh: {
        title: "Refresh",
        message:
          "Discard Recall. The face-down card is already spent, so Refresh lets you trade away a card you don't want and keep the rest.",
      },
      firstAction: {
        title: "A Simple First Action",
        message:
          "Play Freeze. Freeze is an Amend Action, so it changes the rules of the round instead of changing a scoring card.",
      },
      faceDownPlay: {
        title: "Face-Down Play",
        message:
          "For your second Action, play a card face-down. Click Play Face-Down. Any card can become a simple utility action this way.",
      },
      pickCardToHide: {
        title: "Pick A Card To Hide",
        message: "Now play Exchange. We don't want its ability here; we'll use the face-down effect instead.",
      },
      opponentTurn: {
        title: "Opponent Turn",
        message:
          "Good. Now watch the other side: they'll check the top of the deck with Reject, then use another card face-down for a plain Refresh. Click OK to continue.",
      },
      revealAgain: {
        title: "Reveal Again",
        message: "Reveal and score. Now you've seen how face-down play gives you a flexible fallback.",
      },
      faceDownBasics: {
        title: "Face-Down Basics",
        message:
          "When you don't love any of the actions your cards offer, face-down play gives you a nice fallback option. Press Next Round.",
      },
    },
    round3: {
      discardCamouflage: {
        title: "Discard Camouflage",
        message: "Choose only Camouflage. We want it in your discard first, you'll scrap it soon.",
      },
      scrapCamouflage: {
        title: "Scrap Camouflage",
        message: "Pick Camouflage. Impeach scraps a face card, moving it from your discard to the scrap pile.",
      },
      buildLessonYourself: {
        title: "Build The Lesson Yourself",
        message: "Play Rejuvenate. (We're going to use it to move Camouflage into your discard, then scrap it.)",
      },
      inspectDiscard: {
        title: "Inspect Your Discard",
        message:
          "Click the A Discard to see what's in your own discard pile. It's often useful to know what's in your own or your opponent's discard pile. You should see Camouflage sitting there now.",
      },
      moveItToScrap: {
        title: "Move It To Scrap",
        message: "Now play Impeach. It scraps a face card from your discard, which is exactly what we want here.",
      },
      inspectScrap: {
        title: "Inspect Scrap",
        message:
          "Open Scrap. Cards there are much harder to get back, and Remember cards can keep affecting the game from that pile.",
      },
      continuityMatters: {
        title: "Continuity Matters",
        message:
          "Your opponent will take two quiet Actions, and then you'll see Camouflage pay off during scoring. Click OK when you're ready.",
      },
      rememberPayoff: {
        title: "Remember Payoff",
        message:
          "Reveal and score. Because Camouflage is in scrap, Sculpt is about to get an extra suit-changing option.",
      },
      thisComesFromScrap: {
        title: "This Comes From Scrap",
        message: "Choose Suit Only. That extra option is coming from Camouflage in the scrap pile.",
      },
      completeFlush: {
        title: "Complete The Flush",
        message: "Pick Clubs. That turns Sculpt into a Club and finishes the Flush.",
      },
      wrapUp: {
        title: "Tutorial Wrap-Up",
        message:
          "There is a lot more to explore in Kaizen Poker, but now you know some of the basics. Press Finish Tutorial when you're ready.",
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
