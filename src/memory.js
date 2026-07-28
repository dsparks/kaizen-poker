// Persistent player knowledge.
//
// Memory is deliberately stored in game state instead of reconstructed from
// the board. A card remains remembered after it stops being visible, and only
// information the player actually receives is added here.
const PLAYERS=["A","B"];
const memoryKey=viewer=>viewer==="A"?"_aMemory":"_bMemory";
const zoneFor=(owner,zone)=>`${owner.toLowerCase()}${zone}`;

const cloneBook=book=>Object.fromEntries(
  Object.entries(book||{}).map(([id,entry])=>[id,{...entry}])
);

function ensureMemories(gs){
  if(!gs)return gs;
  let next=gs;
  for(const viewer of PLAYERS){
    const key=memoryKey(viewer);
    if(next[key])continue;
    if(next===gs)next={...gs};
    next[key]={};
  }
  return next;
}

function rememberCards(gs,viewer,cardIds,zone,{positions=null}={}){
  let next=ensureMemories(gs);
  const key=memoryKey(viewer);
  const book=cloneBook(next[key]);
  (cardIds||[]).forEach((id,index)=>{
    if(!id)return;
    const position=positions?positions[index]??null:null;
    book[id]={zone,position};
  });
  return {...next,[key]:book};
}

function rememberLibrary(gs,viewer,owner=viewer){
  const deck=owner==="A"?gs.aDeck:gs.bDeck;
  return rememberCards(gs,viewer,deck,zoneFor(owner,"Deck"));
}

function rememberTopCard(gs,viewer,owner=viewer){
  const deck=owner==="A"?gs.aDeck:gs.bDeck;
  return deck?.length
    ?rememberCards(gs,viewer,[deck[0]],zoneFor(owner,"Deck"),{positions:[0]})
    :ensureMemories(gs);
}

function rememberBottomCard(gs,viewer,owner=viewer){
  const deck=owner==="A"?gs.aDeck:gs.bDeck;
  return deck?.length
    ?rememberCards(gs,viewer,[deck[deck.length-1]],zoneFor(owner,"Deck"),{positions:[deck.length-1]})
    :ensureMemories(gs);
}

function rememberDeckOrder(gs,viewer,owner,cardIds){
  let next=ensureMemories(gs);
  const key=memoryKey(viewer);
  const deckZone=zoneFor(owner,"Deck");
  const book=cloneBook(next[key]);
  const added=new Set(cardIds||[]);
  for(const [id,entry] of Object.entries(book)){
    if(!added.has(id)&&entry.zone===deckZone&&Number.isInteger(entry.position)){
      entry.position+=added.size;
    }
  }
  next={...next,[key]:book};
  return rememberCards(
    next,
    viewer,
    cardIds,
    deckZone,
    {positions:(cardIds||[]).map((_,index)=>index)}
  );
}

function randomizeLibraryKnowledge(gs,owner){
  let next=ensureMemories(gs);
  const deckZone=zoneFor(owner,"Deck");
  for(const viewer of PLAYERS){
    const key=memoryKey(viewer);
    const book=cloneBook(next[key]);
    for(const entry of Object.values(book)){
      if(entry.zone===deckZone)entry.position=null;
    }
    next={...next,[key]:book};
  }
  return next;
}

function recordDiscardShuffle(gs,owner,discardIds){
  let next=randomizeLibraryKnowledge(gs,owner);
  const deckZone=zoneFor(owner,"Deck");
  for(const viewer of PLAYERS){
    next=rememberCards(
      next,
      viewer,
      discardIds,
      deckZone,
      {positions:discardIds?.length===1?[0]:null}
    );
  }
  return next;
}

function recordDrawKnowledge(gs,owner,cardId){
  let next=ensureMemories(gs);
  const deckZone=zoneFor(owner,"Deck");
  const handZone=zoneFor(owner,"Hand");
  for(const viewer of PLAYERS){
    const key=memoryKey(viewer);
    const book=cloneBook(next[key]);
    const drawn=book[cardId];
    const knewTop=drawn?.zone===deckZone&&drawn.position===0;
    if(viewer===owner||knewTop){
      book[cardId]={zone:handZone,position:null};
      for(const [id,entry] of Object.entries(book)){
        if(id!==cardId&&entry.zone===deckZone&&Number.isInteger(entry.position)){
          entry.position=Math.max(0,entry.position-1);
        }
      }
    }else{
      for(const entry of Object.values(book)){
        if(entry.zone!==deckZone)continue;
        if(Number.isInteger(entry.position))entry.position=Math.max(0,entry.position-1);
        else entry.zone=zoneFor(owner,"Hidden");
      }
    }
    next={...next,[key]:book};
  }
  return next;
}

// Add everything that is unambiguously visible in the current state. This is
// safe to run at every commit and also upgrades old saved games that predate
// persistent memory.
function syncVisibleMemories(gs){
  let next=ensureMemories(gs);
  const publicZones=[
    ["aDiscard",next.aDiscard],
    ["bDiscard",next.bDiscard],
    ["scrap",next.scrap],
  ];
  for(const [zone,cards] of publicZones){
    for(const viewer of PLAYERS)next=rememberCards(next,viewer,cards||[],zone);
  }
  for(const owner of PLAYERS){
    const hand=owner==="A"?next.aHand:next.bHand;
    const play=owner==="A"?next.aPlay:next.bPlay;
    next=rememberCards(next,owner,hand||[],zoneFor(owner,"Hand"));
    next=rememberCards(next,owner,(play||[]).map(card=>card?.id),zoneFor(owner,"Play"));
    const faceUp=(play||[]).filter(card=>card&&!card.faceDown).map(card=>card.id);
    for(const viewer of PLAYERS)next=rememberCards(next,viewer,faceUp,zoneFor(owner,"Play"));
  }
  if(next.phase==="reveal"||next.phase==="gameOver"||next.phase==="tutorialDone"){
    for(const viewer of PLAYERS){
      next=rememberCards(next,viewer,next.aHand||[],zoneFor("A","Hand"));
      next=rememberCards(next,viewer,next.bHand||[],zoneFor("B","Hand"));
      const key=memoryKey(viewer);
      const book=cloneBook(next[key]);
      const aDeck=new Set(next.aDeck||[]);
      const bDeck=new Set(next.bDeck||[]);
      for(const [id,entry] of Object.entries(book)){
        if(entry.zone===zoneFor("A","Hidden")&&aDeck.has(id))entry.zone=zoneFor("A","Deck");
        if(entry.zone===zoneFor("B","Hidden")&&bDeck.has(id))entry.zone=zoneFor("B","Deck");
      }
      next={...next,[key]:book};
    }
  }
  return next;
}

function initializeMemories(gs){
  return syncVisibleMemories({...gs,_aMemory:{},_bMemory:{}});
}

export {
  ensureMemories,
  initializeMemories,
  memoryKey,
  randomizeLibraryKnowledge,
  recordDiscardShuffle,
  recordDrawKnowledge,
  rememberCards,
  rememberBottomCard,
  rememberDeckOrder,
  rememberLibrary,
  rememberTopCard,
  syncVisibleMemories,
};
