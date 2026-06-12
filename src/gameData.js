// Pure game data: suits, ranks, the 52-card set, hand-tier palette, solo
// constants, and the Challenger lookup table. No React, no DOM.
const SUITS={C:"♣",D:"♦",H:"♥",S:"♠"};
const SC={C:"#35bd86",D:"#ff9d2e",H:"#ff5a4e",S:"#34a3ff"};
const SO=["C","D","H","S"];
export const RO=["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
export const RV=Object.fromEntries(RO.map((r,i)=>[r,i]));
export const FACE=["J","Q","K"];
export function lowerRanks(rank){
  if(rank==="A") return RO.filter(r=>r!=="A");
  if(rank==="2") return ["A"];
  return ["A", ...RO.filter(r=>r!=="A"&&RV[r]<RV[rank])];
}
const isSoloMode=mode=>mode==="solo"||mode==="solo_art";
export function higherRanks(rank){return rank==="A"?RO.filter(r=>r!=="A"):RO.filter(r=>RV[r]>RV[rank])}
export function adjacentRanks(rank){
  if(rank==="2")return ["A","3"];
  if(rank==="A")return ["K","2"];
  const ci=RV[rank],opts=[];if(ci>0)opts.push(RO[ci-1]);if(ci<12)opts.push(RO[ci+1]);return opts;
}
const TI={Enact:{bg:"#f5efe1",bd:"#8d6e63",ink:"#2f241d",tagBg:"#ece1cd",lb:"Enact"},Modify:{bg:"#f7f0dc",bd:"#c89b3c",ink:"#302515",tagBg:"#efe0b7",lb:"Modify"},
  React:{bg:"#e9f2ea",bd:"#4d8b6f",ink:"#1f3229",tagBg:"#d5e6d7",lb:"React"},Amend:{bg:"#f6e4df",bd:"#a85045",ink:"#351f1b",tagBg:"#ecd1ca",lb:"Amend"},
  Remember:{bg:"#ece8f8",bd:"#6d5b9c",ink:"#251f39",tagBg:"#ddd5f0",lb:"Remember"}};
const CARDS_BASE=[
{id:"2C",rank:"2",suit:"C",name:"Prune",type:"Enact",text:"Scrap a Diamond or Heart.",scrapSuits:["D","H"]},
{id:"2D",rank:"2",suit:"D",name:"Sculpt",type:"Enact",text:"Scrap a Heart or Spade.",scrapSuits:["H","S"]},
{id:"2H",rank:"2",suit:"H",name:"Extract",type:"Enact",text:"Scrap a Spade or Club.",scrapSuits:["S","C"]},
{id:"2S",rank:"2",suit:"S",name:"Trim",type:"Enact",text:"Scrap a Club or Diamond.",scrapSuits:["C","D"]},
{id:"3C",rank:"3",suit:"C",name:"Defer",type:"Enact",text:"Look at the top card of your deck. You may put it on the bottom."},
{id:"3D",rank:"3",suit:"D",name:"Loot",type:"Enact",text:"Draw a card, then discard a card."},
{id:"3H",rank:"3",suit:"H",name:"Rummage",type:"Enact",text:"Target player Refreshes."},
{id:"3S",rank:"3",suit:"S",name:"Consider",type:"Enact",text:"Look at the top card of your deck. You may discard it."},
{id:"4C",rank:"4",suit:"C",name:"Entomb",type:"Enact",text:"Search your deck for a card, put it into your discard, then shuffle."},
{id:"4D",rank:"4",suit:"D",name:"Gamble",type:"Enact",text:"Search your deck for a card and put it into your hand. Random discard, then shuffle."},
{id:"4H",rank:"4",suit:"H",name:"Cultivate",type:"Enact",text:"Search your deck for a card, then shuffle and put that card on top."},
{id:"4S",rank:"4",suit:"S",name:"Unearth",type:"Enact",text:"Return target card from your discard to your hand. If you do, discard a card."},
{id:"5C",rank:"5",suit:"C",name:"Mill",type:"Enact",text:"Put the top three cards of your deck into your discard."},
{id:"5D",rank:"5",suit:"D",name:"Forecast",type:"Modify",text:"At end of score phase, put a scoring card on top of your deck."},
{id:"5H",rank:"5",suit:"H",name:"Recall",type:"Enact",text:"Return another Action you control from play to hand, then discard a card."},
{id:"5S",rank:"5",suit:"S",name:"Reclaim",type:"Enact",text:"Put target card from your discard on top of your deck."},
{id:"6C",rank:"6",suit:"C",name:"Curse",type:"Enact",text:"Move target card from scrap into opponent's discard."},
{id:"6D",rank:"6",suit:"D",name:"Abduct",type:"Enact",text:"Steal opponent's Action into your discard, then scrap this card."},
{id:"6H",rank:"6",suit:"H",name:"Exchange",type:"Enact",text:"Swap a card between your discard and opponent's discard."},
{id:"6S",rank:"6",suit:"S",name:"Banish",type:"Enact",text:"Move a card from opponent's discard to scrap."},
{id:"7C",rank:"7",suit:"C",name:"Freeze",type:"Amend",text:"Target opponent can't scrap cards this round."},
{id:"7D",rank:"7",suit:"D",name:"Negate",type:"Amend",text:"Target opponent can't play Modify Actions this round."},
{id:"7H",rank:"7",suit:"H",name:"Abdicate",type:"Enact",text:"Opponent discards a face card (or reveals none), then draws."},
{id:"7S",rank:"7",suit:"S",name:"Nullify",type:"Enact",text:"Put target Modify from play into its owner's discard."},
{id:"8C",rank:"8",suit:"C",name:"Capitulate",type:"React",text:"If you lose this round, you may scrap a card."},
{id:"8D",rank:"8",suit:"D",name:"Vanish",type:"Modify",text:"At end of score phase, scrap a card sharing suit with your scoring hand."},
{id:"8H",rank:"8",suit:"H",name:"Reject",type:"Enact",text:"Look at the top card of your deck. You may scrap it."},
{id:"8S",rank:"8",suit:"S",name:"Capitalize",type:"React",text:"When you discard this from hand, you may scrap a card."},
{id:"9C",rank:"9",suit:"C",name:"Terminate",type:"Enact",text:"Scrap a non-face card."},
{id:"9D",rank:"9",suit:"D",name:"Impeach",type:"Enact",text:"Scrap a face card."},
{id:"9H",rank:"9",suit:"H",name:"Accumulate",type:"Enact",text:"Scrap a card matching a scrapped card's suit or rank."},
{id:"9S",rank:"9",suit:"S",name:"Reap",type:"Enact",text:"Scrap a card matching another card in your discard's suit or rank."},
{id:"10C",rank:"10",suit:"C",name:"Nudge",type:"Modify",text:"Change a scoring card's rank by ±1."},
{id:"10D",rank:"10",suit:"D",name:"Disguise",type:"Modify",text:"Change a scoring card's suit to any suit."},
{id:"10H",rank:"10",suit:"H",name:"Buff",type:"Modify",text:"Change a scoring card's rank to any higher rank."},
{id:"10S",rank:"10",suit:"S",name:"Nerf",type:"Modify",text:"Change a scoring card's rank to any lower rank."},
{id:"JC",rank:"J",suit:"C",name:"Clone",type:"Modify",text:"One scoring card becomes a copy of another scoring card."},
{id:"JD",rank:"J",suit:"D",name:"Duplicate",type:"Enact",text:"Enters play as a copy of another Action you control."},
{id:"JH",rank:"J",suit:"H",name:"Reflect",type:"Enact",text:"Enters play as a copy of opponent's Action."},
{id:"JS",rank:"J",suit:"S",name:"Reminisce",type:"Modify",text:"One scoring card becomes a copy of a card in your discard."},
{id:"QC",rank:"Q",suit:"C",name:"Miscalculate",type:"Remember",text:"As long as this card is scrapped, players may change the rank of unmodified 2s in their scoring hand to any rank."},
{id:"QD",rank:"Q",suit:"D",name:"Camouflage",type:"Remember",text:"As long as this card is scrapped, players may change the suit of unmodified 2s in their scoring hand to any suit."},
{id:"QH",rank:"Q",suit:"H",name:"Sift",type:"Remember",text:"As long as this card is scrapped, whenever a player would Refresh, they may instead draw a card, then discard a card."},
{id:"QS",rank:"Q",suit:"S",name:"Declutter",type:"Remember",text:"As long as this card is scrapped, whenever a player would Refresh, they may instead scrap a card."},
{id:"KC",rank:"K",suit:"C",name:"Brainstorm",type:"Enact",text:"Draw 3, then put 3 from hand on top of deck."},
{id:"KD",rank:"K",suit:"D",name:"Improvise",type:"Enact",text:"Mill 3, return a card from discard to hand, discard a card."},
{id:"KH",rank:"K",suit:"H",name:"Rejuvenate",type:"Enact",text:"Discard up to 3, then draw that many."},
{id:"KS",rank:"K",suit:"S",name:"Bury",type:"Enact",text:"Scrap up to 3 cards."},
{id:"AC",rank:"A",suit:"C",name:"Salvage",type:"Enact",text:"Put target card from the scrap pile into your hand. If you do, play an additional Action this round."},
{id:"AD",rank:"A",suit:"D",name:"Explore",type:"Enact",text:"Draw a card. If you do, bonus action."},
{id:"AH",rank:"A",suit:"H",name:"Retrieve",type:"Enact",text:"Return your Action from play to hand. If you do, bonus action."},
{id:"AS",rank:"A",suit:"S",name:"Reanimate",type:"Enact",text:"Return a card from discard to hand. If you do, bonus action."},
];
const VERBATIM_CARD_TEXT_BY_ID={
  "2C":"Scrap a Diamond or Heart. (Move it from your discard to the scrap pile.)",
  "2D":"Scrap a Heart or Spade. (Move it from your discard to the scrap pile.)",
  "2H":"Scrap a Spade or Club. (Move it from your discard to the scrap pile.)",
  "2S":"Scrap a Club or Diamond. (Move it from your discard to the scrap pile.)",
  "3C":"Look at the top card of your deck. You may put it on the bottom.",
  "3D":"Draw a card, then discard a card.",
  "3H":"Target player Refreshes. (Discards a card, then draws a card.)",
  "3S":"Look at the top card of your deck. You may discard it.",
  "4C":"Search your deck for a card, put it into your discard, then shuffle.",
  "4D":"Search your deck for a card and put it into your hand. If you do, discard a card at random, then shuffle.",
  "4H":"Search your deck for a card, then shuffle and put that card on top.",
  "4S":"Return target card from your discard to your hand. If you do, discard a card.",
  "5C":"Put the top three cards of your deck into your discard.",
  "5D":"At the end of the score phase, put a card from your scoring hand on top of your deck.",
  "5H":"Return another target Action card you control from play to your hand, then discard a card.",
  "5S":"Put target card from your discard on top of your deck.",
  "6C":"Move target card from the scrap pile into target opponent's discard.",
  "6D":"Move target Action card from play into your discard, then scrap this card.",
  "6H":"Exchange target card in an opponent's discard with target card in your discard.",
  "6S":"Move target card from an opponent's discard to the scrap pile.",
  "7C":"Target opponent can't scrap cards this round.",
  "7D":"Target opponent can't play Modify Actions this round.",
  "7H":"Target opponent reveals a hand with no face cards or discards a face card, then draws a card.",
  "7S":"Put target Modify card from play into its owner's discard.",
  "8C":"If you have the worst hand this round, you may scrap a card.",
  "8D":"At the end of the score phase, scrap a card that shares a suit with a card from your scoring hand.",
  "8H":"Look at the top card of your deck. You may put it in the scrap pile.",
  "8S":"When you discard this card from your hand, you may scrap a card.",
  "9C":"Scrap a non-face card. (Move it from your discard to the scrap pile.)",
  "9D":"Scrap a face card. (Move it from your discard to the scrap pile.)",
  "9H":"Scrap a card that shares a suit or rank with a scrapped card.",
  "9S":"Scrap a card that shares a suit or rank with another card in your discard.",
  "10C":"Change the rank of a card in your scoring hand by one.",
  "10D":"Change the suit of a card in your scoring hand to any suit.",
  "10H":"Change the rank of a card in your scoring hand to any higher rank.",
  "10S":"Change the rank of a card in your scoring hand to any lower rank.",
  "JC":"One card in your scoring hand is a copy of another target card in your scoring hand.",
  "JD":"This card enters play as a copy of another target Action you control in play.",
  "JH":"This card enters play as a copy of target Action an opponent controls in play.",
  "JS":"One card in your scoring hand is a copy of target card in your discard.",
  "QC":"As long as this card is scrapped, players may change the rank of unmodified 2s in their scoring hand to any rank.",
  "QD":"As long as this card is scrapped, players may change the suit of unmodified 2s in their scoring hand to any suit.",
  "QH":"As long as this card is scrapped, whenever a player would Refresh, they may instead draw a card, then discard a card.",
  "QS":"As long as this card is scrapped, whenever a player would Refresh, they may instead scrap a card.",
  "KC":"Draw three cards, then put three cards from your hand on top of your deck in any order.",
  "KD":"Put the top three cards of your deck into your discard. Return target card from your discard to your hand, then discard a card.",
  "KH":"Discard up to three cards, then draw that many cards.",
  "KS":"Scrap up to three cards. (Move them from your discard to the scrap pile.)",
  "AC":"Put target card from the scrap pile into your hand. If you do, play an additional Action this round.",
  "AD":"Draw a card. If you do, play an additional Action this round.",
  "AH":"Return another target Action card you control from play to your hand. If you do, play an additional Action this round.",
  "AS":"Return target card from your discard to your hand. If you do, play an additional Action this round.",
};
export const CARDS=CARDS_BASE.map(card=>({
  ...card,
  shortText:card.text,
  text:VERBATIM_CARD_TEXT_BY_ID[card.id]||card.text,
}));
export const CM=Object.fromEntries(CARDS.map(c=>[c.id,c]));
const TC=["#718096","#48bb78","#38b2ac","#4299e1","#667eea","#9f7aea","#ed64a6","#f56565","#ed8936","#f6e05e","#fefcbf","#fc8181","#fbb6ce","#fff5f5"];
const SOLO_TARGET_CHIPS=7;
const SOLO_DIFFICULTIES={
  easy:"easy",
  difficult:"difficult",
};
const CHALLENGER_LOOKUP={
  "2":{handRank:0,handName:"High Card",description:"Highest single card, no other hand achieved"},
  "3":{handRank:1,handName:"Pair",description:"Two cards of the same rank"},
  "4":{handRank:2,handName:"Twins",description:"Two cards of the same rank and suit"},
  "5":{handRank:3,handName:"Two Pair",description:"Two different pairs"},
  "6":{handRank:4,handName:"Three of a Kind",description:"Three cards of the same rank"},
  "7":{handRank:5,handName:"Straight",description:"Five sequentially ranked cards, suits irrelevant"},
  "8":{handRank:6,handName:"Flush",description:"Five cards of the same suit, ranks irrelevant"},
  "9":{handRank:7,handName:"Full House",description:"Three of a kind plus a pair"},
  "10":{handRank:8,handName:"Four of a Kind",description:"Four cards of the same rank"},
  "J":{handRank:9,handName:"Straight Flush",description:"Five sequentially ranked cards of the same suit"},
  "Q":{handRank:10,handName:"Royal Flush",description:"A straight flush of 10, J, Q, K, A"},
  "K":{handRank:11,handName:"Five of a Kind",description:"Five cards of the same rank"},
  "A":{handRank:13,handName:"Flush Five",description:"Top-tier Challenger result: Flush House / Flush Five"},
};
const CHALLENGER_ROWS=["2","3","4","5","6","7","8","9","10","J","Q","K","A"].map(rank=>({rank,...CHALLENGER_LOOKUP[rank]}));
export { SUITS, SC, SO, TI, TC, SOLO_TARGET_CHIPS, SOLO_DIFFICULTIES, CHALLENGER_LOOKUP, CHALLENGER_ROWS, isSoloMode };
