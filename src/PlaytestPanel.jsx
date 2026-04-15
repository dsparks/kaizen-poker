import { useMemo, useState } from "react";

const ZONE_DEFS=[
  {key:"aHand",label:"A Hand",kind:"cards"},
  {key:"bHand",label:"B Hand",kind:"cards"},
  {key:"aDiscard",label:"A Discard",kind:"cards"},
  {key:"bDiscard",label:"B Discard",kind:"cards"},
  {key:"scrap",label:"Scrap",kind:"cards"},
  {key:"aDeckTop",label:"A Deck Top",kind:"deckTop"},
  {key:"bDeckTop",label:"B Deck Top",kind:"deckTop"},
  {key:"aDeckBottom",label:"A Deck Bottom",kind:"deckBottom"},
  {key:"bDeckBottom",label:"B Deck Bottom",kind:"deckBottom"},
  {key:"aPlayUp",label:"A Play Face-Up",kind:"play",player:"A",faceDown:false},
  {key:"bPlayUp",label:"B Play Face-Up",kind:"play",player:"B",faceDown:false},
  {key:"aPlayDown",label:"A Play Face-Down",kind:"play",player:"A",faceDown:true},
  {key:"bPlayDown",label:"B Play Face-Down",kind:"play",player:"B",faceDown:true}
];

const PRESET_LABELS={
  showdown:"Showdown Demo",
  queens:"Queen Lab",
  copiedMods:"Copied Modify Lab"
};

function clone(v){return JSON.parse(JSON.stringify(v));}

function cardLabel(card){return `${card.id} - ${card.rank}${card.suit} ${card.name}`;}

function sanitizeCard(state,cardId){
  const next=clone(state);
  ["aHand","bHand","aDiscard","bDiscard","scrap","aDeck","bDeck","newCards"].forEach(key=>{
    next[key]=(next[key]||[]).filter(id=>id!==cardId);
  });
  next.aPlay=(next.aPlay||[]).filter(entry=>entry.id!==cardId);
  next.bPlay=(next.bPlay||[]).filter(entry=>entry.id!==cardId);
  return next;
}

function createSandboxPreset(key,makeFreshGame){
  const g=makeFreshGame();
  const removeUsed=used=>{
    g.aDeck=g.aDeck.filter(id=>!used.includes(id));
    g.bDeck=g.bDeck.filter(id=>!used.includes(id));
  };
  if(key==="showdown"){
    const used=["10H","10D","JC","5D","8D","9H","9D","9S","QC","QD"];
    removeUsed(used);
    g.phase="reveal";
    g.currentPlayer="A";
    g.firstPlayer="A";
    g.aChips=3;
    g.bChips=2;
    g.aHand=["10H","10D","JC","5D","8D"];
    g.bHand=["9H","9D","9S","QC","QD"];
    g.aPlay=[{id:"5D",faceDown:false},{id:"8D",faceDown:false}];
    g.bPlay=[];
    g.aMods=[{target:"JC",rank:"10",suit:"H"}];
    g.bMods=[];
    g._revealWinner="A";
    g._revealAE={handName:"Flush House"};
    g._revealBE={handName:"Full House"};
    g.log=[`=== SANDBOX: ${PRESET_LABELS[key]} ===`,`A: Flush House`,`B: Full House`,`Player A wins the chip!`];
    return g;
  }
  if(key==="queens"){
    const used=["2C","2D","10D","5D","8D","QC","QD","6C","6D","6H","6S"];
    removeUsed(used);
    g.phase="score";
    g.currentPlayer="A";
    g.firstPlayer="A";
    g.aHand=["2C","2D","10D","5D","8D"];
    g.bHand=["6C","6D","6H","6S","QC"];
    g.scrap=["QC","QD"];
    g.aPlay=[{id:"10D",faceDown:false}];
    g.bPlay=[];
    g.log=[`=== SANDBOX: ${PRESET_LABELS[key]} ===`,`Queens in scrap are active.`,`Start scoring to test unmodified 2s.`];
    return g;
  }
  if(key==="copiedMods"){
    const used=["10S","JD","JH","10C","9C","8C","7C","6C","5C","4C","3C","2C"];
    removeUsed(used);
    g.phase="score";
    g.currentPlayer="A";
    g.firstPlayer="A";
    g.aHand=["10C","9C","8C","7C","6C"];
    g.bHand=["5C","4C","3C","2C","JH"];
    g.aPlay=[{id:"10S",faceDown:false},{id:"JD",faceDown:false,copiedFrom:"10S"}];
    g.bPlay=[];
    g.log=[`=== SANDBOX: ${PRESET_LABELS[key]} ===`,`Duplicate is copying Nerf.`,`Run scoring to confirm both modifies resolve.`];
    return g;
  }
  return g;
}

export default function PlaytestPanel({gs,onReplaceGameState,makeFreshGame,cards,onOpenGallery,onOpenSoloArt}){
  const [open,setOpen]=useState(false);
  const [selectedCard,setSelectedCard]=useState(cards[0]?.id||"2C");
  const [selectedZone,setSelectedZone]=useState("aHand");
  const sortedCards=useMemo(()=>[...cards].sort((a,b)=>a.id.localeCompare(b.id)),[cards]);

  if(!gs)return null;

  const patchState=updater=>{
    const next=typeof updater==="function"?updater(gs):updater;
    onReplaceGameState(next);
  };

  const applyQuickPhase=phase=>patchState(prev=>({...clone(prev),phase}));
  const adjustChip=(player,delta)=>patchState(prev=>{
    const next=clone(prev),key=player==="A"?"aChips":"bChips";
    next[key]=Math.max(0,Math.min(7,(next[key]||0)+delta));
    return next;
  });
  const clearZone=zoneKey=>patchState(prev=>{
    const next=clone(prev);
    if(zoneKey==="aPlay"||zoneKey==="bPlay")next[zoneKey]=[];
    else next[zoneKey]=[];
    return next;
  });
  const addSelectedCard=()=>patchState(prev=>{
    const next=sanitizeCard(prev,selectedCard);
    const zone=ZONE_DEFS.find(entry=>entry.key===selectedZone);
    if(!zone)return next;
    if(zone.kind==="cards")next[zone.key]=[...(next[zone.key]||[]),selectedCard];
    if(zone.kind==="deckTop"){
      const deckKey=zone.key.startsWith("a")?"aDeck":"bDeck";
      next[deckKey]=[selectedCard,...(next[deckKey]||[])];
    }
    if(zone.kind==="deckBottom"){
      const deckKey=zone.key.startsWith("a")?"aDeck":"bDeck";
      next[deckKey]=[...(next[deckKey]||[]),selectedCard];
    }
    if(zone.kind==="play"){
      const playKey=zone.player==="A"?"aPlay":"bPlay";
      next[playKey]=[...(next[playKey]||[]),{id:selectedCard,faceDown:zone.faceDown}];
    }
    if(selectedZone==="aHand")next.aHand=[...next.aHand].sort();
    if(selectedZone==="bHand")next.bHand=[...next.bHand].sort();
    return next;
  });
  const trimHandsForScoring=()=>patchState(prev=>{
    const next=clone(prev);
    next.aHand=(next.aHand||[]).slice(0,5);
    next.bHand=(next.bHand||[]).slice(0,5);
    next.phase="score";
    next.log=[...(next.log||[]),`=== SANDBOX: hands trimmed to 5 for scoring ===`];
    return next;
  });
  const loadPreset=key=>onReplaceGameState(createSandboxPreset(key,makeFreshGame));

  return(
    <div style={{background:"linear-gradient(180deg,#0a0d11f2,#0a1016f2)",border:"1px solid #1f2937",borderRadius:12,padding:10,boxShadow:"0 -10px 30px #00000022"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <button onClick={()=>setOpen(v=>!v)} style={{padding:"5px 12px",borderRadius:8,background:"#111827",border:"1px solid #334155",color:"#cbd5e1",cursor:"pointer",fontSize:10,fontWeight:700,letterSpacing:1}}>
          {open?"Hide":"Show"} Playtest
        </button>
        <span style={{fontSize:10,color:"#64748b"}}>Sandbox tools and hidden prototype links</span>
        {open&&<>
          {onOpenGallery&&<button onClick={onOpenGallery} style={{padding:"4px 10px",borderRadius:999,border:"1px solid #ec5da866",background:"#f8b4d922",color:"#f8b4d9",cursor:"pointer",fontSize:10,fontWeight:700}}>Card Image Gallery</button>}
          {onOpenSoloArt&&<button onClick={onOpenSoloArt} style={{padding:"4px 10px",borderRadius:999,border:"1px solid #60a5fa66",background:"#60a5fa22",color:"#93c5fd",cursor:"pointer",fontSize:10,fontWeight:700}}>Solo Art Test</button>}
        </>}
      </div>
      {open&&<div style={{marginTop:10,display:"grid",gap:12}}>
        <div style={{display:"grid",gap:8}}>
          <div style={{fontSize:9,color:"#94a3b8",fontWeight:700,letterSpacing:1}}>QUICK STATE</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <button onClick={()=>onReplaceGameState(makeFreshGame())} style={{padding:"5px 10px",borderRadius:7,background:"#1d4ed8",border:"none",color:"#eff6ff",cursor:"pointer",fontSize:10,fontWeight:700}}>Fresh Game</button>
            <button onClick={()=>patchState(prev=>({...clone(prev),currentPlayer:prev.currentPlayer==="A"?"B":"A"}))} style={{padding:"5px 10px",borderRadius:7,background:"#172033",border:"1px solid #334155",color:"#cbd5e1",cursor:"pointer",fontSize:10,fontWeight:700}}>Swap Player</button>
            <button onClick={()=>patchState(prev=>({...clone(prev),log:[]}))} style={{padding:"5px 10px",borderRadius:7,background:"#172033",border:"1px solid #334155",color:"#cbd5e1",cursor:"pointer",fontSize:10,fontWeight:700}}>Clear Log</button>
            <button onClick={trimHandsForScoring} style={{padding:"5px 10px",borderRadius:7,background:"#172033",border:"1px solid #334155",color:"#cbd5e1",cursor:"pointer",fontSize:10,fontWeight:700}}>Trim to Score</button>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {["action","score","reveal","gameOver"].map(phase=><button key={phase} onClick={()=>applyQuickPhase(phase)} style={{padding:"4px 10px",borderRadius:999,border:"1px solid "+(gs.phase===phase?"#f1c40f55":"#334155"),background:gs.phase===phase?"#f1c40f1c":"#0f172a",color:gs.phase===phase?"#f8e08a":"#94a3b8",cursor:"pointer",fontSize:10,fontWeight:700,textTransform:"uppercase"}}>{phase}</button>)}
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",fontSize:10,color:"#94a3b8"}}>
            <span>Current: <strong style={{color:"#e2e8f0"}}>{gs.currentPlayer}</strong></span>
            <span>First: <strong style={{color:"#e2e8f0"}}>{gs.firstPlayer}</strong></span>
            <span>Round: <strong style={{color:"#e2e8f0"}}>{gs.round}</strong></span>
            <span>Actions Required: <strong style={{color:"#e2e8f0"}}>{gs.actionsRequired}</strong></span>
            <span>Bonus: <strong style={{color:"#e2e8f0"}}>{gs.bonusActions}</strong></span>
          </div>
          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            {["A","B"].map(player=><div key={player} style={{display:"flex",alignItems:"center",gap:6,background:"#0f172a",border:"1px solid #334155",borderRadius:8,padding:"4px 6px"}}>
              <span style={{fontSize:10,color:player==="A"?"#fca5a5":"#93c5fd",fontWeight:800}}>P{player}</span>
              <button onClick={()=>adjustChip(player,-1)} style={{width:22,height:22,borderRadius:6,border:"1px solid #334155",background:"#111827",color:"#cbd5e1",cursor:"pointer"}}>-</button>
              <span style={{minWidth:12,textAlign:"center",fontSize:11,color:"#e2e8f0",fontWeight:800}}>{player==="A"?gs.aChips:gs.bChips}</span>
              <button onClick={()=>adjustChip(player,1)} style={{width:22,height:22,borderRadius:6,border:"1px solid #334155",background:"#111827",color:"#cbd5e1",cursor:"pointer"}}>+</button>
            </div>)}
          </div>
        </div>

        <div style={{display:"grid",gap:8}}>
          <div style={{fontSize:9,color:"#94a3b8",fontWeight:700,letterSpacing:1}}>PRESETS</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {Object.keys(PRESET_LABELS).map(key=><button key={key} onClick={()=>loadPreset(key)} style={{padding:"5px 10px",borderRadius:7,background:"#172033",border:"1px solid #334155",color:"#cbd5e1",cursor:"pointer",fontSize:10,fontWeight:700}}>
              {PRESET_LABELS[key]}
            </button>)}
          </div>
        </div>

        <div style={{display:"grid",gap:8}}>
          <div style={{fontSize:9,color:"#94a3b8",fontWeight:700,letterSpacing:1}}>CARD INJECTION</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <select value={selectedCard} onChange={e=>setSelectedCard(e.target.value)} style={{minWidth:210,padding:"6px 8px",borderRadius:8,background:"#0f172a",border:"1px solid #334155",color:"#e2e8f0",fontSize:11}}>
              {sortedCards.map(card=><option key={card.id} value={card.id}>{cardLabel(card)}</option>)}
            </select>
            <select value={selectedZone} onChange={e=>setSelectedZone(e.target.value)} style={{padding:"6px 8px",borderRadius:8,background:"#0f172a",border:"1px solid #334155",color:"#e2e8f0",fontSize:11}}>
              {ZONE_DEFS.map(zone=><option key={zone.key} value={zone.key}>{zone.label}</option>)}
            </select>
            <button onClick={addSelectedCard} style={{padding:"6px 12px",borderRadius:8,background:"#2ecc71",border:"none",color:"#081018",cursor:"pointer",fontSize:10,fontWeight:800}}>Add Card</button>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {["aHand","bHand","aDiscard","bDiscard","scrap","aPlay","bPlay"].map(zone=><button key={zone} onClick={()=>clearZone(zone)} style={{padding:"4px 10px",borderRadius:999,background:"#111827",border:"1px solid #334155",color:"#94a3b8",cursor:"pointer",fontSize:10,fontWeight:700}}>
              Clear {zone}
            </button>)}
          </div>
          <div style={{display:"grid",gap:4,fontSize:10,color:"#64748b"}}>
            <div>A hand {gs.aHand.length} • B hand {gs.bHand.length} • Scrap {gs.scrap.length}</div>
            <div>A discard {gs.aDiscard.length} • B discard {gs.bDiscard.length} • A play {gs.aPlay.length} • B play {gs.bPlay.length}</div>
          </div>
        </div>
      </div>}
    </div>
  );
}
