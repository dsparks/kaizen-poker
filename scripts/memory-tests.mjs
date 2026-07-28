import assert from "node:assert/strict";
import {
  initializeMemories,
  randomizeLibraryKnowledge,
  recordDiscardShuffle,
  recordDrawKnowledge,
  rememberBottomCard,
  rememberDeckOrder,
  rememberLibrary,
  rememberTopCard,
  syncVisibleMemories,
} from "../src/memory.js";

const base=()=>initializeMemories({
  phase:"action",
  aDeck:["8C","9C","10C"],
  bDeck:["8D","9D","10D"],
  aHand:["2C","3C"],
  bHand:["2D","3D"],
  aDiscard:[],
  bDiscard:[],
  aPlay:[],
  bPlay:[],
  scrap:[],
});

{
  const gs=base();
  assert.deepEqual(Object.keys(gs._aMemory).sort(),["2C","3C"]);
  assert.deepEqual(Object.keys(gs._bMemory).sort(),["2D","3D"]);
  assert.equal(gs._aMemory["8C"],undefined,"unseen opening library must stay unknown");
  assert.equal(gs._aMemory["2D"],undefined,"opponent hand must stay unknown");
}

{
  let gs=rememberTopCard(base(),"A","A");
  gs={...gs,aDeck:["9C","10C","8C"]};
  gs=rememberBottomCard(gs,"A","A");
  assert.equal(gs._aMemory["8C"].position,2,"Defer-style bottom placement remembers the exact bottom position");
}

{
  let gs=rememberLibrary(base(),"A","A");
  assert.equal(gs._aMemory["8C"].zone,"aDeck");
  assert.equal(gs._aMemory["9C"].zone,"aDeck");
  assert.equal(gs._aMemory["10C"].zone,"aDeck");
  assert.equal(gs._bMemory["8C"],undefined,"a private search must not inform the opponent");
  gs=randomizeLibraryKnowledge(rememberTopCard(gs,"A","A"),"A");
  assert.equal(gs._aMemory["8C"].zone,"aDeck","shuffle preserves known deck membership");
  assert.equal(gs._aMemory["8C"].position,null,"shuffle removes exact order knowledge");
}

{
  let gs=rememberTopCard(base(),"A","A");
  gs=rememberDeckOrder(gs,"A","A",["2C"]);
  assert.equal(gs._aMemory["2C"].position,0);
  assert.equal(gs._aMemory["8C"].position,1,"placing a card on top shifts known positions");
  gs=recordDrawKnowledge(gs,"A","2C");
  assert.equal(gs._aMemory["2C"].zone,"aHand");
  assert.equal(gs._aMemory["8C"].position,0,"drawing advances known deck positions");
}

{
  let gs=base();
  gs={...gs,aDiscard:["4C"],scrap:["5D"]};
  gs=syncVisibleMemories(gs);
  assert.equal(gs._aMemory["4C"].zone,"aDiscard");
  assert.equal(gs._bMemory["4C"].zone,"aDiscard");
  assert.equal(gs._aMemory["5D"].zone,"scrap");
  assert.equal(gs._bMemory["5D"].zone,"scrap");
  gs=recordDiscardShuffle(gs,"A",["4C"]);
  assert.equal(gs._aMemory["4C"].zone,"aDeck");
  assert.equal(gs._bMemory["4C"].zone,"aDeck");
}

{
  let gs=base();
  gs=recordDiscardShuffle(gs,"A",["4C"]);
  gs=recordDrawKnowledge(gs,"A","4C");
  assert.equal(gs._aMemory["4C"].zone,"aHand");
  assert.equal(gs._bMemory["4C"].zone,"aHand","a one-card reshuffle is completely knowable");
}

{
  let gs=base();
  gs=recordDiscardShuffle(gs,"A",["4C","5C"]);
  gs=recordDrawKnowledge(gs,"A","4C");
  assert.equal(gs._bMemory["4C"].zone,"aHidden");
  assert.equal(gs._bMemory["5C"].zone,"aHidden","an unknown shuffled draw makes each known card's deck/hand location uncertain");
}

{
  let gs=base();
  gs={...gs,phase:"reveal"};
  gs=syncVisibleMemories(gs);
  assert.equal(gs._aMemory["2D"].zone,"bHand");
  assert.equal(gs._bMemory["2C"].zone,"aHand");
}

console.log("memory tests passed");
