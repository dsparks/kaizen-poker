import { useState, useCallback, useRef } from "react";
import PlaytestPanel from "./PlaytestPanel.jsx";
import {
  archiveCompletedTrackedGame,
  appendTrackedEvent,
  buildRoundSummary,
  buildTrackedGame,
  finalizeTrackedGame,
  saveActiveTrackedGame,
  upsertTrackedRound,
} from "./analytics.js";
import { syncTrackedGame } from "./supabaseAnalytics.js";

// ============================================================
// DATA (unchanged)
// ============================================================
const SUITS={C:"♣",D:"♦",H:"♥",S:"♠"};
const SC={C:"#2ecc71",D:"#f39c12",H:"#e74c3c",S:"#3498db"};
const SO=["C","D","H","S"];
export const RO=["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
export const RV=Object.fromEntries(RO.map((r,i)=>[r,i]));
export const FACE=["J","Q","K"];
export function lowerRanks(rank){return rank==="2"?["A"]:RO.filter(r=>RV[r]<RV[rank])}
export function higherRanks(rank){return rank==="A"?RO.filter(r=>r!=="A"):RO.filter(r=>RV[r]>RV[rank])}
export function adjacentRanks(rank){
  if(rank==="2")return ["A","3"];
  if(rank==="A")return ["K","2"];
  const ci=RV[rank],opts=[];if(ci>0)opts.push(RO[ci-1]);if(ci<12)opts.push(RO[ci+1]);return opts;
}
const TI={Enact:{bg:"#f5efe1",bd:"#8d6e63",ink:"#2f241d",tagBg:"#ece1cd",lb:"Enact"},Modify:{bg:"#f7f0dc",bd:"#c89b3c",ink:"#302515",tagBg:"#efe0b7",lb:"Modify"},
  React:{bg:"#e9f2ea",bd:"#4d8b6f",ink:"#1f3229",tagBg:"#d5e6d7",lb:"React"},Amend:{bg:"#f6e4df",bd:"#a85045",ink:"#351f1b",tagBg:"#ecd1ca",lb:"Amend"},
  Remember:{bg:"#ece8f8",bd:"#6d5b9c",ink:"#251f39",tagBg:"#ddd5f0",lb:"Remember"}};
export const CARDS=[
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
{id:"8H",rank:"8",suit:"H",name:"Reject",type:"Enact",text:"Look at top of deck. You may scrap it."},
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
export const CM=Object.fromEntries(CARDS.map(c=>[c.id,c]));
const TC=["#718096","#48bb78","#38b2ac","#4299e1","#667eea","#9f7aea","#ed64a6","#f56565","#ed8936","#f6e05e","#fefcbf","#fc8181","#fbb6ce","#fff5f5"];
const SOLO_TARGET_CHIPS=13;
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

// ============================================================
// ENGINE
// ============================================================
function shuf(a){const r=[...a];for(let i=r.length-1;i>0;i--){const j=0|Math.random()*(i+1);[r[i],r[j]]=[r[j],r[i]]}return r}
function sortC(ids){return[...ids].sort((a,b)=>{const ca=CM[a],cb=CM[b];return(RV[ca.rank]-RV[cb.rank])||SO.indexOf(ca.suit)-SO.indexOf(cb.suit)})}
function drawCards(gs,player,n){
  const st={...gs};const dk=player==="A"?[...st.aDeck]:[...st.bDeck];
  const dc=player==="A"?[...st.aDiscard]:[...st.bDiscard];
  const hand=player==="A"?[...st.aHand]:[...st.bHand];const drawn=[];
  for(let i=0;i<n;i++){if(!dk.length){if(!dc.length)return{...st,error:"DECK_EXHAUSTED"};dk.push(...shuf(dc));dc.length=0;}
    drawn.push(dk.shift());hand.push(drawn[drawn.length-1]);}
  if(player==="A"){st.aDeck=dk;st.aDiscard=dc;st.aHand=hand}else{st.bDeck=dk;st.bDiscard=dc;st.bHand=hand}
  return{...st,drawn};}
export function evalHand(cardIds,mods=[]){
  let eff=cardIds.map(id=>{const b=CM[id];const m=mods.find(x=>x.target===id);
    return m?{...b,rank:m.rank||b.rank,suit:m.suit||b.suit,mod:true}:{...b,mod:false}});
  const ranks=eff.map(c=>c.rank),suits=eff.map(c=>c.suit);
  const rv=ranks.map(r=>RV[r]).sort((a,b)=>b-a);
  const rc={};ranks.forEach(r=>{rc[r]=(rc[r]||0)+1});const sc={};suits.forEach(s=>{sc[s]=(sc[s]||0)+1});
  const rsc={};eff.forEach(c=>{const k=c.rank+c.suit;rsc[k]=(rsc[k]||0)+1});
  const maxId=Math.max(...Object.values(rsc));const isFlush=Object.values(sc).some(c=>c===5);
  const sv=[...new Set(rv)].sort((a,b)=>a-b);
  const isWheel=sv.join(",")==="0,1,2,3,12";
  let isStr=sv.length===5&&(sv[4]-sv[0]===4||isWheel);
  const straightHigh=isWheel?3:Math.max(...sv);
  const byCountThenRank=Object.entries(rc).map(([r,c])=>({rank:r,count:c,val:RV[r]})).sort((a,b)=>(b.count-a.count)||(b.val-a.val));
  const pairVals=byCountThenRank.filter(x=>x.count===2).map(x=>x.val).sort((a,b)=>b-a);
  const singleVals=byCountThenRank.filter(x=>x.count===1).map(x=>x.val).sort((a,b)=>b-a);
  const cnts=Object.values(rc).sort((a,b)=>b-a);let twins=Object.values(rsc).some(c=>c>=2);
  let hr=0,hn="High Card";
  if(maxId===5){hr=13;hn="Flush Five"}else if(cnts[0]===3&&cnts[1]===2&&isFlush){hr=12;hn="Flush House"}
  else if(cnts[0]===5){hr=11;hn="Five of a Kind"}else if(isStr&&isFlush&&sv.includes(12)&&sv.includes(11)){hr=10;hn="Royal Flush"}
  else if(isStr&&isFlush){hr=9;hn="Straight Flush"}else if(cnts[0]===4){hr=8;hn="Four of a Kind"}
  else if(cnts[0]===3&&cnts[1]===2){hr=7;hn="Full House"}else if(isFlush){hr=6;hn="Flush"}
  else if(isStr){hr=5;hn="Straight"}else if(cnts[0]===3){hr=4;hn="Three of a Kind"}
  else if(cnts[0]===2&&cnts[1]===2){const pr=Object.entries(rc).filter(([,c])=>c===2);hr=twins&&pr.length===1?2:3;hn=hr===2?"Twins":"Two Pair"}
  else if(cnts[0]===2){hr=twins?2:1;hn=hr===2?"Twins":"Pair"}
  let rankVals=rv;
  if(hr===13||hr===11)rankVals=[byCountThenRank[0]?.val??-1];
  else if(hr===12||hr===7)rankVals=[byCountThenRank[0]?.val??-1,byCountThenRank[1]?.val??-1];
  else if(hr===10||hr===9||hr===5)rankVals=[straightHigh];
  else if(hr===8)rankVals=[byCountThenRank[0]?.val??-1,byCountThenRank[1]?.val??-1];
  else if(hr===4)rankVals=[byCountThenRank[0]?.val??-1,...singleVals];
  else if(hr===3)rankVals=[...pairVals,...singleVals];
  else if(hr===2||hr===1)rankVals=[pairVals[0]??-1,...singleVals];
  return{handRank:hr,handName:hn,rankVals,effective:eff};}
export function compareHands(a,b,am=[],bm=[]){const ae=evalHand(a,am),be=evalHand(b,bm);
  if(ae.handRank!==be.handRank)return ae.handRank>be.handRank?"A":"B";
  for(let i=0;i<ae.rankVals.length;i++){if(ae.rankVals[i]>be.rankVals[i])return"A";if(ae.rankVals[i]<be.rankVals[i])return"B";}return"TIE";}
function evalChallenger(cardId){
  const card=CM[cardId];
  const lookup=card?CHALLENGER_LOOKUP[card.rank]:null;
  if(!card||!lookup)return {card:null,handRank:13,handName:"Flush Five",description:"No Challenger card available"};
  return {card,rank:card.rank,...lookup};
}
function isMatchOver(gs){
  return gs.mode==="solo" ? (gs.aChips+gs.bChips)>=(gs._soloTarget||SOLO_TARGET_CHIPS) : (gs.aChips>=7||gs.bChips>=7);
}
function getMatchWinner(gs){
  return gs.mode==="solo" ? (gs.aChips>gs.bChips?"A":"B") : (gs.aChips>=7?"A":"B");
}
function initGame(mode="hotseat"){const all=shuf(CARDS.map(c=>c.id));
  const startedAt=new Date().toISOString();
  const gameId=(typeof crypto!=="undefined"&&crypto.randomUUID)?crypto.randomUUID():`kp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const aInitialDeck=all.slice(0,26),bInitialDeck=all.slice(26),aInitialHand=aInitialDeck.slice(0,7),bInitialHand=mode==="solo"?[]:bInitialDeck.slice(0,7);
  return{mode,aDeck:all.slice(7,26),bDeck:mode==="solo"?bInitialDeck:bInitialDeck.slice(7),aHand:sortC(all.slice(0,7)),bHand:mode==="solo"?[]:sortC(all.slice(26,33)),
    aDiscard:[],bDiscard:[],aPlay:[],bPlay:[],scrap:[],aChips:0,bChips:0,round:1,firstPlayer:"A",
    phase:"action",currentPlayer:"A",regularActionsPlayed:0,actionsRequired:2,bonusActions:0,
    log:[],amends:{aFreeze:false,bFreeze:false,aNegate:false,bNegate:false},newCards:[],aMods:[],bMods:[],aForecast:[],bForecast:[],_aReq:2,_bReq:2,
    _soloTarget:SOLO_TARGET_CHIPS,_soloReveal:null,_soloRevealedCards:[],_gameId:gameId,_createdAt:startedAt,_aInitialDeck:aInitialDeck,_bInitialDeck:bInitialDeck,_aInitialHand:sortC(aInitialHand),_bInitialHand:sortC(bInitialHand)};}
function cloneGs(gs){return JSON.parse(JSON.stringify(gs));}

// ============================================================
// SIMPLE UI COMPONENTS
// ============================================================
function Card({id,selected,onClick,dimmed,small,glow,isNew,onMouseEnter,onMouseLeave,onMouseMove,onDoubleClick,onInspect,rankSticker,suitSticker,copySticker}){const c=CM[id];if(!c)return null;
  const w=small?68:120,h=small?95:168,ti=TI[c.type];
  const baseTransform=selected?"translateY(-4px)":isNew?"translateY(-3px)":"translateY(0)";
  const paperBg=small?`linear-gradient(180deg,${ti.bg},#e7dcc6)`:`linear-gradient(180deg,#fbf7ef 0%,${ti.bg} 22%,#e6dcc8 100%)`;
  return(<div className={`kp-card${small?" kp-card-small":""}${onClick?" kp-card-clickable":""}${selected?" kp-card-selected":""}${isNew?" kp-card-new":""}`}
    onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onMouseMove={onMouseMove} onDoubleClick={onDoubleClick}
    title={small?"Hover to preview, use View to pin":undefined} style={{width:w,height:h,borderRadius:8,flexShrink:0,position:"relative",
    border:selected?`2px solid #f1c40f`:isNew?`2px solid #2ecc71`:glow?`2px solid ${glow}`:`1px solid ${ti.bd}44`,
    background:paperBg,
    boxShadow:selected?"0 0 12px #f1c40f44, 0 8px 18px #00000026":isNew?"0 0 14px #2ecc7155, 0 8px 18px #00000026":glow?`0 0 12px ${glow}44, 0 8px 18px #00000026`:"0 4px 12px #00000026",
    cursor:onClick?"pointer":"default",display:"flex",flexDirection:"column",
    padding:small?"4px 5px":"7px 9px",overflow:"hidden",opacity:dimmed?0.3:1,transition:"all 0.15s",
    transform:baseTransform}}>
    {isNew&&<div style={{position:"absolute",top:small?2:4,right:small?3:6,fontSize:small?6:8,fontWeight:900,color:"#2ecc71",background:"#2ecc7122",borderRadius:3,padding:"0 4px"}}>NEW</div>}
    {small&&onInspect&&<button onClick={e=>{e.stopPropagation();onInspect();}} aria-label="Inspect card" title="Pin card preview" style={{position:"absolute",top:2,right:2,width:16,height:16,padding:0,borderRadius:"50%",border:"1px solid #00000018",background:"#f6efe0dd",color:"#3b3228",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2,boxShadow:"0 1px 2px #00000022"}}>
      <svg width="9" height="9" viewBox="0 0 12 12" aria-hidden="true">
        <circle cx="5" cy="5" r="3.2" fill="none" stroke="#3b3228" strokeWidth="1.4"/>
        <path d="M7.6 7.6L10.5 10.5" stroke="#3b3228" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    </button>}
    {copySticker&&<div style={{position:"absolute",top:small?18:22,right:small?1:4,transform:"rotate(8deg)",background:"linear-gradient(180deg,#fff4a8,#f6dd69)",color:"#5a4618",border:"1px solid #d4bb5a",borderRadius:small?3:4,padding:small?"4px 5px 5px":"6px 8px 7px",fontSize:small?7:8,fontWeight:900,letterSpacing:.3,boxShadow:"0 3px 8px #00000024, inset 0 1px 0 #fff9cc",zIndex:2,textTransform:"uppercase",lineHeight:1.05,minWidth:small?38:48,textAlign:"center"}}>
      <div style={{position:"absolute",top:0,left:"18%",right:"18%",height:small?3:4,borderRadius:"0 0 3px 3px",background:"#fff8d0aa"}}/>
      <div>COPY OF</div>
      <div style={{marginTop:2,fontSize:small?6:7,letterSpacing:.05,textTransform:"none",fontWeight:800,lineHeight:1.05}}>{copySticker}</div>
    </div>}
    {rankSticker&&<div style={{position:"absolute",top:small?18:26,left:small?3:5,transform:"rotate(-7deg)",background:"linear-gradient(180deg,#fee089,#f7bf4f)",color:"#4a3412",border:"1px solid #bf8d30",borderRadius:small?6:8,padding:small?"1px 4px":"2px 8px",fontSize:small?9:14,fontWeight:900,fontFamily:"Georgia,serif",boxShadow:"0 2px 6px #00000022",zIndex:2,lineHeight:1}}>
      {rankSticker}
    </div>}
    {suitSticker&&<div style={{position:"absolute",top:small?18:26,left:small?18:30,transform:"rotate(9deg)",background:"linear-gradient(180deg,#fffaf0,#f1e0be)",color:SC[suitSticker]||"#3b3228",border:"1px solid #bda274",borderRadius:"50%",width:small?13:20,height:small?13:20,fontSize:small?9:14,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 6px #00000020",zIndex:2}}>
      {SUITS[suitSticker]||suitSticker}
    </div>}
    <div style={{position:"absolute",right:small?5:10,bottom:small?18:24,fontSize:small?28:54,opacity:small?0.08:0.09,color:SC[c.suit],fontFamily:"Georgia,serif",fontWeight:700,transform:"rotate(-8deg)",pointerEvents:"none"}}>
      {SUITS[c.suit]}
    </div>
    <div style={{display:"flex",alignItems:"center",gap:1}}>
      <span style={{fontSize:small?20:32,fontWeight:900,color:SC[c.suit],lineHeight:1,fontFamily:"Georgia,serif"}}>{c.rank}</span>
      <span style={{fontSize:small?14:20,color:SC[c.suit],marginTop:small?1:3}}>{SUITS[c.suit]}</span></div>
    <div style={{fontSize:small?8:14,fontWeight:700,color:ti.ink,marginTop:1,fontFamily:"Georgia,serif",lineHeight:1.1,textShadow:"0 1px 0 rgba(255,255,255,.35)"}}>{c.name}</div>
    <div style={{fontSize:small?6:8,color:ti.bd,fontWeight:800,textTransform:"uppercase",letterSpacing:1,marginTop:2,alignSelf:"flex-start",background:ti.tagBg,padding:small?"1px 4px":"2px 6px",borderRadius:999,border:`1px solid ${ti.bd}33`}}>{ti.lb}</div>
    {!small&&<div style={{fontSize:9,color:"#3e3a35",marginTop:"auto",lineHeight:1.3,paddingTop:5,fontFamily:"Georgia,serif"}}>{c.text}</div>}
  </div>);}
function PreviewCard(props){const[hover,setHover]=useState(false);const[pinned,setPinned]=useState(false);const[pos,setPos]=useState({x:0,y:0});
  const previewX=Math.min((typeof window!=="undefined"?window.innerWidth:1280)-160,Math.max(16,pos.x+20));
  const previewY=Math.min((typeof window!=="undefined"?window.innerHeight:900)-220,Math.max(16,pos.y-30));
  return(<>
    <Card {...props} small onInspect={()=>setPinned(true)}
      onMouseEnter={e=>{setHover(true);setPos({x:e.clientX,y:e.clientY});}}
      onMouseLeave={()=>setHover(false)}
      onMouseMove={e=>setPos({x:e.clientX,y:e.clientY})}
      onDoubleClick={()=>setPinned(true)}/>
    {hover&&!pinned&&<div style={{position:"fixed",left:previewX,top:previewY,zIndex:1200,pointerEvents:"none",animation:"inspectPop 0.12s ease-out"}}>
      <Card id={props.id} rankSticker={props.rankSticker} suitSticker={props.suitSticker} copySticker={props.copySticker}/>
    </div>}
    {pinned&&<Modal title={`${CM[props.id]?.rank||""}${SUITS[CM[props.id]?.suit]||""} ${CM[props.id]?.name||"Card"}`}>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
        <Card id={props.id} rankSticker={props.rankSticker} suitSticker={props.suitSticker} copySticker={props.copySticker}/>
        <Btn label="Close" bg="#333" onClick={()=>setPinned(false)}/>
      </div>
    </Modal>}
  </>);}
function HandBadge({ids,mods}){if(!ids||ids.length!==5)return null;const r=evalHand(ids,mods);const c=TC[r.handRank];
  return <span style={{padding:"3px 10px",borderRadius:5,background:`${c}18`,border:`1px solid ${c}44`,color:c,fontWeight:700,fontSize:12,fontFamily:"Georgia,serif",whiteSpace:"nowrap"}}>{r.handName}</span>;}
function Btn({label,bg="#333",onClick,disabled}){return(<button onClick={onClick} disabled={disabled} style={{padding:"8px 16px",background:disabled?"#222":bg,color:bg==="#333"||disabled?"#94a3b8":"#081018",border:"1px solid "+(bg==="#333"?"#334155":"#ffffff22"),borderRadius:10,fontWeight:800,cursor:disabled?"default":"pointer",fontSize:12,opacity:disabled?0.5:1,boxShadow:disabled?"none":"0 8px 18px #00000033, inset 0 1px 0 #ffffff22",transform:"translateY(0)",transition:"transform 0.15s, box-shadow 0.15s, opacity 0.15s"}}>{label}</button>);}
function Chip({filled,color,label,active}){return <div style={{width:22,height:22,borderRadius:"50%",display:"grid",placeItems:"center",position:"relative",
  background:filled?`radial-gradient(circle at 35% 30%,#fff8,${color} 25%,${color}dd 58%,#0008 100%)`:"radial-gradient(circle at 35% 30%,#32404d,#18202a 68%,#081018 100%)",
  border:`2px solid ${filled?`${color}aa`:"#445262"}`,boxShadow:filled?`0 0 14px ${color}55, inset 0 1px 0 #fff8, 0 6px 12px #0005`:"inset 0 1px 0 #ffffff14, 0 4px 10px #0004",
  transform:active?"translateY(-2px) scale(1.06)":"none",transition:"transform .18s, box-shadow .18s"}}>
  <div style={{position:"absolute",inset:3,borderRadius:"50%",border:`2px dashed ${filled?"#fff8":"#73839655"}`}}/>
  <span style={{fontSize:9,fontWeight:900,color:filled?"#fff7e8":"#8ea0b4",fontFamily:"Georgia,serif",textShadow:"0 1px 2px #0008"}}>{label}</span>
</div>;}

// Draggable Modal
function Modal({title,children}){const[pos,setPos]=useState({x:0,y:0});const dr=useRef(false),off=useRef({x:0,y:0});
  const onD=e=>{dr.current=true;off.current={x:e.clientX-pos.x,y:e.clientY-pos.y};
    const mv=e2=>{if(dr.current)setPos({x:e2.clientX-off.current.x,y:e2.clientY-off.current.y})};
    const up=()=>{dr.current=false;window.removeEventListener("mousemove",mv);window.removeEventListener("mouseup",up)};
    window.addEventListener("mousemove",mv);window.addEventListener("mouseup",up);};
  return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
    <div className="kp-modal-shell" style={{background:"#111827",border:"1px solid #333",borderRadius:12,padding:20,maxWidth:620,width:"90%",maxHeight:"80vh",overflowX:"hidden",overflowY:"auto",left:pos.x,top:pos.y,position:"relative"}}>
      <div onMouseDown={onD} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,cursor:"grab",userSelect:"none",padding:"0 0 8px",borderBottom:"1px solid #222"}}>
        <div style={{fontSize:15,fontWeight:700,color:"#f1c40f",fontFamily:"Georgia,serif"}}>{title}</div>
        <span style={{fontSize:9,color:"#334"}}>drag to move</span></div>
      {children}</div></div>);}

// Multi-select modal (as proper component, not IIFE)
function MultiPickModal({title,cards,maxPick,onPick,btnLabel="Confirm"}){const[pk,setPk]=useState([]);
  return(<Modal title={title}><div style={{fontSize:11,color:"#667",marginBottom:6}}>Select up to {maxPick}</div>
    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
      {cards.map(id=>(<PreviewCard key={id} id={id} selected={pk.includes(id)}
        onClick={()=>setPk(p=>p.includes(id)?p.filter(x=>x!==id):p.length<maxPick?[...p,id]:p)}/>))}</div>
    <Btn label={`${btnLabel} (${pk.length})`} bg={pk.length?"#f1c40f":"#333"} disabled={!pk.length} onClick={()=>pk.length&&onPick(pk)}/></Modal>);}

// Brainstorm: pick 3 in order
function BrainstormModal({hand,newCards,onPick}){const[pk,setPk]=useState([]);
  const toggle=id=>setPk(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  return(<Modal title="Brainstorm: Put 3 cards on top (tap in order, 1st = top)">
    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
      {hand.map(id=>{const idx=pk.indexOf(id);return(<div key={id} style={{position:"relative"}}>
        <PreviewCard id={id} selected={idx>=0} isNew={(newCards||[]).includes(id)} onClick={()=>toggle(id)}/>
        {idx>=0&&<div style={{position:"absolute",top:2,left:2,background:"#f1c40f",color:"#000",borderRadius:10,width:18,height:18,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900}}>{idx+1}</div>}
      </div>);})}</div>
    {pk.length===3&&<div style={{fontSize:11,color:"#aaa",marginBottom:6}}>Top ➠ Bottom: {pk.map(id=>CM[id].name).join(" ➠ ")}</div>}
    <Btn label={`Put ${pk.length}/3 on top`} bg={pk.length===3?"#f1c40f":"#333"} disabled={pk.length!==3} onClick={()=>pk.length===3&&onPick(pk)}/></Modal>);}

// Rejuvenate: pick up to 3 to discard
function RejuvenateModal({hand,onPick}){const[pk,setPk]=useState([]);
  return(<Modal title="Rejuvenate: Discard up to 3, draw that many">
    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
      {hand.map(id=>(<PreviewCard key={id} id={id} selected={pk.includes(id)}
        onClick={()=>setPk(p=>p.includes(id)?p.filter(x=>x!==id):p.length<3?[...p,id]:p)}/>))}</div>
    <Btn label={`Discard ${pk.length} ➠ Draw ${pk.length}`} bg={pk.length?"#f1c40f":"#333"} disabled={!pk.length} onClick={()=>pk.length&&onPick(pk)}/></Modal>);}

// Deck knowledge tracker — shows cards player has seen (not in their deck)
function DeckStats({gs,player}){const[show,setShow]=useState(false);
  // "Seen" = hand + discard + play + scrap (all face-up public info + own hand)
  // Only count cards from THIS player's zones + shared scrap
  const hand=player==="A"?gs.aHand:gs.bHand;
  const disc=player==="A"?gs.aDiscard:gs.bDiscard;
  const myPlay=(player==="A"?gs.aPlay:gs.bPlay).map(a=>a.id);
  const oppPlay=(player==="A"?gs.bPlay:gs.aPlay).filter(a=>!a.faceDown).map(a=>a.id);
  const soloSeen=player==="B"&&gs.mode==="solo"?(gs._soloRevealedCards||[]):[];
  const seen=[...hand,...disc,...myPlay,...oppPlay,...gs.scrap,...soloSeen];
  const deckSize=(player==="A"?gs.aDeck:gs.bDeck).length;
  const rc={},sc={};seen.forEach(id=>{const c=CM[id];rc[c.rank]=(rc[c.rank]||0)+1;sc[c.suit]=(sc[c.suit]||0)+1;});
  const clr=player==="A"?"#e74c3c":"#3498db";
  if(!show)return(<button onClick={()=>setShow(true)} style={{padding:"2px 8px",borderRadius:4,fontSize:9,fontWeight:700,
    border:`1px solid ${clr}44`,background:"transparent",color:`${clr}99`,cursor:"pointer"}}>{player} Stats</button>);
  return(<div style={{background:"#0a0d11cc",border:`1px solid ${clr}33`,borderRadius:6,padding:6,fontSize:9}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
      <span style={{color:clr,fontWeight:700}}>{player} — {seen.length} seen, {deckSize} unseen in deck</span>
      <button onClick={()=>setShow(false)} style={{background:"none",border:"none",color:"#556",cursor:"pointer",fontSize:12}}>×</button></div>
    <div style={{display:"flex",gap:12}}>
      <div><div style={{color:"#556",marginBottom:2}}>Rank</div>
        {RO.map(r=>{if(!rc[r])return null;return(<div key={r} style={{display:"flex",gap:4,color:"#aab"}}><span style={{width:18}}>{r}</span><span>{rc[r]}/4</span></div>);})}</div>
      <div><div style={{color:"#556",marginBottom:2}}>Suit</div>
        {SO.map(s=>{if(!sc[s])return null;return(<div key={s} style={{display:"flex",gap:4,color:"#aab"}}><span style={{width:18,color:SC[s]}}>{SUITS[s]}</span><span>{sc[s]}/13</span></div>);})}</div>
    </div></div>);}

// Public zones
function PublicZones({gs,extraControls}){const[exp,setExp]=useState(null);
  const zones=[{key:"scrap",label:"Scrap",cards:gs.scrap,color:"#9b59b6"},{key:"aDiscard",label:"A Discard",cards:gs.aDiscard,color:"#e74c3c"},{key:"bDiscard",label:"B Discard",cards:gs.bDiscard,color:"#3498db"}];
  return(<div><div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
    {zones.map(z=>(<button key={z.key} onClick={()=>setExp(exp===z.key?null:z.key)} style={{padding:"3px 8px",borderRadius:4,fontSize:10,fontWeight:700,cursor:"pointer",
      border:`1px solid ${exp===z.key?z.color:z.color+"44"}`,background:exp===z.key?z.color+"1a":"transparent",color:exp===z.key?z.color:z.color+"99"}}>{z.label} ({z.cards.length})</button>))}
    {extraControls}
    <span style={{fontSize:10,color:"#334"}}>A deck:{gs.aDeck.length} · B deck:{gs.bDeck.length}</span></div>
    {exp&&(()=>{const z=zones.find(x=>x.key===exp);if(!z||!z.cards.length)return <div style={{fontSize:10,color:"#445",marginTop:4,fontStyle:"italic"}}>Empty</div>;
      return(<div style={{marginTop:6,padding:6,background:"#0a0d1188",borderRadius:6,border:`1px solid ${z.color}22`}}>
        <div style={{display:"flex",flexWrap:"wrap",gap:4}}>{sortC(z.cards).map((id,i)=><PreviewCard key={id+i} id={id}/>)}</div></div>);})()}</div>);}

// ============================================================
// MAIN APP
// ============================================================
export default function KaizenPoker(){
  const[gs,setGs]=useState(null);const[modal,setModal]=useState(null);const[fdMode,setFdMode]=useState(false);
  const[undoState,setUndoState]=useState(null); // snapshot before last action, for undo
  const[toast,setToast]=useState(null);
  const logRef=useRef(null);
  const toastTimerRef=useRef(null);
  const trackedRef=useRef(null);
  const syncTimerRef=useRef(null);

  const scheduleTrackedSync=()=>{
    if(!trackedRef.current)return;
    saveActiveTrackedGame(trackedRef.current);
    if(syncTimerRef.current)clearTimeout(syncTimerRef.current);
    syncTimerRef.current=setTimeout(()=>{const snap=trackedRef.current;if(snap)void syncTrackedGame(snap).catch(err=>console.error("Analytics sync failed",err));},500);
  };
  const setTracked=updater=>{
    trackedRef.current=typeof updater==="function"?updater(trackedRef.current):updater;
    scheduleTrackedSync();
    return trackedRef.current;
  };
  const trackEvent=(gLike,eventType,eventPayload={},opts={})=>{
    if(!trackedRef.current)return;
    setTracked(curr=>appendTrackedEvent(curr,gLike,eventType,eventPayload,opts));
  };
  const trackDraws=(gLike,playerSlot,cards,source)=>{
    (cards||[]).forEach(cardId=>trackEvent(gLike,"card_drawn",{cardId,source},{playerSlot}));
  };
  const trackRoundStart=gLike=>trackEvent(gLike,"round_started",{
    roundNumber:gLike.round,
    firstPlayer:gLike.firstPlayer,
    aHand:[...(gLike.aHand||[])],
    bHand:[...(gLike.bHand||[])],
    aActionsRequired:gLike._aReq||2,
    bActionsRequired:gLike._bReq||2,
    aCardsDrawn:(gLike.aHand||[]).length,
    bCardsDrawn:(gLike.bHand||[]).length,
  },{phase:"action",playerSlot:gLike.firstPlayer});
  const trackRoundSummary=gLike=>setTracked(curr=>upsertTrackedRound(curr,buildRoundSummary(gLike)));
  const trackGameFinished=(gLike,winner)=>{
    setTracked(curr=>finalizeTrackedGame(curr,gLike,winner));
    if(trackedRef.current){archiveCompletedTrackedGame(trackedRef.current);void syncTrackedGame(trackedRef.current).catch(err=>console.error("Analytics final sync failed",err));}
  };

  const flashToast=(msg,tone="info")=>{
    if(toastTimerRef.current)clearTimeout(toastTimerRef.current);
    setToast({msg,tone,key:Date.now()+Math.random()});
    toastTimerRef.current=setTimeout(()=>setToast(null),1800);
  };
  const maybeToastLog=msg=>{
    const clean=msg.replace(/^\.\.\./,"").replace(/\.$/,"").trim();
    if(!clean)return;
    if(/Frozen/i.test(clean)){flashToast(clean,"frozen");return;}
    if(/Fizzles?/i.test(clean)){flashToast(clean,"fizzle");return;}
    if(/cancelled/i.test(clean)){flashToast(clean,"cancel");}
  };
  const L=(gs,msg)=>{
    maybeToastLog(msg);
    if(trackedRef.current){
      const phase=gs?.phase==="gameOver"?"game_over":gs?.phase||"action";
      setTracked(curr=>appendTrackedEvent(curr,gs,"log_message",{message:msg},{phase,playerSlot:null}));
      if(/Frozen/i.test(msg)) setTracked(curr=>appendTrackedEvent(curr,gs,"action_frozen",{message:msg},{phase,playerSlot:null}));
      if(/Fizzles?/i.test(msg)) setTracked(curr=>appendTrackedEvent(curr,gs,"action_fizzled",{message:msg},{phase,playerSlot:null}));
      if(/cancelled/i.test(msg)) setTracked(curr=>appendTrackedEvent(curr,gs,"action_cancelled",{message:msg},{phase,playerSlot:null}));
    }
    return {...gs,log:[...gs.log,msg]};
  };
  const getH=(gs,p)=>p==="A"?gs.aHand:gs.bHand;const getD=(gs,p)=>p==="A"?gs.aDiscard:gs.bDiscard;
  const getDk=(gs,p)=>p==="A"?gs.aDeck:gs.bDeck;const getP=(gs,p)=>p==="A"?gs.aPlay:gs.bPlay;
  const opp=p=>p==="A"?"B":"A";
  const setZ=(gs,p,z,v)=>({...gs,[(p==="A"?"a":"b")+z[0].toUpperCase()+z.slice(1)]:v});
  const isFroz=(gs,p)=>p==="A"?gs.amends.aFreeze:gs.amends.bFreeze;
  const getActionCard=a=>a?.copiedFrom?(CM[a.copiedFrom]||CM[a.id]):CM[a?.id];
  const getModifyEntries=(g,pl)=>getP(g,pl).flatMap(a=>{
    if(a.faceDown)return [];
    const effect=getActionCard(a);
    if(effect?.type!=="Modify")return [];
    return [{sourceId:a.id,effectId:effect.id,copiedFrom:a.copiedFrom||null}];
  });
  const getAppliedMods=(g,pl)=>{
    const mk=pl==="A"?"aMods":"bMods";
    const queued=g[mk]||[];
    const free=queued.filter(m=>!m.sourceId);
    return [...free,...getP(g,pl).flatMap(a=>a.faceDown?[]:queued.filter(m=>m.sourceId===a.id))];
  };

  const buildFreshGame=(mode="hotseat")=>{let g=initGame(mode);g=L(g,`=== ROUND 1 === ${mode==="solo"?"Solo Mode":"Player A"} acts first`);
    g=L(g,`A: ${g.aHand.map(id=>`${CM[id].rank}${SUITS[CM[id].suit]} ${CM[id].name}`).join(", ")}`);
    if(mode==="solo")g=L(g,`Challenger Deck: ${g.bDeck.length} cards ready`);
    else g=L(g,`B: ${g.bHand.map(id=>`${CM[id].rank}${SUITS[CM[id].suit]} ${CM[id].name}`).join(", ")}`);return g;};
  const startGame=(mode="hotseat")=>{const g=buildFreshGame(mode);setTracked(buildTrackedGame(g));setGs(g);};
  const replaceSandboxState=nextGs=>{setModal(null);setFdMode(false);setUndoState(null);setTracked(buildTrackedGame(nextGs));setGs(nextGs);};

  // Actions that reveal new info (need confirmation, can't undo after)
  const REVEALS=new Set(["3C","3D","3S","4C","4D","4H","5C","8H","KC","KD","KH","AD","7H"]);

  const advance=(g)=>{let n={...g};
    if(n.bonusActions>0){n.bonusActions--;n=L(n,`${n.currentPlayer} has a bonus action!`);return n;}
    n.regularActionsPlayed++;if(n.regularActionsPlayed<n.actionsRequired)return n;
    setFdMode(false);setUndoState(null);
    if(n.mode==="solo"){n.phase="score";n=L(n,`--- SCORING ---`);return n;}
    if(n.currentPlayer===n.firstPlayer){n.currentPlayer=opp(n.firstPlayer);n.regularActionsPlayed=0;
      n.actionsRequired=n.currentPlayer==="A"?n._aReq:n._bReq;n=L(n,`--- ${n.currentPlayer}'s turn ---`);
    }else{n.phase="score";n=L(n,`--- SCORING ---`);}return n;};

  const playFD=(gs,cid)=>{let g={...gs};const p=g.currentPlayer;
    g=setZ(g,p,"hand",[...getH(g,p)].filter(id=>id!==cid));
    g=setZ(g,p,"play",[...getP(g,p),{id:cid,faceDown:true}]);return L(g,`${p} plays ${CM[cid].name} face-down`);};

  // --- CAPITALIZE CHECK: triggers when 8S is discarded from hand ---
  const checkCap=(g,player,discardedId,then)=>{
    // Check if discarded card IS Capitalize (8S) and player has it in play as React
    // Actually: Capitalize triggers when you discard it FROM YOUR HAND, not from play.
    // So check if discardedId === "8S"
    if(discardedId==="8S"){
      const frozen=isFroz(g,player);
      if(frozen){g=L(g,`${player}: Capitalize triggers but Frozen!`);setGs(g);then(g);return;}
      const disc=getD(g,player).filter(id=>id!==discardedId);
      if(!disc.length){then(g);return;}
      setModal({type:"pickFromList",title:`${player}: Capitalize! You discarded 8♠ — scrap a card?`,cards:disc,canCancel:true,
        onPick:id=>{setModal(null);let g2=cloneGs(g);g2=setZ(g2,player,"discard",[...getD(g2,player)].filter(x=>x!==id));
          g2.scrap=[...g2.scrap,id];g2=L(g2,`${player}: Capitalize scraps ${CM[id].name}`);setGs(g2);then(g2);},
        onCancel:()=>{setModal(null);then(g);}});return;}
    then(g);};

  // Helper: discard a card from hand with Capitalize check
  const discardFromHand=(g,player,cardId,then)=>{
    let g2=cloneGs(g);
    g2=setZ(g2,player,"hand",[...getH(g2,player)].filter(x=>x!==cardId));
    g2=setZ(g2,player,"discard",[...getD(g2,player),cardId]);
    trackEvent(g2,"card_discarded",{cardId,source:"hand"},{playerSlot:player});
    g2=L(g2,`${player} discards ${CM[cardId].name}`);setGs(g2);
    checkCap(g2,player,cardId,then);};

  const offerRefresh=(g,done)=>{const p=g.currentPlayer;if(!getH(g,p).length){done(g);return;}
    const opts=[{label:"Refresh (discard ➠ draw)",key:"refresh"}];
    if(g.scrap.includes("QH"))opts.push({label:"Sift (draw ➠ discard)",key:"sift"});
    if(g.scrap.includes("QS"))opts.push({label:"Declutter (scrap from discard)",key:"declutter"});
    opts.push({label:"Skip",key:"skip"});
    setModal({type:"refreshOpts",opts,onChoice:key=>{setModal(null);
      if(key==="skip"){done(g);return;}
      if(key==="refresh"){setModal({type:"pickDiscard",hand:getH(g,p),title:"Refresh: Discard (then draw)",
        onPick:id=>{setModal(null);
          discardFromHand(g,p,id,g2=>{
            setUndoState(null);
            g2=drawCards(g2,p,1);if(g2.drawn){trackDraws(g2,p,g2.drawn,"refresh");g2=L(g2,`${p} draws ${CM[g2.drawn[0]].name}`);g2.newCards=g2.drawn;}
            done(g2);});}});return;}
      if(key==="sift"){setUndoState(null);let g2=drawCards(g,p,1);if(g2.drawn){trackDraws(g2,p,g2.drawn,"sift");g2=L(g2,`${p} draws ${CM[g2.drawn[0]].name} (Sift)`);g2.newCards=g2.drawn;}setGs(g2);
        setModal({type:"pickDiscard",hand:getH(g2,p),title:"Sift: Discard a card",newCards:g2.drawn||[],
          onPick:id=>{setModal(null);discardFromHand(g2,p,id,done);}});return;}
      if(key==="declutter"){const disc=getD(g,p);if(!disc.length){done(g);return;}
        setModal({type:"pickFromList",title:"Declutter: Scrap from discard",cards:disc,canCancel:true,
          onPick:id=>{setModal(null);let g2=cloneGs(g);g2=setZ(g2,p,"discard",[...getD(g2,p)].filter(x=>x!==id));
            g2.scrap=[...g2.scrap,id];g2=L(g2,`${p} scraps ${CM[id].name} (Declutter)`);done(g2);},
          onCancel:()=>{setModal(null);done(g);}});}}});};

  // --- UNDO ---
  const doUndo=()=>{if(undoState){setGs(undoState);setUndoState(null);setModal(null);setFdMode(false);}};

  const handlePlayCard=cid=>{if(!gs)return;if(gs.newCards.length)setGs(p=>({...p,newCards:[]}));
    const card=CM[cid],p=gs.currentPlayer;
    if(fdMode){setFdMode(false);const snap=cloneGs(gs);let g=playFD(gs,cid);
      trackEvent(g,"action_played",{cardId:cid,effectId:cid,faceDown:true,actionType:"FaceDown"},{playerSlot:p});
      setUndoState(snap);// Can undo face-down (no info revealed)
      offerRefresh(g,g2=>{g2=advance(g2);setGs(g2);});return;}
    if(card.type==="Modify"&&((p==="A"&&gs.amends.aNegate)||(p==="B"&&gs.amends.bNegate))){
      setModal({type:"alert",msg:"Negate prevents Modify actions!",onOk:()=>setModal(null)});return;}
    // Info-revealing actions: confirm first
    if(REVEALS.has(cid)){
      setModal({type:"confirm",title:`Play ${card.name}?`,msg:`This will reveal new information and can't be undone.`,card:cid,
        onYes:()=>{setModal(null);setUndoState(null);resolveAction(cid);},
        onNo:()=>{setModal(null);}});return;}
    // Non-revealing actions: play with undo available
    const snap=cloneGs(gs);setUndoState(snap);resolveAction(cid);};

  // --- RESOLVE ACTION ---
  const resolveAction=(cid,effectId=cid,alreadyInPlay=false,baseGs=gs)=>{const card=CM[effectId],p=baseGs.currentPlayer;let g=cloneGs(baseGs);
    if(!alreadyInPlay){
      g=setZ(g,p,"hand",[...getH(g,p)].filter(id=>id!==cid));
      g=setZ(g,p,"play",[...getP(g,p),{id:cid,faceDown:false}]);
      trackEvent(g,"action_played",{cardId:cid,effectId,faceDown:false,actionType:card.type},{playerSlot:p});
    }
    if(card.type==="Modify"){g=L(g,`${p} plays ${card.name} (Modify)`);g=advance(g);setGs(g);return;}
    if(card.type==="React"){g=L(g,`${p} plays ${card.name} (React)`);g=advance(g);setGs(g);return;}
    if(card.type==="Remember"){g=L(g,`${p} plays ${card.name} (Remember)`);g=advance(g);setGs(g);return;}
    if(card.type==="Amend"){
      if(effectId==="7C"){g.amends={...g.amends,[opp(p)==="A"?"aFreeze":"bFreeze"]:true};g=L(g,`${p} plays Freeze`);}
      else if(effectId==="7D"){g.amends={...g.amends,[opp(p)==="A"?"aNegate":"bNegate"]:true};g=L(g,`${p} plays Negate`);}
      g=advance(g);setGs(g);return;}
    g=L(g,`${p} plays ${card.name}`);const frozen=isFroz(g,p);
    const scrapF=(g2,pl,id,reason="effect")=>{g2=setZ(g2,pl,"discard",[...getD(g2,pl)].filter(x=>x!==id));g2.scrap=[...g2.scrap,id];trackEvent(g2,"card_scrapped",{cardId:id,reason},{playerSlot:pl});return g2;};
    const done=g2=>{setUndoState(null);g2=advance(g2);setGs(g2);};// Clear undo after info revealed
    const pick=(t,cards,filter,onP,onC)=>{setModal({type:"pickFromList",title:t,cards,filter,canCancel:!!onC,
      onPick:id=>{setModal(null);onP(id);},onCancel:onC?()=>{setModal(null);onC();}:undefined});};
    const resolveCopiedImmediate=(g2,nextEffectId)=>resolveAction(cid,nextEffectId,true,g2);

    // 2s
    if(card.scrapSuits){if(frozen){g=L(g,"...Frozen!");done(g);return;}
      const disc=getD(g,p),valid=disc.filter(id=>card.scrapSuits.includes(CM[id].suit));
      if(!valid.length){g=L(g,"...no valid targets. Fizzles.");done(g);return;}
      pick(`${card.name}: Scrap a ${card.scrapSuits.map(s=>SUITS[s]).join("/")}`,disc,id=>card.scrapSuits.includes(CM[id].suit),
        id=>{let g2=scrapF({...g},p,id);g2=L(g2,`${p} scraps ${CM[id].name}`);done(g2);},
        ()=>{g=L(g,"...cancelled.");done(g);});return;}
    // 3C Defer
    if(effectId==="3C"){const dk=getDk(g,p);if(!dk.length){g=L(g,"...deck empty.");done(g);return;}
      setModal({type:"twoChoice",title:"Defer",card:dk[0],opt1:"Leave on Top",opt2:"Put on Bottom",
        on1:()=>{setModal(null);g=L(g,`${p} leaves ${CM[dk[0]].name} on top`);done(g);},
        on2:()=>{setModal(null);let g2={...g};let d=[...getDk(g2,p)];d.push(d.shift());g2=setZ(g2,p,"deck",d);
          g2=L(g2,`${p} puts ${CM[dk[0]].name} on bottom`);done(g2);}});return;}
    // 3D Loot
    if(effectId==="3D"){g=drawCards(g,p,1);if(g.drawn){trackDraws(g,p,g.drawn,"loot");g=L(g,`${p} draws ${CM[g.drawn[0]].name}`);g.newCards=g.drawn;}setGs(g);
      setModal({type:"pickDiscard",hand:getH(g,p),title:"Loot: Discard a card",newCards:g.drawn||[],
        onPick:id=>{setModal(null);discardFromHand(g,p,id,g2=>done(g2));}});return;}
    // 3H Rummage
    if(effectId==="3H"){setModal({type:"twoOptChoice",title:"Rummage: Who Refreshes?",opt1:"Yourself",opt2:"Opponent",
      on1:()=>{setModal(null);setModal({type:"pickDiscard",hand:getH(g,p),title:"Rummage: Discard (then draw)",
        onPick:id=>{setModal(null);discardFromHand(g,p,id,g2=>{
          g2=drawCards(g2,p,1);if(g2.drawn){trackDraws(g2,p,g2.drawn,"rummage");g2=L(g2,`${p} draws ${CM[g2.drawn[0]].name}`);g2.newCards=g2.drawn;}done(g2);});}});},
      on2:()=>{setModal(null);const oh=getH(g,opp(p));
        setModal({type:"pickDiscard",hand:oh,title:`${opp(p)} must discard (then draws)`,
          onPick:id=>{setModal(null);discardFromHand(g,opp(p),id,g2=>{
            g2=drawCards(g2,opp(p),1);if(g2.drawn){trackDraws(g2,opp(p),g2.drawn,"rummage");g2=L(g2,`${opp(p)} draws`);}done(g2);});}});}});return;}
    // 3S Consider
    if(effectId==="3S"){const dk=getDk(g,p);if(!dk.length){g=L(g,"...deck empty.");done(g);return;}
      setModal({type:"twoChoice",title:"Consider",card:dk[0],opt1:"Keep on Top",opt2:"Discard It",
        on1:()=>{setModal(null);g=L(g,`${p} keeps ${CM[dk[0]].name}`);done(g);},
        on2:()=>{setModal(null);let g2={...g};let d=[...getDk(g2,p)];const c=d.shift();
          g2=setZ(g2,p,"deck",d);g2=setZ(g2,p,"discard",[...getD(g2,p),c]);g2=L(g2,`${p} discards ${CM[c].name}`);done(g2);}});return;}
    // 4C Entomb
    if(effectId==="4C"){const dk=getDk(g,p);if(!dk.length){g=L(g,"...deck empty.");done(g);return;}
      pick("Entomb: Pick from deck ➠ discard",sortC(dk),null,id=>{let g2={...g};
        g2=setZ(g2,p,"deck",shuf([...getDk(g2,p)].filter(x=>x!==id)));g2=setZ(g2,p,"discard",[...getD(g2,p),id]);
        g2=L(g2,`${p} entombs ${CM[id].name}`);done(g2);});return;}
    // 4D Gamble
    if(effectId==="4D"){const dk=getDk(g,p);if(!dk.length){g=L(g,"...deck empty.");done(g);return;}
      pick("Gamble: Take from deck (random discard)",sortC(dk),null,id=>{let g2={...g};
        g2=setZ(g2,p,"deck",shuf([...getDk(g2,p)].filter(x=>x!==id)));let h=[...getH(g2,p),id];g2.newCards=[id];
        const ri=Math.floor(Math.random()*h.length);const disc=h[ri];h=h.filter((_,i)=>i!==ri);
        g2=setZ(g2,p,"hand",h);g2=setZ(g2,p,"discard",[...getD(g2,p),disc]);
        g2=L(g2,`${p} takes ${CM[id].name}, randomly discards ${CM[disc].name}`);done(g2);});return;}
    // 4H Cultivate
    if(effectId==="4H"){const dk=getDk(g,p);if(!dk.length){g=L(g,"...deck empty.");done(g);return;}
      pick("Cultivate: Put on top of deck",sortC(dk),null,id=>{let g2={...g};
        let d=shuf([...getDk(g2,p)].filter(x=>x!==id));d.unshift(id);g2=setZ(g2,p,"deck",d);
        g2=L(g2,`${p} cultivates ${CM[id].name}`);done(g2);});return;}
    // 4S Unearth
    if(effectId==="4S"){const disc=getD(g,p);if(!disc.length){g=L(g,"...discard empty.");done(g);return;}
      pick("Unearth: Return from discard",disc,null,id=>{let g2=cloneGs(g);
        g2=setZ(g2,p,"discard",[...getD(g2,p)].filter(x=>x!==id));let h=[...getH(g2,p),id];g2=setZ(g2,p,"hand",h);
        g2=L(g2,`${p} unearths ${CM[id].name}`);g2.newCards=[id];setGs(g2);
        setModal({type:"pickDiscard",hand:h,title:"Unearth: Discard a card",newCards:[id],
          onPick:did=>{setModal(null);discardFromHand(g2,p,did,g3=>done(g3));}});});return;}
    // 5C Mill
    if(effectId==="5C"){let dk=[...getDk(g,p)],dc=[...getD(g,p)],m=[];
      for(let i=0;i<3&&dk.length;i++){const c=dk.shift();dc.push(c);m.push(c);}
      g=setZ(g,p,"deck",dk);g=setZ(g,p,"discard",dc);g=L(g,`${p} mills: ${m.map(id=>CM[id].name).join(", ")}`);done(g);return;}
    // 5H Recall
    if(effectId==="5H"){const play=getP(g,p).filter(a=>!a.faceDown&&a.id!==cid);
      if(!play.length){g=L(g,"...no other actions.");done(g);return;}
      pick("Recall: Return action to hand",play.map(a=>a.id),null,id=>{let g2=cloneGs(g);
        g2=setZ(g2,p,"play",[...getP(g2,p)].filter(a=>a.id!==id));let h=[...getH(g2,p),id];g2=setZ(g2,p,"hand",h);
        g2=L(g2,`${p} recalls ${CM[id].name}`);g2.newCards=[id];setGs(g2);
        setModal({type:"pickDiscard",hand:h,title:"Recall: Discard",newCards:[id],
          onPick:did=>{setModal(null);discardFromHand(g2,p,did,g3=>done(g3));}});});return;}
    // 5S Reclaim
    if(effectId==="5S"){const disc=getD(g,p);if(!disc.length){g=L(g,"...discard empty.");done(g);return;}
      pick("Reclaim: Put on top of deck",disc,null,id=>{let g2={...g};
        g2=setZ(g2,p,"discard",[...getD(g2,p)].filter(x=>x!==id));g2=setZ(g2,p,"deck",[id,...getDk(g2,p)]);
        g2=L(g2,`${p} reclaims ${CM[id].name}`);done(g2);});return;}
    // 6C Curse
    if(effectId==="6C"){if(!g.scrap.length){g=L(g,"...scrap empty. Fizzles.");done(g);return;}
      pick("Curse: Move from scrap ➠ opponent's discard",g.scrap,null,id=>{let g2={...g};
        g2.scrap=g2.scrap.filter(x=>x!==id);g2=setZ(g2,opp(p),"discard",[...getD(g2,opp(p)),id]);
        g2=L(g2,`${p} curses ${opp(p)} with ${CM[id].name}`);done(g2);},()=>{g=L(g,"...cancelled.");done(g);});return;}
    // 6D Abduct
    if(effectId==="6D"){const oa=getP(g,opp(p)).filter(a=>!a.faceDown);
      if(!oa.length){g=L(g,"...no opponent actions. Fizzles.");done(g);return;}
      pick("Abduct: Steal opponent's action",oa.map(a=>a.id),null,id=>{let g2={...g};
        g2=setZ(g2,opp(p),"play",[...getP(g2,opp(p))].filter(a=>a.id!==id));
        g2=setZ(g2,p,"discard",[...getD(g2,p),id]);g2=setZ(g2,p,"play",[...getP(g2,p)].filter(a=>a.id!==cid));
        g2.scrap=[...g2.scrap,cid];g2=L(g2,`${p} abducts ${CM[id].name}!`);done(g2);},()=>{g=L(g,"...cancelled.");done(g);});return;}
    // 6H Exchange
    if(effectId==="6H"){const od=getD(g,opp(p)),md=getD(g,p);
      if(!od.length||!md.length){g=L(g,"...need cards in both discards. Fizzles.");done(g);return;}
      pick("Exchange: Pick from opponent's discard",od,null,oid=>{
        pick("Exchange: Pick from YOUR discard to swap",getD(g,p),null,mid=>{let g2={...g};
          let o2=[...getD(g2,opp(p))].filter(x=>x!==oid);o2.push(mid);
          let m2=[...getD(g2,p)].filter(x=>x!==mid);m2.push(oid);
          g2=setZ(g2,opp(p),"discard",o2);g2=setZ(g2,p,"discard",m2);
          g2=L(g2,`${p} exchanges: gives ${CM[mid].name}, takes ${CM[oid].name}`);done(g2);},()=>{g=L(g,"...cancelled.");done(g);});
      },()=>{g=L(g,"...cancelled.");done(g);});return;}
    // 6S Banish
    if(effectId==="6S"){const od=getD(g,opp(p));if(!od.length){g=L(g,"...opponent discard empty. Fizzles.");done(g);return;}
      pick("Banish: Move to scrap",od,null,id=>{let g2={...g};
        g2=setZ(g2,opp(p),"discard",[...getD(g2,opp(p))].filter(x=>x!==id));g2.scrap=[...g2.scrap,id];
        g2=L(g2,`${p} banishes ${CM[id].name}`);done(g2);},()=>{g=L(g,"...cancelled.");done(g);});return;}
    // 7H Abdicate
    if(effectId==="7H"){const oh=getH(g,opp(p)),faces=oh.filter(id=>FACE.includes(CM[id].rank));
      if(!faces.length){g=L(g,`${opp(p)} has no face cards.`);g=drawCards(g,opp(p),1);if(g.drawn){trackDraws(g,opp(p),g.drawn,"abdicate");g=L(g,`${opp(p)} draws`);}done(g);return;}
      setModal({type:"pickDiscard",hand:oh,title:`${opp(p)} must discard a face card`,filter:id=>FACE.includes(CM[id].rank),
        onPick:id=>{setModal(null);let g2={...g};g2=setZ(g2,opp(p),"hand",[...getH(g2,opp(p))].filter(x=>x!==id));
          g2=setZ(g2,opp(p),"discard",[...getD(g2,opp(p)),id]);g2=L(g2,`${opp(p)} discards ${CM[id].name} (Abdicate)`);
          g2=drawCards(g2,opp(p),1);if(g2.drawn){trackDraws(g2,opp(p),g2.drawn,"abdicate");g2=L(g2,`${opp(p)} draws`);}done(g2);}});return;}
    // 7S Nullify
    if(effectId==="7S"){const allM=[...getP(g,"A").filter(a=>CM[a.id].type==="Modify"&&!a.faceDown).map(a=>({...a,ow:"A"})),
      ...getP(g,"B").filter(a=>CM[a.id].type==="Modify"&&!a.faceDown).map(a=>({...a,ow:"B"}))];
      if(!allM.length){g=L(g,"...no Modifies. Fizzles.");done(g);return;}
      pick("Nullify: Remove a Modify",allM.map(m=>m.id),null,id=>{let g2={...g};const ow=allM.find(m=>m.id===id).ow;
        g2=setZ(g2,ow,"play",[...getP(g2,ow)].filter(a=>a.id!==id));g2=setZ(g2,ow,"discard",[...getD(g2,ow),id]);
        g2=L(g2,`${p} nullifies ${CM[id].name}`);done(g2);});return;}
    // 8H Reject
    if(effectId==="8H"){const dk=getDk(g,p);if(!dk.length){g=L(g,"...deck empty.");done(g);return;}
      setModal({type:"twoChoice",title:"Reject",card:dk[0],opt1:"Leave It",opt2:"Scrap It",
        on1:()=>{setModal(null);g=L(g,`${p} keeps ${CM[dk[0]].name}`);done(g);},
        on2:()=>{setModal(null);if(frozen){g=L(g,"...Frozen!");done(g);return;}
          let g2={...g};let d=[...getDk(g2,p)];d.shift();g2=setZ(g2,p,"deck",d);g2.scrap=[...g2.scrap,dk[0]];
          g2=L(g2,`${p} rejects ${CM[dk[0]].name}`);done(g2);}});return;}
    // 9C Terminate
    if(effectId==="9C"){if(frozen){g=L(g,"...Frozen!");done(g);return;}const disc=getD(g,p);
      const valid=disc.filter(id=>!FACE.includes(CM[id].rank));if(!valid.length){g=L(g,"...no non-face cards. Fizzles.");done(g);return;}
      pick("Terminate: Scrap a non-face card",disc,id=>!FACE.includes(CM[id].rank),
        id=>{done(L(scrapF({...g},p,id),`${p} scraps ${CM[id].name}`));},()=>{done(L(g,"...cancelled."));});return;}
    // 9D Impeach
    if(effectId==="9D"){if(frozen){g=L(g,"...Frozen!");done(g);return;}const disc=getD(g,p);
      const valid=disc.filter(id=>FACE.includes(CM[id].rank));if(!valid.length){g=L(g,"...no face cards. Fizzles.");done(g);return;}
      pick("Impeach: Scrap a face card",disc,id=>FACE.includes(CM[id].rank),
        id=>{done(L(scrapF({...g},p,id),`${p} scraps ${CM[id].name}`));},()=>{done(L(g,"...cancelled."));});return;}
    // 9H Accumulate
    if(effectId==="9H"){if(frozen){g=L(g,"...Frozen!");done(g);return;}const disc=getD(g,p);
      const ss=new Set(g.scrap.map(id=>CM[id].suit)),sr=new Set(g.scrap.map(id=>CM[id].rank));
      const valid=disc.filter(id=>ss.has(CM[id].suit)||sr.has(CM[id].rank));
      if(!valid.length){g=L(g,"...no matching cards. Fizzles.");done(g);return;}
      pick("Accumulate: Scrap matching scrapped card",disc,id=>ss.has(CM[id].suit)||sr.has(CM[id].rank),
        id=>{done(L(scrapF({...g},p,id),`${p} accumulates ${CM[id].name}`));},()=>{done(L(g,"...cancelled."));});return;}
    // 9S Reap
    if(effectId==="9S"){if(frozen){g=L(g,"...Frozen!");done(g);return;}const disc=getD(g,p);
      const valid=disc.filter((id,idx)=>disc.some((other,j)=>j!==idx&&(CM[other].rank===CM[id].rank||CM[other].suit===CM[id].suit)));
      if(!valid.length){g=L(g,"...no matching discard cards. Fizzles.");done(g);return;}
      pick("Reap: Scrap a card matching another discard card",disc,id=>valid.includes(id),
        id=>{done(L(scrapF({...g},p,id),`${p} reaps ${CM[id].name}`));},()=>{done(L(g,"...cancelled."));});return;}
    // JD Duplicate — immediately copies another of your Actions in play
    if(effectId==="JD"){const myActions=getP(g,p).filter(a=>a.id!==cid&&!a.faceDown);
      if(!myActions.length){g=L(g,"...no other actions to copy. Fizzles.");done(g);return;}
      pick("Duplicate: Pick one of YOUR actions to copy",myActions.map(a=>a.id),null,id=>{
        let g2=cloneGs(g);// Mark Duplicate as copying that action
        const pl=getP(g2,p).map(a=>a.id===cid?{...a,copiedFrom:id}:a);
        g2=setZ(g2,p,"play",pl);g2=L(g2,`${p} duplicates ${CM[id].name}`);
        if(["Enact","Amend"].includes(CM[id]?.type))resolveCopiedImmediate(g2,id);else done(g2);},
      ()=>{g=L(g,"...cancelled. Fizzles.");done(g);});return;}
    // JH Reflect — copies an opponent's Action in play
    if(effectId==="JH"){const oppActions=getP(g,opp(p)).filter(a=>!a.faceDown);
      if(!oppActions.length){g=L(g,"...no opponent actions to copy. Fizzles.");done(g);return;}
      pick("Reflect: Pick an OPPONENT'S action to copy",oppActions.map(a=>a.id),null,id=>{
        let g2=cloneGs(g);const pl=getP(g2,p).map(a=>a.id===cid?{...a,copiedFrom:id}:a);
        g2=setZ(g2,p,"play",pl);g2=L(g2,`${p} reflects ${CM[id].name}`);
        if(["Enact","Amend"].includes(CM[id]?.type))resolveCopiedImmediate(g2,id);else done(g2);},
      ()=>{g=L(g,"...cancelled. Fizzles.");done(g);});return;}
    // AD Explore
    if(effectId==="AD"){g=drawCards(g,p,1);if(g.drawn){trackDraws(g,p,g.drawn,"explore");g=L(g,`${p} draws ${CM[g.drawn[0]].name}`);g.bonusActions++;g.newCards=g.drawn;}done(g);return;}
    // AC Salvage
    if(effectId==="AC"){if(!g.scrap.length){g=L(g,"...scrap empty.");done(g);return;}
      pick("Salvage: Take from scrap",g.scrap,null,id=>{let g2=cloneGs(g);g2.scrap=g2.scrap.filter(x=>x!==id);
        g2=setZ(g2,p,"hand",[...getH(g2,p),id]);g2.newCards=[id];g2=L(g2,`${p} salvages ${CM[id].name}`);g2.bonusActions++;done(g2);},
      ()=>{g=L(g,"...cancelled.");done(g);});return;}
    // AH Retrieve — can retrieve ANY action in play (including face-down)
    if(effectId==="AH"){const play=getP(g,p).filter(a=>a.id!==cid);
      if(!play.length){g=L(g,"...no actions to retrieve.");done(g);return;}
      pick("Retrieve: Return any of your actions to hand",play.map(a=>a.id),null,id=>{let g2=cloneGs(g);
        g2=setZ(g2,p,"play",[...getP(g2,p)].filter(a=>a.id!==id));g2=setZ(g2,p,"hand",[...getH(g2,p),id]);
        g2.newCards=[id];g2=L(g2,`${p} retrieves ${CM[id].name}`);g2.bonusActions++;done(g2);},
      ()=>{g=L(g,"...cancelled.");done(g);});return;}
    // AS Reanimate — return card from discard to hand
    if(effectId==="AS"){const disc=getD(g,p);if(!disc.length){g=L(g,"...discard empty.");done(g);return;}
      pick("Reanimate: Return a card from your discard to hand",disc,null,id=>{let g2=cloneGs(g);
        g2=setZ(g2,p,"discard",[...getD(g2,p)].filter(x=>x!==id));g2=setZ(g2,p,"hand",[...getH(g2,p),id]);
        g2.newCards=[id];g2=L(g2,`${p} reanimates ${CM[id].name}`);g2.bonusActions++;done(g2);},
      ()=>{g=L(g,"...cancelled.");done(g);});return;}
    // KC Brainstorm
    if(effectId==="KC"){g=drawCards(g,p,3);const dr=g.drawn||[];trackDraws(g,p,dr,"brainstorm");g=L(g,`${p} draws: ${dr.map(id=>CM[id].name).join(", ")}`);g.newCards=dr;setGs(g);
      setModal({type:"brainstorm",hand:getH(g,p),newCards:dr,onPick:ids=>{setModal(null);let g2={...g};
        g2=setZ(g2,p,"hand",[...getH(g2,p)].filter(x=>!ids.includes(x)));g2=setZ(g2,p,"deck",[...ids,...getDk(g2,p)]);
        g2=L(g2,`${p} puts back: ${ids.map(id=>CM[id].name).join(" ➠ ")}`);g2.newCards=[];done(g2);}});return;}
    // KD Improvise
    if(effectId==="KD"){let dk=[...getDk(g,p)],dc=[...getD(g,p)],m=[];
      for(let i=0;i<3&&dk.length;i++){const c=dk.shift();dc.push(c);m.push(c);}
      g=setZ(g,p,"deck",dk);g=setZ(g,p,"discard",dc);g=L(g,`${p} mills: ${m.map(id=>CM[id].name).join(", ")}`);setGs(g);
      pick("Improvise: Take from discard",[...getD(g,p)],null,id=>{let g2=cloneGs(g);
        g2=setZ(g2,p,"discard",[...getD(g2,p)].filter(x=>x!==id));let h=[...getH(g2,p),id];g2=setZ(g2,p,"hand",h);
        g2=L(g2,`${p} takes ${CM[id].name}`);g2.newCards=[id];setGs(g2);
        setModal({type:"pickDiscard",hand:h,title:"Improvise: Discard",newCards:[id],
          onPick:did=>{setModal(null);discardFromHand(g2,p,did,g3=>done(g3));}});});return;}
    // KH Rejuvenate
    if(effectId==="KH"){setModal({type:"rejuvenate",hand:getH(g,p),onPick:ids=>{setModal(null);let g2=cloneGs(g);
      g2=setZ(g2,p,"hand",[...getH(g2,p)].filter(x=>!ids.includes(x)));g2=setZ(g2,p,"discard",[...getD(g2,p),...ids]);
      g2=L(g2,`${p} discards: ${ids.map(id=>CM[id].name).join(", ")}`);
      // Check Capitalize for each discarded card (only 8S matters)
      const capCheck=(g3,ci)=>{if(ci>=ids.length){
        g3=drawCards(g3,p,ids.length);const dr=g3.drawn||[];trackDraws(g3,p,dr,"rejuvenate");
        g3=L(g3,`${p} draws: ${dr.map(id=>CM[id].name).join(", ")}`);g3.newCards=dr;done(g3);return;}
        checkCap(g3,p,ids[ci],g4=>capCheck(g4,ci+1));};
      capCheck(g2,0);}});return;}
    // KS Bury
    if(effectId==="KS"){if(frozen){g=L(g,"...Frozen!");done(g);return;}const disc=getD(g,p);
      if(!disc.length){g=L(g,"...nothing to scrap.");done(g);return;}
      setModal({type:"pickMulti",cards:disc,maxPick:3,title:"Bury: Scrap up to 3",onPick:ids=>{setModal(null);let g2={...g};
        g2=setZ(g2,p,"discard",[...getD(g2,p)].filter(x=>!ids.includes(x)));g2.scrap=[...g2.scrap,...ids];
        g2=L(g2,`${p} buries: ${ids.map(id=>CM[id].name).join(", ")}`);done(g2);}});return;}
    g=L(g,`(${card.name} not implemented)`);done(g);};

  // ============================================================
  // SCORING WITH MODIFY RESOLUTION
  // ============================================================
  const doScore=()=>{if(!gs)return;let g=cloneGs(gs);
    g.aMods=[];g.bMods=[];g.aForecast=[];g.bForecast=[];g=L(g,"Resolving modifications...");setGs(g);
    const first=gs.firstPlayer||"A";
    const firstMods=getModifyEntries(g,first);resolveMods(g,first,firstMods,0);};

  const resolveMods=(g,pl,mods,i)=>{
    if(i>=mods.length){resolveQ2s(g,pl,g2=>{
      if(g2.mode==="solo"){finalScore(g2);return;}
      const nextPlayer=opp(pl);
      if(pl!==g2.firstPlayer){finalScore(g2);return;}
      const nextMods=getModifyEntries(g2,nextPlayer);resolveMods(g2,nextPlayer,nextMods,0);});return;}
    const entry=mods[i],mid=entry.effectId,mc=CM[mid],hand=getH(g,pl),mk=pl==="A"?"aMods":"bMods";
    const next=(g2)=>resolveMods(g2||g,pl,mods,i+1);
    const modLabel=entry.copiedFrom?`${CM[entry.sourceId]?.name||mc.name} copying ${CM[entry.copiedFrom]?.name||mc.name}`:mc.name;
    const skip=()=>{let g2=L(g,`${pl}: ${modLabel} — skipped`);setGs(g2);next(g2);};
    // Forecast: choose target now, resolve after reveal
    if(mid==="5D"){const fk=pl==="A"?"aForecast":"bForecast";
      setModal({type:"pickFromList",title:`${pl}: Forecast — pick a scoring card to save later`,cards:hand,showHand:hand,canCancel:true,
        onPick:tid=>{setModal(null);let g2=cloneGs(g);g2[fk]=[...(g2[fk]||[]),{sourceId:entry.sourceId,target:tid}];trackEvent(g2,"modify_chosen",{sourceId:entry.sourceId,effectId:mid,target:tid,kind:"forecast"},{playerSlot:pl,phase:"score"});g2=L(g2,`${pl}: ${modLabel} marks ${CM[tid].name} for Forecast`);setGs(g2);next(g2);},
        onCancel:()=>{setModal(null);skip();}});return;}
    // Vanish: defer
    if(mid==="8D"){let g2=L(g,`${pl}: ${modLabel} — after scoring`);setGs(g2);next(g2);return;}
    // Buff
    if(mid==="10H"){setModal({type:"pickFromList",title:`${pl}: Buff — pick scoring card to increase rank`,cards:hand,showHand:hand,canCancel:true,
      onPick:tid=>{setModal(null);const hr=higherRanks(CM[tid].rank);
        if(!hr.length){let g2=L(g,`${pl}: ${modLabel} has no higher rank target for ${CM[tid].name}`);setGs(g2);next(g2);return;}
        setModal({type:"pickRank",title:`Buff ${CM[tid].name}: New rank`,ranks:hr,showHand:hand,
          onPick:r=>{setModal(null);let g2=cloneGs(g);g2[mk]=[...g2[mk],{sourceId:entry.sourceId,target:tid,rank:r,suit:null}];trackEvent(g2,"modify_chosen",{sourceId:entry.sourceId,effectId:mid,target:tid,rank:r},{playerSlot:pl,phase:"score"});g2=L(g2,`${pl}: ${modLabel} ${CM[tid].name} ➠ ${r}`);setGs(g2);next(g2);},
          onCancel:()=>{setModal(null);skip();}});},
      onCancel:()=>{setModal(null);skip();}});return;}
    // Nerf
    if(mid==="10S"){setModal({type:"pickFromList",title:`${pl}: Nerf — pick scoring card to decrease rank`,cards:hand,showHand:hand,canCancel:true,
      onPick:tid=>{setModal(null);const lr=lowerRanks(CM[tid].rank);
        if(!lr.length){let g2=L(g,`${pl}: ${modLabel} has no lower rank target for ${CM[tid].name}`);setGs(g2);next(g2);return;}
        setModal({type:"pickRank",title:`Nerf ${CM[tid].name}: New rank`,ranks:lr,showHand:hand,
          onPick:r=>{setModal(null);let g2=cloneGs(g);g2[mk]=[...g2[mk],{sourceId:entry.sourceId,target:tid,rank:r,suit:null}];trackEvent(g2,"modify_chosen",{sourceId:entry.sourceId,effectId:mid,target:tid,rank:r},{playerSlot:pl,phase:"score"});g2=L(g2,`${pl}: ${modLabel} ${CM[tid].name} ➠ ${r}`);setGs(g2);next(g2);},
          onCancel:()=>{setModal(null);skip();}});},
      onCancel:()=>{setModal(null);skip();}});return;}
    // Nudge
    if(mid==="10C"){setModal({type:"pickFromList",title:`${pl}: Nudge — pick scoring card (±1 rank)`,cards:hand,showHand:hand,canCancel:true,
      onPick:tid=>{setModal(null);const opts=adjacentRanks(CM[tid].rank);
        if(!opts.length){let g2=L(g,`${pl}: ${modLabel} has no adjacent ranks for ${CM[tid].name}`);setGs(g2);next(g2);return;}
        setModal({type:"pickRank",title:`Nudge ${CM[tid].name}: ±1`,ranks:opts,showHand:hand,
          onPick:r=>{setModal(null);let g2=cloneGs(g);g2[mk]=[...g2[mk],{sourceId:entry.sourceId,target:tid,rank:r,suit:null}];trackEvent(g2,"modify_chosen",{sourceId:entry.sourceId,effectId:mid,target:tid,rank:r},{playerSlot:pl,phase:"score"});g2=L(g2,`${pl}: ${modLabel} ${CM[tid].name} ➠ ${r}`);setGs(g2);next(g2);},
          onCancel:()=>{setModal(null);skip();}});},
      onCancel:()=>{setModal(null);skip();}});return;}
    // Disguise
    if(mid==="10D"){setModal({type:"pickFromList",title:`${pl}: Disguise — pick scoring card to change suit`,cards:hand,showHand:hand,canCancel:true,
      onPick:tid=>{setModal(null);
        setModal({type:"pickSuit",title:`Disguise ${CM[tid].name}: New suit`,showHand:hand,
          onPick:s=>{setModal(null);let g2=cloneGs(g);g2[mk]=[...g2[mk],{sourceId:entry.sourceId,target:tid,rank:null,suit:s}];trackEvent(g2,"modify_chosen",{sourceId:entry.sourceId,effectId:mid,target:tid,suit:s},{playerSlot:pl,phase:"score"});g2=L(g2,`${pl}: ${modLabel} ${CM[tid].name} ➠ ${SUITS[s]}`);setGs(g2);next(g2);},
          onCancel:()=>{setModal(null);skip();}});},
      onCancel:()=>{setModal(null);skip();}});return;}
    // Clone — one SCORING card becomes copy of another SCORING card
    if(mid==="JC"){
      setModal({type:"pickFromList",title:`${pl}: Clone — pick a scoring card to OVERWRITE`,cards:hand,showHand:hand,canCancel:true,
        onPick:tid=>{setModal(null);const others=hand.filter(x=>x!==tid);
          setModal({type:"pickFromList",title:`Clone: Pick scoring card to COPY onto ${CM[tid].name}`,cards:others,showHand:hand,canCancel:false,
            onPick:sid=>{setModal(null);let g2=cloneGs(g);g2[mk]=[...g2[mk],{sourceId:entry.sourceId,target:tid,rank:CM[sid].rank,suit:CM[sid].suit}];trackEvent(g2,"modify_chosen",{sourceId:entry.sourceId,effectId:mid,target:tid,copyCardId:sid,rank:CM[sid].rank,suit:CM[sid].suit},{playerSlot:pl,phase:"score"});
              g2=L(g2,`${pl}: ${modLabel} ${CM[tid].name} ➠ copy of ${CM[sid].name}`);setGs(g2);next(g2);}});},
        onCancel:()=>{setModal(null);skip();}});return;}
    // Reminisce — one SCORING card becomes copy of a DISCARD card
    if(mid==="JS"){const disc=getD(g,pl);if(!disc.length){let g2=L(g,`${pl}: Reminisce — discard empty`);setGs(g2);next(g2);return;}
      setModal({type:"pickFromList",title:`${pl}: Reminisce — pick scoring card to OVERWRITE`,cards:hand,showHand:hand,canCancel:true,
        onPick:tid=>{setModal(null);
          setModal({type:"pickFromList",title:`Reminisce: Pick from DISCARD to copy onto ${CM[tid].name}`,cards:disc,showHand:hand,canCancel:false,
            onPick:sid=>{setModal(null);let g2=cloneGs(g);g2[mk]=[...g2[mk],{sourceId:entry.sourceId,target:tid,rank:CM[sid].rank,suit:CM[sid].suit}];trackEvent(g2,"modify_chosen",{sourceId:entry.sourceId,effectId:mid,target:tid,copyCardId:sid,rank:CM[sid].rank,suit:CM[sid].suit},{playerSlot:pl,phase:"score"});
              g2=L(g2,`${pl}: ${modLabel} ${CM[tid].name} ➠ copy of ${CM[sid].name}`);setGs(g2);next(g2);}});},
        onCancel:()=>{setModal(null);skip();}});return;}
    let g2=L(g,`${pl}: ${modLabel} — not implemented`);setGs(g2);next(g2);};

  // Queen Remember on 2s
  const resolveQ2s=(g,pl,done)=>{
    const mk=pl==="A"?"aMods":"bMods";
    const modded=new Set(getAppliedMods(g,pl).map(m=>m.target));
    const hand=getH(g,pl);
    const twos=hand.filter(id=>CM[id].rank==="2"&&!modded.has(id));
    const misc=g.scrap.includes("QC"),camo=g.scrap.includes("QD");
    if(!twos.length||(!misc&&!camo)){done(g);return;}
    const proc=(g2,ti)=>{if(ti>=twos.length){done(g2);return;}const tid=twos[ti];
      setModal({type:"queen2",pl,cardId:tid,misc,camo,showHand:hand,
        onRank:()=>{setModal(null);
          setModal({type:"pickRank",title:`Miscalculate: ${CM[tid].name} ➠ any rank`,ranks:RO,showHand:hand,
            onPick:r=>{setModal(null);
              if(camo){setModal({type:"twoOptChoice",title:`Also change suit of ${CM[tid].name}? (rank ➠ ${r})`,opt1:"Yes",opt2:"No",
                on1:()=>{setModal(null);setModal({type:"pickSuit",title:"Pick suit",showHand:hand,
                  onPick:s=>{setModal(null);let g3=cloneGs(g2);g3[mk]=[...g3[mk],{target:tid,rank:r,suit:s}];trackEvent(g3,"queen_choice",{source:"both",target:tid,rank:r,suit:s},{playerSlot:pl,phase:"score"});g3=L(g3,`${pl}: ${CM[tid].name} ➠ ${r}${SUITS[s]}`);setGs(g3);proc(g3,ti+1);}});},
                on2:()=>{setModal(null);let g3=cloneGs(g2);g3[mk]=[...g3[mk],{target:tid,rank:r,suit:null}];trackEvent(g3,"queen_choice",{source:"miscalculate",target:tid,rank:r,suit:null},{playerSlot:pl,phase:"score"});g3=L(g3,`${pl}: ${CM[tid].name} ➠ ${r}`);setGs(g3);proc(g3,ti+1);}});}
              else{let g3=cloneGs(g2);g3[mk]=[...g3[mk],{target:tid,rank:r,suit:null}];trackEvent(g3,"queen_choice",{source:"miscalculate",target:tid,rank:r,suit:null},{playerSlot:pl,phase:"score"});g3=L(g3,`${pl}: ${CM[tid].name} ➠ ${r}`);setGs(g3);proc(g3,ti+1);}}});},
        onSuit:()=>{setModal(null);
          setModal({type:"pickSuit",title:`Camouflage: ${CM[tid].name} ➠ any suit`,showHand:hand,
            onPick:s=>{setModal(null);let g3=cloneGs(g2);g3[mk]=[...g3[mk],{target:tid,rank:null,suit:s}];trackEvent(g3,"queen_choice",{source:"camouflage",target:tid,rank:null,suit:s},{playerSlot:pl,phase:"score"});g3=L(g3,`${pl}: ${CM[tid].name} ➠ ${SUITS[s]}`);setGs(g3);proc(g3,ti+1);}});},
        onBoth:()=>{setModal(null);
          setModal({type:"pickRank",title:`${CM[tid].name}: Pick rank`,ranks:RO,showHand:hand,
            onPick:r=>{setModal(null);setModal({type:"pickSuit",title:`${CM[tid].name}: Pick suit`,showHand:hand,
              onPick:s=>{setModal(null);let g3=cloneGs(g2);g3[mk]=[...g3[mk],{target:tid,rank:r,suit:s}];trackEvent(g3,"queen_choice",{source:"both",target:tid,rank:r,suit:s},{playerSlot:pl,phase:"score"});g3=L(g3,`${pl}: ${CM[tid].name} ➠ ${r}${SUITS[s]}`);setGs(g3);proc(g3,ti+1);}});}});},
        onSkip:()=>{setModal(null);proc(g2,ti+1);}});};
    proc(g,0);};

  // Finalize scoring — show reveal
  const finalScore=(g)=>{const aH=getH(g,"A"),bH=getH(g,"B"),aM=getAppliedMods(g,"A"),bM=getAppliedMods(g,"B");
    const aE=evalHand(aH,aM);
    const soloCard=g.mode==="solo"?(g.bDeck[0]||null):null;
    const bE=g.mode==="solo"?evalChallenger(soloCard):evalHand(bH,bM);
    const winner=g.mode==="solo"?(aE.handRank>bE.handRank?"A":"B"):compareHands(aH,bH,aM,bM);
    trackEvent(g,"round_scored",{
      winner,
      aHand:[...aH],
      bHand:g.mode==="solo"?[]:[...bH],
      aHandRank:aE.handName,
      bHandRank:bE.handName,
      aMods:[...aM],
      bMods:[...bM],
      challengerCardId:soloCard,
      challengerDescription:g.mode==="solo"?bE.description:undefined,
    },{phase:"score",playerSlot:null});
    g=L(g,`A: ${aE.handName}`);
    if(g.mode==="solo"){
      if(soloCard){
        g.bDeck=g.bDeck.slice(1);
        g._soloReveal={cardId:soloCard,handName:bE.handName,description:bE.description,handRank:bE.handRank};
        g._soloRevealedCards=[...(g._soloRevealedCards||[]),soloCard];
        trackEvent(g,"challenger_revealed",{cardId:soloCard,handName:bE.handName,description:bE.description},{phase:"score",playerSlot:"B"});
        g=L(g,`Challenger reveals ${CM[soloCard].rank}${SUITS[CM[soloCard].suit]}: ${bE.handName}`);
      }else{
        g._soloReveal={cardId:null,handName:bE.handName,description:bE.description,handRank:bE.handRank};
        g=L(g,"Challenger has no card to reveal.");
      }
    }else g=L(g,`B: ${bE.handName}`);
    if(winner==="A"){g.aChips++;trackEvent(g,"chip_awarded",{winner:"A",aChips:g.aChips,bChips:g.bChips},{phase:"score",playerSlot:"A"});g=L(g,g.mode==="solo"?`You win the chip! (${g.aChips}-${g.bChips})`:`Player A wins the chip! (${g.aChips}-${g.bChips})`);}
    else if(winner==="B"){g.bChips++;trackEvent(g,"chip_awarded",{winner:"B",aChips:g.aChips,bChips:g.bChips},{phase:"score",playerSlot:"B"});g=L(g,g.mode==="solo"?`The Challenger wins the chip! (${g.aChips}-${g.bChips})`:`Player B wins the chip! (${g.aChips}-${g.bChips})`);}
    else g=L(g,"Tie - no chip awarded.");
    g.phase="reveal";g._revealWinner=winner;g._revealAE=aE;g._revealBE=bE;setGs(g);};

  // After reveal, process post-score effects and advance
  const advanceFromReveal=()=>{if(!gs)return;let g={...gs};const winner=g._revealWinner;
    const effs=[];
    for(const pl of["A","B"]){for(const a of getP(g,pl)){
      const effect=getActionCard(a);
      if(a.faceDown||!effect)continue;
      if(effect.id==="5D"){
        const fk=pl==="A"?"aForecast":"bForecast";
        const queue=[...(g[fk]||[])];
        const nextMark=queue.shift()||null;
        effs.push({t:"forecast",pl,target:nextMark?nextMark.target:null});
        g[fk]=queue;
      }
      if(effect.id==="8D")effs.push({t:"vanish",pl});
      if(effect.id==="8C"&&((pl==="A"&&winner==="B")||(pl==="B"&&winner==="A")))effs.push({t:"capitulate",pl});
    }}
    procPost(g,effs,0);};

  const startNextRound=(g)=>{
    if(isMatchOver(g)){const winner=getMatchWinner(g);g.phase="gameOver";g=L(g,`🏆 ${g.mode==="solo"?(winner==="A"?"You win the solo run!":"The Challenger wins the solo run!"):`Player ${winner} wins the game!`}`);trackGameFinished(g,winner);setGs(g);return;}
    g.aHand=[];g.bHand=[];g.aPlay=[];g.bPlay=[];g.newCards=[];g.aMods=[];g.bMods=[];g.aForecast=[];g.bForecast=[];
    g.amends={aFreeze:false,bFreeze:false,aNegate:false,bNegate:false};g._soloReveal=null;
    g.round++;g.firstPlayer=g.mode==="solo"?"A":g.firstPlayer==="A"?"B":"A";g.currentPlayer=g.firstPlayer;g.regularActionsPlayed=0;g.bonusActions=0;
    g=L(g,`=== ROUND ${g.round} === ${g.mode==="solo"?"Solo Mode":`Player ${g.firstPlayer} acts first`}`);
    let aR=2,bR=2,aD=7,bD=7;const aCW=g.aChips===6,bCW=g.bChips===6;
    if(g.mode!=="solo"){
      if(aCW&&!bCW){bD=8;bR=3;}if(bCW&&!aCW){aD=8;aR=3;}if(aCW||bCW)g=L(g,"? SUDDEN DEATH!");
    }
    g._aReq=aR;g._bReq=bR;g.actionsRequired=g.currentPlayer==="A"?aR:bR;
    g=drawCards(g,"A",aD);if(g.error){g.phase="gameOver";g=L(g,"A can't draw!");trackGameFinished(g,"B");setGs(g);return;}trackDraws(g,"A",g.drawn||[],"round_start");g.aHand=sortC(g.aHand);
    if(g.mode!=="solo"){
      g=drawCards(g,"B",bD);if(g.error){g.phase="gameOver";g=L(g,"B can't draw!");trackGameFinished(g,"A");setGs(g);return;}trackDraws(g,"B",g.drawn||[],"round_start");g.bHand=sortC(g.bHand);
    }else g.bHand=[];
    g.phase="action";g=L(g,`A: ${g.aHand.map(id=>`${CM[id].rank}${SUITS[CM[id].suit]}`).join(", ")}`);
    if(g.mode==="solo")g=L(g,`Challenger Deck: ${g.bDeck.length} cards remain`);
    else g=L(g,`B: ${g.bHand.map(id=>`${CM[id].rank}${SUITS[CM[id].suit]}`).join(", ")}`);
    trackRoundStart(g);setGs(g);
  };

  const procPost=(g,effs,i)=>{if(i>=effs.length){
    trackRoundSummary(g);
    if(isMatchOver(g)){const winner=getMatchWinner(g);g.phase="gameOver";g=L(g,`🏆 ${g.mode==="solo"?(winner==="A"?"You win the solo run!":"The Challenger wins the solo run!"):`Player ${winner} wins the game!`}`);trackGameFinished(g,winner);setGs(g);return;}
    const aH=getH(g,"A"),bH=getH(g,"B");
    g.aDiscard=[...g.aDiscard,...g.aPlay.map(a=>a.id),...aH];g.bDiscard=[...g.bDiscard,...g.bPlay.map(a=>a.id),...bH];
    startNextRound(g);return;}
    const e=effs[i];
    if(e.t==="forecast"){
      if(!e.target||!getH(g,e.pl).includes(e.target)){procPost(g,effs,i+1);return;}
      let g2={...g};
      g2=setZ(g2,e.pl,"hand",[...getH(g2,e.pl)].filter(x=>x!==e.target));
      g2=setZ(g2,e.pl,"deck",[e.target,...getDk(g2,e.pl)]);
      trackEvent(g2,"post_score_effect",{effect:"forecast",target:e.target,playerSlot:e.pl},{phase:"post_score",playerSlot:e.pl});
      g2=L(g2,`${e.pl}: Forecast puts ${CM[e.target].name} on top of the deck`);
      setGs(g2);procPost(g2,effs,i+1);return;}
    if(e.t==="vanish"){if(isFroz(g,e.pl)){g=L(g,`${e.pl}: Vanish — Frozen!`);procPost(g,effs,i+1);return;}
      const activeMods=getAppliedMods(g,e.pl);const effS=new Set(getH(g,e.pl).map(id=>{const m=activeMods.find(x=>x.target===id);return m?.suit||CM[id].suit;}));
      const disc=getD(g,e.pl);const valid=disc.filter(id=>effS.has(CM[id].suit));
      if(!valid.length){procPost(g,effs,i+1);return;}
      setModal({type:"pickFromList",title:`${e.pl}: Vanish — scrap matching suit`,cards:disc,filter:id=>effS.has(CM[id].suit),canCancel:true,
        onPick:id=>{setModal(null);let g2={...g};g2=setZ(g2,e.pl,"discard",[...getD(g2,e.pl)].filter(x=>x!==id));g2.scrap=[...g2.scrap,id];
          trackEvent(g2,"post_score_effect",{effect:"vanish",target:id,playerSlot:e.pl},{phase:"post_score",playerSlot:e.pl});
          trackEvent(g2,"card_scrapped",{cardId:id,reason:"vanish"},{phase:"post_score",playerSlot:e.pl});
          g2=L(g2,`${e.pl}: Vanish scraps ${CM[id].name}`);setGs(g2);procPost(g2,effs,i+1);},
        onCancel:()=>{setModal(null);procPost(g,effs,i+1);}});return;}
    if(e.t==="capitulate"){if(isFroz(g,e.pl)){procPost(g,effs,i+1);return;}
      const disc=getD(g,e.pl);if(!disc.length){procPost(g,effs,i+1);return;}
      setModal({type:"pickFromList",title:`${e.pl}: Capitulate — you lost! Scrap a card?`,cards:disc,canCancel:true,
        onPick:id=>{setModal(null);let g2={...g};g2=setZ(g2,e.pl,"discard",[...getD(g2,e.pl)].filter(x=>x!==id));g2.scrap=[...g2.scrap,id];
          trackEvent(g2,"post_score_effect",{effect:"capitulate",target:id,playerSlot:e.pl},{phase:"post_score",playerSlot:e.pl});
          trackEvent(g2,"card_scrapped",{cardId:id,reason:"capitulate"},{phase:"post_score",playerSlot:e.pl});
          g2=L(g2,`${e.pl}: Capitulate scraps ${CM[id].name}`);setGs(g2);procPost(g2,effs,i+1);},
        onCancel:()=>{setModal(null);procPost(g,effs,i+1);}});return;}
    procPost(g,effs,i+1);};

  // ============================================================
  // RENDER
  // ============================================================
  if(!gs)return(<div style={{minHeight:"100vh",background:"radial-gradient(circle at 50% -10%,#2d6a4f 0%,#174a38 38%,#0f2b22 70%,#07120f 100%)",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:20,position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",inset:20,borderRadius:34,border:"2px solid #b8965b33",boxShadow:"inset 0 0 0 1px #f8e7b11a"}}/>
    <div style={{position:"absolute",width:520,height:520,borderRadius:"50%",background:"radial-gradient(circle,#f1c40f22 0%,#f1c40f08 35%,transparent 70%)",top:-220,left:"50%",transform:"translateX(-50%)"}}/>
    <div style={{position:"absolute",width:420,height:420,borderRadius:"50%",background:"radial-gradient(circle,#c49a5a14 0%,transparent 68%)",bottom:-180,left:-120}}/>
    <div style={{position:"absolute",width:360,height:360,borderRadius:"50%",background:"radial-gradient(circle,#2ecc7114 0%,transparent 72%)",top:120,right:-80}}/>
    <div style={{position:"relative",padding:"28px 30px",borderRadius:24,background:"linear-gradient(180deg,#133328ee,#0c241dee)",border:"1px solid #8c6a3a66",boxShadow:"0 30px 80px #00000066,inset 0 1px 0 #f6e3b51f, inset 0 0 0 1px #ffffff08",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:20,maxWidth:520}}>
      <div style={{fontSize:10,letterSpacing:3,textTransform:"uppercase",color:"#6b7f92",fontWeight:800}}>Deckbuilding Duel Prototype</div>
      <h1 style={{fontSize:40,fontWeight:900,fontFamily:"Georgia,serif",background:"linear-gradient(135deg,#f8de7e,#f39c12 45%,#f7f1c8)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",letterSpacing:5,margin:0,textAlign:"center"}}>KAIZEN POKER</h1>
      <p style={{color:"#7f93a8",fontSize:14,maxWidth:460,textAlign:"center",lineHeight:1.6,margin:0}}>A deckbuilding poker duel. Play hot-seat with two players on one screen, or take on the Challenger in the Solo Variant with a revealed lookup hand each round.</p>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center"}}>
        <Btn label="Hotseat Game" bg="linear-gradient(135deg,#f1c40f,#e67e22)" onClick={()=>startGame("hotseat")}/>
        <Btn label="Solo Mode" bg="linear-gradient(135deg,#4ade80,#22c55e)" onClick={()=>startGame("solo")}/>
      </div>
    </div></div>);

  const p=gs.currentPlayer,hand=getH(gs,p);
  const actionsLeft=gs.actionsRequired-gs.regularActionsPlayed+gs.bonusActions;
  const canAct=gs.phase==="action"&&actionsLeft>0;

  const isSuddenDeath=gs.mode!=="solo"&&(gs.aChips===6||gs.bChips===6);

  const pClr=p==="A"?"#e74c3c":"#3498db";
  const chipGoal=gs.mode==="solo"?(gs._soloTarget||SOLO_TARGET_CHIPS):7;
  const chipStrip=(pl,count,color)=>Array.from({length:chipGoal},(_,i)=><span key={pl+i} style={{width:10,height:10,borderRadius:"50%",display:"inline-block",background:i<count?color:"#1f2937",boxShadow:i<count?`0 0 10px ${color}88`:"inset 0 1px 2px #0008",border:`1px solid ${i<count?color+"88":"#334155"}`}}/>);
  const revealPostQueue=(g)=>{
    const items=[];
    for(const pl of["A","B"]){
      for(const a of getP(g,pl)){
        const effect=getActionCard(a);
        if(a.faceDown||!effect)continue;
        if(effect.id==="5D")items.push(`${pl}: Forecast`);
        if(effect.id==="8D")items.push(`${pl}: Vanish`);
        if(effect.id==="8C"&&((pl==="A"&&g._revealWinner==="B")||(pl==="B"&&g._revealWinner==="A")))items.push(`${pl}: Capitulate`);
      }
    }
    return items;
  };
  const renderShowdown=(isFinal=false)=>{
    const w=gs._revealWinner,aE=gs._revealAE,bE=gs._revealBE;
    const aH=getH(gs,"A"),bH=getH(gs,"B");
    const wClr=w==="A"?"#e74c3c":w==="B"?"#3498db":"#718096";
    const winnerPlayer=w==="A"?"A":w==="B"?"B":null;
    const wText=gs.mode==="solo"
      ?(isFinal
        ?(w==="A"?"You win the solo run!":w==="B"?"The Challenger wins the solo run!":"The solo run ends in a tie!")
        :(w==="A"?"You win the chip!":w==="B"?"The Challenger wins the chip!":"Tie - the Challenger keeps the chip"))
      :(isFinal
        ?(w==="A"?"Player A wins the game!":w==="B"?"Player B wins the game!":"Game ends in a tie!")
        :(w==="A"?"Player A wins the chip!":w==="B"?"Player B wins the chip!":"Tie - no chip awarded"));
    const postQueue=revealPostQueue(gs);
    const soloRow=gs.mode==="solo"&&gs._soloReveal?.cardId?CHALLENGER_LOOKUP[CM[gs._soloReveal.cardId].rank]:null;
    const shell=(
      <div style={{padding:isFinal?24:16,background:`linear-gradient(180deg,${w==="A"?"#241311f2":w==="B"?"#101a27f2":"#101722ee"},#0a0f16f4)`,borderRadius:isFinal?28:22,border:`2px solid ${wClr}55`,boxShadow:isFinal?`0 40px 100px ${wClr}33,inset 0 1px 0 #ffffff18,0 0 0 1px #ffffff08`:`0 24px 60px ${wClr}22,inset 0 1px 0 #ffffff12`,animation:"revealRise 0.35s ease-out",position:"relative",overflow:"hidden",maxWidth:isFinal?980:undefined,width:"100%"}}>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(120deg,transparent 0%,rgba(255,255,255,.05) 22%,transparent 46%)",backgroundSize:"240px 100%",animation:"brassShine 5.5s linear infinite",pointerEvents:"none",opacity:.55}}/>
        {isFinal&&<>
          <div style={{position:"absolute",top:-110,left:-80,width:260,height:260,borderRadius:"50%",background:`radial-gradient(circle,${wClr}33 0%,transparent 68%)`,pointerEvents:"none"}}/>
          <div style={{position:"absolute",bottom:-120,right:-60,width:300,height:300,borderRadius:"50%",background:"radial-gradient(circle,#f1c40f22 0%,transparent 72%)",pointerEvents:"none"}}/>
        </>}
        <div style={{textAlign:"center",marginBottom:isFinal?16:12,position:"relative"}}>
          <div style={{fontSize:isFinal?11:10,fontWeight:800,color:"#7f93a8",letterSpacing:isFinal?4:3,textTransform:"uppercase",marginBottom:6}}>{isFinal?"Final Showdown":"Showdown"}</div>
          <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:isFinal?14:10,marginBottom:4}}>
            {w!=="TIE"&&<Chip filled color={w==="A"?"#d85745":"#338bd2"} label={isFinal?"*":"*"} active/>}
            <div style={{fontSize:isFinal?42:24,fontWeight:900,color:wClr,fontFamily:"Georgia,serif",textShadow:`0 0 ${isFinal?28:18}px ${wClr}55`,lineHeight:1.08}}>{wText}</div>
            {w!=="TIE"&&<Chip filled color={w==="A"?"#d85745":"#338bd2"} label={isFinal?"*":"*"} active/>}
          </div>
          <div style={{fontSize:isFinal?18:13,color:isFinal?"#dce7f2":"#90a4b8",fontWeight:isFinal?700:400}}>{gs.aChips} - {gs.bChips}</div>
          {isFinal&&winnerPlayer&&<div style={{marginTop:10,display:"inline-flex",alignItems:"center",gap:8,padding:"8px 14px",borderRadius:999,background:"#0b1219dd",border:`1px solid ${wClr}55`,boxShadow:`0 12px 28px ${wClr}22`}}>
            <span style={{fontSize:10,fontWeight:800,letterSpacing:1.4,textTransform:"uppercase",color:"#f3d7a4"}}>Champion</span>
            <span style={{fontSize:13,color:"#e8f1f9"}}>{gs.mode==="solo"?(winnerPlayer==="A"?"You beat the Challenger":"The Challenger shuts the door"):`Player ${winnerPlayer} closes it out`}</span>
          </div>}
          {!isFinal&&postQueue.length>0&&<div style={{marginTop:10,display:"inline-flex",gap:8,flexWrap:"wrap",justifyContent:"center",padding:"7px 12px",borderRadius:999,background:"#0b1219cc",border:"1px solid #425160",boxShadow:"0 10px 24px #00000024"}}>
            <span style={{fontSize:9,fontWeight:800,letterSpacing:1.4,textTransform:"uppercase",color:"#d8c08d"}}>Up Next</span>
            <span style={{fontSize:11,color:"#dbe5ee"}}>{postQueue.join(" / ")}</span>
          </div>}
        </div>
        {gs.mode==="solo"
          ?<div style={{display:"grid",gap:isFinal?18:14}}>
            <div style={{display:"flex",gap:isFinal?20:16,justifyContent:"center",flexWrap:"wrap",alignItems:"stretch"}}>
              <div style={{minWidth:300,maxWidth:420,opacity:w==="B"?0.55:1,transition:"all 0.3s",padding:isFinal?"12px 14px 14px":"8px 10px 10px",borderRadius:18,background:w==="A"?"#e74c3c14":"transparent",border:w==="A"?"1px solid #e74c3c44":"1px solid transparent",boxShadow:w==="A"&&isFinal?"0 18px 42px #e74c3c22":"none"}}>
                <div style={{fontSize:isFinal?13:12,fontWeight:700,color:"#e74c3c",marginBottom:6,textAlign:"center",letterSpacing:1}}>
                  YOU {w==="A"&&"*"}
                </div>
                <div style={{display:"flex",gap:5,justifyContent:"center",marginBottom:6,flexWrap:"wrap"}}>
                  {sortC(aH).map(id=>{
                    const mod=getAppliedMods(gs,"A").find(m=>m.target===id);
                    return(<div key={id} className="kp-reveal-card" style={{position:"relative"}}>
                      <PreviewCard id={id} glow={w==="A"?"#e74c3c":undefined} rankSticker={mod?.rank} suitSticker={mod?.suit}/>
                    </div>);
                  })}
                </div>
                <div style={{textAlign:"center"}}><HandBadge ids={aH} mods={getAppliedMods(gs,"A")}/></div>
                <div style={{textAlign:"center",marginTop:6,fontSize:isFinal?11:10,color:w==="A"?"#f3d7a4":"#7f93a8",letterSpacing:.4}}>
                  {aE.handName} {isFinal?(w==="A"?"wins the run":"makes the final hand"):(w==="A"?"beats the Challenger":"faces the Challenger")}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",fontSize:isFinal?28:20,fontWeight:900,color:"#f3d7a4",fontFamily:"Georgia,serif",letterSpacing:2,padding:"0 6px"}}>VS</div>
              <div style={{minWidth:300,maxWidth:420,opacity:w==="A"?0.55:1,transition:"all 0.3s",padding:isFinal?"12px 14px 14px":"8px 10px 10px",borderRadius:18,background:w==="B"?"#3498db14":"transparent",border:w==="B"?"1px solid #3498db44":"1px solid transparent",boxShadow:w==="B"&&isFinal?"0 18px 42px #3498db22":"none"}}>
                <div style={{fontSize:isFinal?13:12,fontWeight:700,color:"#3498db",marginBottom:6,textAlign:"center",letterSpacing:1}}>
                  CHALLENGER {w==="B"&&"*"}
                </div>
                <div style={{display:"flex",justifyContent:"center",marginBottom:8}}>
                  {gs._soloReveal?.cardId
                    ?<div className="kp-reveal-card" style={{position:"relative"}}><PreviewCard id={gs._soloReveal.cardId} glow={w==="B"?"#3498db":undefined}/></div>
                    :<div style={{width:68,height:95,borderRadius:8,border:"1px dashed #516172",display:"flex",alignItems:"center",justifyContent:"center",color:"#7f93a8",fontSize:10}}>No card</div>}
                </div>
                <div style={{textAlign:"center",marginBottom:6}}><span style={{padding:"3px 10px",borderRadius:5,background:"#3498db18",border:"1px solid #3498db44",color:"#7ec3ff",fontWeight:700,fontSize:12,fontFamily:"Georgia,serif",whiteSpace:"nowrap"}}>{bE.handName}</span></div>
                <div style={{textAlign:"center",marginTop:6,fontSize:isFinal?11:10,color:w==="B"?"#f3d7a4":"#7f93a8",letterSpacing:.25,lineHeight:1.4}}>
                  {soloRow?.rankLabel?`${soloRow.rankLabel} maps to ${bE.handName}. `:""}{gs._soloReveal?.description||bE.description}
                </div>
              </div>
            </div>
          </div>
          :<div style={{display:"flex",gap:isFinal?20:16,justifyContent:"center",flexWrap:"wrap"}}>
            {[{pl:"A",hand:aH,ev:aE,clr:"#e74c3c",mods:getAppliedMods(gs,"A")},{pl:"B",hand:bH,ev:bE,clr:"#3498db",mods:getAppliedMods(gs,"B")}].map(({pl,hand:h,ev,clr,mods})=>{
              const isWinner=w===pl;const isTie=w==="TIE";
              return(<div key={pl} style={{opacity:!isWinner&&!isTie?0.5:1,transition:"all 0.3s",padding:isFinal?"12px 14px 14px":"8px 10px 10px",borderRadius:18,background:isWinner?`${clr}14`:"transparent",border:isWinner?`1px solid ${clr}44`:"1px solid transparent",boxShadow:isWinner&&isFinal?`0 18px 42px ${clr}22`:"none"}}>
                <div style={{fontSize:isFinal?13:12,fontWeight:700,color:clr,marginBottom:6,textAlign:"center",letterSpacing:1}}>
                  PLAYER {pl} {isWinner&&"*"}</div>
                <div style={{display:"flex",gap:5,marginBottom:6}}>
                  {sortC(h).map(id=>{
                    const mod=mods.find(m=>m.target===id);
                    return(<div key={id} className="kp-reveal-card" style={{position:"relative"}}>
                      <PreviewCard id={id} glow={isWinner?clr:undefined} rankSticker={mod?.rank} suitSticker={mod?.suit}/>
                    </div>);})}
                </div>
                <div style={{textAlign:"center"}}><HandBadge ids={h} mods={mods}/></div>
                <div style={{textAlign:"center",marginTop:6,fontSize:isFinal?11:10,color:isWinner?"#f3d7a4":"#7f93a8",letterSpacing:.4}}>
                  {ev.handName} {isFinal?(isWinner&&w!=="TIE"?"wins the game":"makes the final hand"):(isWinner&&w!=="TIE"?"claims the chip":"holds")}
                </div>
              </div>);})}
          </div>}
        <div style={{display:"flex",justifyContent:"center",marginTop:18}}>
          {isFinal
            ?<Btn label="New Game" bg="linear-gradient(135deg,#f1c40f,#e67e22)" onClick={()=>setGs(null)}/>
            :(isMatchOver(gs)
              ?<Btn label="New Game" bg="#333" onClick={()=>setGs(null)}/>
              :<Btn label="Next Round ➠" bg="#f1c40f" onClick={advanceFromReveal}/>)}
        </div>
      </div>
    );
    if(!isFinal)return <div style={{position:"fixed",inset:0,zIndex:25,display:"flex",alignItems:"center",justifyContent:"center",padding:"28px 20px",background:"radial-gradient(circle at 50% 20%,rgba(13,21,29,.18) 0%,rgba(10,15,22,.78) 38%,rgba(5,8,12,.9) 100%)",backdropFilter:"blur(6px)"}}>{shell}</div>;
    return <div style={{position:"fixed",inset:0,zIndex:30,display:"flex",alignItems:"center",justifyContent:"center",padding:"28px 20px",background:"radial-gradient(circle at 50% 20%,rgba(241,196,15,.12) 0%,rgba(10,15,22,.82) 38%,rgba(5,8,12,.94) 100%)",backdropFilter:"blur(8px)"}}>{shell}</div>;
  };

  return(<div style={{minHeight:"100vh",background:"radial-gradient(circle at 50% -5%,#2c6a50 0%,#194c39 35%,#0f2e24 68%,#081510 100%)",color:"#e2e8f0",fontFamily:"'Courier New',monospace",display:"flex",flexDirection:"column",position:"relative",overflow:"hidden"}}>
    <style>{`@keyframes floatGlow{0%{transform:translateY(0px)}50%{transform:translateY(-12px)}100%{transform:translateY(0px)}}@keyframes pulseGold{0%,100%{box-shadow:0 0 0 rgba(241,196,15,0)}50%{box-shadow:0 0 18px rgba(241,196,15,.28)}}@keyframes revealRise{0%{opacity:0;transform:translateY(14px) scale(.98)}100%{opacity:1;transform:translateY(0) scale(1)}}@keyframes cardDeal{0%{opacity:0;transform:translateY(20px) scale(.94)}100%{opacity:1;transform:translateY(0) scale(1)}}@keyframes inspectPop{0%{opacity:0;transform:translateY(8px) scale(.97)}100%{opacity:1;transform:translateY(0) scale(1)}}@keyframes toastPop{0%{opacity:0;transform:translateY(-8px) scale(.96)}100%{opacity:1;transform:translateY(0) scale(1)}}@keyframes brassShine{0%{background-position:-220px 0}100%{background-position:220px 0}}.kp-card{animation:cardDeal .24s ease-out;transform-origin:center bottom}.kp-card-clickable:hover{transform:none!important;filter:brightness(1.06);box-shadow:0 10px 20px #0005,0 0 0 1px rgba(92,66,33,.18)!important}.kp-card-small.kp-card-clickable:hover{transform:none!important}.kp-card::after{content:"";position:absolute;inset:0;border-radius:inherit;background:linear-gradient(135deg,rgba(255,255,255,.2),transparent 28%,transparent 72%,rgba(86,60,28,.06));opacity:.9;pointer-events:none}.kp-card::before{content:"";position:absolute;inset:3px;border-radius:6px;border:1px solid rgba(126,90,43,.16);pointer-events:none}.kp-card-small::before{content:"";position:absolute;inset:2px;border-radius:6px;border:1px solid rgba(126,90,43,.18);pointer-events:none}.kp-action-slot{animation:cardDeal .28s ease-out}.kp-reveal-card{animation:revealRise .28s ease-out}.kp-modal-shell .kp-card-clickable:hover{transform:none!important;filter:brightness(1.04);box-shadow:0 8px 18px #0005,0 0 0 1px rgba(92,66,33,.14)!important}.kp-modal-shell .kp-card-small.kp-card-clickable:hover{transform:none!important}@media (max-width:900px){.kp-table-frame{display:none}.kp-main-column{padding-left:20px!important;padding-right:12px!important}}`}</style>
    <div style={{position:"absolute",inset:0,pointerEvents:"none"}}>
      <div className="kp-table-frame" style={{position:"absolute",inset:18,borderRadius:30,border:"2px solid #b7965b22",boxShadow:"inset 0 0 0 1px #f3dfa81a"}}/>
      <div style={{position:"absolute",top:-120,left:"50%",transform:"translateX(-50%)",width:620,height:620,borderRadius:"50%",background:"radial-gradient(circle,#f1c40f12 0%,transparent 62%)",animation:"floatGlow 9s ease-in-out infinite"}}/>
      <div style={{position:"absolute",left:-140,top:260,width:360,height:360,borderRadius:"50%",background:"radial-gradient(circle,#d4af6a14 0%,transparent 68%)",animation:"floatGlow 12s ease-in-out infinite"}}/>
      <div style={{position:"absolute",right:-120,top:180,width:300,height:300,borderRadius:"50%",background:"radial-gradient(circle,#7ed3a812 0%,transparent 68%)",animation:"floatGlow 10s ease-in-out infinite"}}/>
    </div>
    <div style={{padding:"10px 16px",borderBottom:isSuddenDeath?"2px solid #d27d5c":"1px solid #6e573122",display:"flex",alignItems:"center",gap:12,background:isSuddenDeath?"linear-gradient(180deg,#4b1f18dd,#1c120ddd)":"linear-gradient(180deg,#143126dd,#0d2019ee)",fontSize:12,flexWrap:"wrap",backdropFilter:"blur(10px)",position:"relative",zIndex:1,boxShadow:"0 10px 30px #00000026"}}>
      <span style={{fontFamily:"Georgia,serif",fontWeight:900,color:"#f1c40f",letterSpacing:2}}>KAIZEN POKER</span>
      <span style={{color:"#445"}}>Round {gs.round}</span>
      <span style={{padding:"4px 10px",borderRadius:999,border:"1px solid #334155",color:"#c7d2de",fontSize:10,textTransform:"uppercase",letterSpacing:1,background:"#101923",animation:gs.phase==="reveal"?"pulseGold 1.8s ease-in-out infinite":"none"}}>
        {gs.phase==="action"?(gs.mode==="solo"?"Action - Solo Player":`Action - Player ${p}`):gs.phase==="score"?"Scoring":gs.phase==="reveal"?"Reveal":"Game Over"}
      </span>
      {isSuddenDeath&&<span style={{color:"#e74c3c",fontWeight:700,fontSize:10,animation:"pulse 1.5s infinite",letterSpacing:1}}>⚡ SUDDEN DEATH</span>}
      <div style={{marginLeft:"auto",display:"flex",gap:10,flexWrap:"wrap"}}>
        <div style={{padding:"6px 10px",borderRadius:12,background:"#0c141dcc",border:"1px solid #2a3644",display:"flex",alignItems:"center",gap:8}}>
          <span style={{color:"#e74c3c",fontWeight:800}}>{gs.mode==="solo"?"YOU":"A"} {gs.aChips}</span>
          <span style={{display:"flex",gap:4}}>{chipStrip("A",gs.aChips,"#e74c3c")}</span>
        </div>
        <div style={{padding:"6px 10px",borderRadius:12,background:"#0c141dcc",border:"1px solid #2a3644",display:"flex",alignItems:"center",gap:8}}>
          <span style={{color:"#3498db",fontWeight:800}}>{gs.mode==="solo"?"CHALLENGER":"B"} {gs.bChips}</span>
          <span style={{display:"flex",gap:4}}>{chipStrip("B",gs.bChips,"#3498db")}</span>
        </div>
      </div></div>
    <div style={{display:"flex",flex:1,overflow:"hidden",height:0,position:"relative",zIndex:1}}>
      <div className="kp-main-column" style={{flex:1,minWidth:0,padding:16,display:"flex",flexDirection:"column",gap:12,overflowY:"auto",overflowX:"hidden"}}>
        {toast&&<div key={toast.key} style={{position:"sticky",top:6,zIndex:5,display:"flex",justifyContent:"center",pointerEvents:"none",marginBottom:-2}}>
          <div style={{
            padding:"8px 14px",
            borderRadius:999,
            fontSize:12,
            fontWeight:800,
            letterSpacing:.2,
            color:toast.tone==="frozen"?"#d8f0ff":toast.tone==="cancel"?"#e6dfd2":"#fff0cf",
            background:toast.tone==="frozen"
              ?"linear-gradient(180deg,#21455ddf,#143041f2)"
              :toast.tone==="cancel"
              ?"linear-gradient(180deg,#3b3428df,#241f18f2)"
              :"linear-gradient(180deg,#5a341fdf,#392114f2)",
            border:toast.tone==="frozen"
              ?"1px solid #6fb6e066"
              :toast.tone==="cancel"
              ?"1px solid #b49c7a55"
              :"1px solid #f0a35a66",
            boxShadow:"0 12px 28px #00000044, inset 0 1px 0 #ffffff18",
            animation:"toastPop 0.18s ease-out"
          }}>{toast.msg}</div>
        </div>}
        {/* Remember */}
        {(()=>{const aq=gs.scrap.filter(id=>CM[id].type==="Remember");if(!aq.length)return null;
          return(<div style={{background:"linear-gradient(180deg,#18372bdd,#11271fff)",border:"1px solid #8f744333",borderRadius:8,padding:"6px 10px",display:"flex",flexWrap:"wrap",gap:8,alignItems:"center",boxShadow:"inset 0 1px 0 #f0e0b10d"}}>
            <span style={{fontSize:8,fontWeight:700,color:"#6c5ce7",letterSpacing:1,textTransform:"uppercase"}}>Active</span>
            {aq.map(id=>(<span key={id} style={{fontSize:10,color:"#b8b0f0"}}><strong style={{color:"#6c5ce7"}}>{CM[id].name}</strong>{" — "}{CM[id].text.replace("As long as this card is scrapped, ","")}</span>))}</div>)})()}
        {/* Play areas */}
        {gs.mode==="solo"
          ?<div style={{display:"flex",gap:16,flexWrap:"wrap",minWidth:0}}>
            <div style={{flex:"1 1 320px",minWidth:0,padding:"12px 14px",borderRadius:18,background:"linear-gradient(180deg,#11293ad8,#0b1c28dc)",border:"1px solid #658dbb55",boxShadow:"0 10px 28px #0000001f,inset 0 1px 0 #f5e3bc12,inset 0 0 0 1px #ffffff05",overflow:"hidden"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:6}}>
                <div style={{fontSize:9,color:"#89b8ff",fontWeight:800,letterSpacing:1}}>CHALLENGER DECK</div>
                <button
                  onClick={()=>setModal({type:"soloLookup",activeRank:gs._soloReveal?.cardId?CM[gs._soloReveal.cardId].rank:null})}
                  style={{
                    padding:"4px 10px",
                    borderRadius:999,
                    border:"1px solid #334155",
                    color:"#c7d2de",
                    fontSize:10,
                    textTransform:"uppercase",
                    letterSpacing:1,
                    background:"#101923",
                    cursor:"pointer",
                    fontWeight:700,
                    boxShadow:"inset 0 1px 0 #ffffff12"
                  }}
                >
                  Challenger Lookup
                </button>
              </div>
              <div style={{display:"flex",gap:16,alignItems:"center",minHeight:95}}>
                <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0,flex:"1 1 auto"}}>
                  <div style={{display:"flex",alignItems:"center",minWidth:gs._soloRevealedCards?.length?110:0}}>
                    {(gs._soloRevealedCards||[]).map((id,i)=>{
                      const isLatest=i===((gs._soloRevealedCards||[]).length-1);
                      return(
                        <div key={`${id}-${i}`} style={{marginLeft:i===0?0:-42,position:"relative",zIndex:i+1}}>
                          <PreviewCard id={id} glow={isLatest?"#3498db":undefined}/>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{display:"grid",gap:6,minWidth:0}}>
                    <div style={{fontSize:12,color:"#dbe5ee",fontWeight:700}}>
                      {gs.bDeck.length} card{gs.bDeck.length!==1?"s":""} remain
                      {(gs._soloRevealedCards?.length||0)>0&&<span style={{color:"#89b8ff",fontWeight:600}}> · {(gs._soloRevealedCards||[]).length} revealed</span>}
                    </div>
                    <div style={{fontSize:10,color:"#8ca0b3",lineHeight:1.4,whiteSpace:"normal"}}>Sweep over the revealed stack to inspect what the Challenger has shown so far.</div>
                  </div>
                </div>
                <div style={{display:"flex",gap:4,flexShrink:0}}>
                  {Array.from({length:Math.min(4,Math.max(gs.bDeck.length,1))},(_,i)=><div key={i} style={{width:68,height:95,borderRadius:6,background:"linear-gradient(160deg,#17192b,#0b0f18)",border:"1px solid #2a3240",boxShadow:"0 8px 18px #00000033",transform:`translateX(${i*-46}px)`}}/>)}
                </div>
              </div>
            </div>
            <div style={{flex:"1 1 320px",minWidth:0,padding:"12px 14px",borderRadius:18,background:"linear-gradient(180deg,#143327d8,#0d241cdc)",border:"1px solid #b96d5a55",boxShadow:"0 10px 28px #0000001f,inset 0 1px 0 #f5e3bc12,inset 0 0 0 1px #ffffff05",overflow:"hidden"}}>
              <div style={{fontSize:9,color:"#e48b8b",fontWeight:800,letterSpacing:1,marginBottom:6}}>YOUR ACTIONS</div>
              <div style={{display:"flex",gap:4,minHeight:95,flexWrap:"wrap"}}>
                {getP(gs,"A").map((a,i)=>a.faceDown?<div key={i} className="kp-action-slot" style={{width:68,height:95,borderRadius:6,background:"linear-gradient(160deg,#17192b,#0b0f18)",border:"1px solid #2a3240",display:"flex",alignItems:"center",justifyContent:"center",color:"#7f93a8",fontSize:10,boxShadow:"0 8px 18px #00000033"}}>
                    <div style={{textAlign:"center",lineHeight:1.2}}>
                      <div style={{fontSize:9,fontWeight:800,letterSpacing:.5,textTransform:"uppercase"}}>Hidden</div>
                      <div style={{fontSize:8,color:"#516172"}}>Face-down</div>
                    </div>
                  </div>
                  :<div key={i} className="kp-action-slot" style={{position:"relative"}}>
                    <PreviewCard id={a.id} copySticker={a.copiedFrom?CM[a.copiedFrom]?.name:undefined}/>
                  </div>)}
              </div>
            </div>
          </div>
          :<div style={{display:"flex",gap:16,flexWrap:"wrap",minWidth:0}}>{[opp(p),p].map(pl=>(<div key={pl} style={{flex:"1 1 320px",minWidth:0,padding:"12px 14px",borderRadius:18,background:"linear-gradient(180deg,#143327d8,#0d241cdc)",border:`1px solid ${pl==="A"?"#b96d5a55":"#658dbb55"}`,boxShadow:"0 10px 28px #0000001f,inset 0 1px 0 #f5e3bc12,inset 0 0 0 1px #ffffff05",overflow:"hidden"}}>
            <div style={{fontSize:9,color:pl==="A"?"#e48b8b":"#89b8ff",fontWeight:800,letterSpacing:1,marginBottom:6}}>{pl}'s ACTIONS</div>
            <div style={{display:"flex",gap:4,minHeight:95,flexWrap:"wrap"}}>
              {getP(gs,pl).map((a,i)=>a.faceDown?<div key={i} className="kp-action-slot" style={{width:68,height:95,borderRadius:6,background:"linear-gradient(160deg,#17192b,#0b0f18)",border:"1px solid #2a3240",display:"flex",alignItems:"center",justifyContent:"center",color:"#7f93a8",fontSize:10,boxShadow:"0 8px 18px #00000033"}}>
                  <div style={{textAlign:"center",lineHeight:1.2}}>
                    <div style={{fontSize:9,fontWeight:800,letterSpacing:.5,textTransform:"uppercase"}}>Hidden</div>
                    <div style={{fontSize:8,color:"#516172"}}>Face-down</div>
                  </div>
                </div>
                :<div key={i} className="kp-action-slot" style={{position:"relative"}}>
                  <PreviewCard id={a.id} copySticker={a.copiedFrom?CM[a.copiedFrom]?.name:undefined}/>
                </div>)}</div></div>))}</div>}
        <PublicZones gs={gs} extraControls={<><DeckStats gs={gs} player="A"/><DeckStats gs={gs} player="B"/></>}/>
        {/* Hand */}
        <div style={{padding:"14px 16px",borderRadius:20,background:"linear-gradient(180deg,#14372adf,#0d241cdd)",border:`1px solid ${p==="A"?"#b96d5a55":"#658dbb55"}`,boxShadow:"0 18px 36px #00000022,inset 0 1px 0 #f5e3bc12,inset 0 0 0 1px #ffffff05"}}>
          <div style={{fontSize:11,color:p==="A"?"#ff9a9a":"#8fc5ff",fontWeight:800,letterSpacing:1,marginBottom:8,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            YOUR HAND (Player {p})
            {canAct&&<span style={{color:pClr,fontSize:10}}>— {actionsLeft} action{actionsLeft!==1?"s":""} left</span>}
            {canAct&&!fdMode&&<Btn label="Play Face-Down ▼" bg="#555" onClick={()=>setFdMode(true)}/>}
            {canAct&&fdMode&&<><span style={{color:"#aaa",fontSize:10}}>Pick a card</span><Btn label="Cancel" bg="#333" onClick={()=>setFdMode(false)}/></>}
            {canAct&&undoState&&<Btn label="↩ Undo" bg="#e67e22" onClick={doUndo}/>}
            {gs.phase==="score"&&<HandBadge ids={hand} mods={getAppliedMods(gs,p)}/>}</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {sortC(hand).map(id=>(<Card key={id} id={id} onClick={canAct?()=>handlePlayCard(id):undefined}
              glow={canAct?(fdMode?"#888":pClr):undefined} isNew={gs.newCards.includes(id)}/>))}</div></div>
        {gs.phase==="score"&&<Btn label="REVEAL & SCORE" bg="linear-gradient(135deg,#f1c40f,#e67e22)" onClick={doScore}/>}
        {/* REVEAL / GAME END SHOWDOWN */}
        {gs.phase==="gameOver"&&!gs._revealAE&&<div style={{textAlign:"center",padding:20}}>
          <div style={{fontSize:24,fontWeight:900,color:"#f1c40f",fontFamily:"Georgia,serif"}}>{gs.mode==="solo"?(gs.aChips>gs.bChips?"You win the solo run!":"The Challenger wins the solo run!"):`Game Over - Player ${gs.aChips>=7?"A":"B"} Wins!`}</div>
          <Btn label="New Game" bg="#333" onClick={()=>setGs(null)}/></div>}
        <div style={{marginTop:"auto",position:"sticky",bottom:0,zIndex:1,paddingTop:8,background:"linear-gradient(180deg,transparent,#09121af2 26%)"}}>
          <PlaytestPanel gs={gs} onReplaceGameState={replaceSandboxState} makeFreshGame={buildFreshGame} cards={CARDS}/>
        </div>
      </div>
      {/* Log */}
      <div style={{width:260,borderLeft:"1px solid #1c2733",background:"linear-gradient(180deg,#0b1016ee,#091018ee)",display:"flex",flexDirection:"column",flexShrink:0,boxShadow:"inset 1px 0 0 #ffffff05"}}>
        <div style={{fontSize:9,fontWeight:800,color:"#607385",letterSpacing:2,padding:"12px 12px 6px"}}>BATTLE LOG</div>
        <div ref={el=>{if(el)el.scrollTop=el.scrollHeight;}} style={{flex:1,overflow:"auto",padding:"0 12px 12px",fontSize:10,color:"#8ca0b3",lineHeight:1.6}}>
          {gs.log.map((m,i)=>(<div key={i} style={{color:m.startsWith("===")?"#f1c40f":m.startsWith("🏆")?"#2ecc71":m.includes("wins")?"#e67e22":m.includes("Fizzle")||m.includes("Frozen")?"#e74c3c":"#667",fontWeight:m.startsWith("===")?700:400}}>{m}</div>))}</div></div>
    </div>
    {gs.phase==="reveal"&&renderShowdown(false)}
    {gs.phase==="gameOver"&&gs._revealAE&&renderShowdown(true)}
    {/* MODALS */}
    {modal?.type==="refreshOpts"&&<Modal title="Face-Down Options">
      <p style={{color:"#aaa",fontSize:12,marginBottom:10}}>Choose:</p>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"center"}}>
        {modal.opts.map(o=>(<Btn key={o.key} label={o.label} bg={o.key==="skip"?"#333":o.key==="refresh"?"#3498db":o.key==="sift"?"#2ecc71":"#6c5ce7"} onClick={()=>modal.onChoice(o.key)}/>))}</div></Modal>}
    {modal?.type==="pickDiscard"&&<Modal title={modal.title||"Discard a card"}>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
        {(modal.hand||getH(gs,gs.currentPlayer)).map(id=>{const v=!modal.filter||modal.filter(id);
          return <PreviewCard key={id} id={id} dimmed={!v} onClick={v?()=>modal.onPick(id):undefined} glow={v?"#e74c3c":undefined} isNew={(modal.newCards||gs.newCards||[]).includes(id)}/>;})}</div></Modal>}
    {modal?.type==="pickFromList"&&<Modal title={modal.title}>
      {modal.showHand&&<div style={{marginBottom:8}}>
        <div style={{fontSize:9,color:"#556",fontWeight:700,letterSpacing:1,marginBottom:3}}>YOUR SCORING HAND</div>
        <div style={{display:"flex",gap:4,marginBottom:6}}>{sortC(modal.showHand).map(id=><PreviewCard key={id} id={id}/>)}</div></div>}
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
        {modal.cards.map(id=>{const v=!modal.filter||modal.filter(id);
          return <PreviewCard key={id} id={id} dimmed={!v} onClick={v?()=>modal.onPick(id):undefined} glow={v?"#f1c40f":undefined}/>;})}</div>
      {modal.canCancel&&<Btn label="Cancel / Skip" bg="#333" onClick={modal.onCancel}/>}</Modal>}
    {modal?.type==="soloLookup"&&<Modal title="Challenger Lookup">
      <div style={{display:"grid",gap:6}}>
        <div style={{display:"grid",gridTemplateColumns:"70px 160px 1fr",gap:8,alignItems:"center",padding:"0 8px",fontSize:10,fontWeight:800,color:"#d8c08d",letterSpacing:1.2,textTransform:"uppercase"}}>
          <div>Rank</div>
          <div>Maps To</div>
          <div>Definition</div>
        </div>
        {CHALLENGER_ROWS.map(row=>{
          const active=modal.activeRank===row.rank;
          return(
            <div key={row.rank} style={{display:"grid",gridTemplateColumns:"70px 160px 1fr",gap:8,alignItems:"center",padding:"6px 8px",borderRadius:10,background:active?"linear-gradient(90deg,#245b811f,#0f2234cc)":"#0a1118aa",border:active?"1px solid #3498db66":"1px solid #24313f"}}>
              <div style={{fontSize:12,fontWeight:900,color:active?"#8fd0ff":"#dfe8ef"}}>{row.rank} ➠</div>
              <div style={{fontSize:12,fontWeight:700,color:active?"#f5fbff":"#c8d6e2"}}>{row.handName}</div>
              <div style={{fontSize:11,color:active?"#dceaf6":"#92a4b5",lineHeight:1.35}}>{row.description}</div>
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",justifyContent:"center",marginTop:12}}>
        <Btn label="Close" bg="#333" onClick={()=>setModal(null)}/>
      </div>
    </Modal>}
    {modal?.type==="pickMulti"&&<MultiPickModal title={modal.title} cards={modal.cards} maxPick={modal.maxPick} onPick={modal.onPick}/>}
    {modal?.type==="twoChoice"&&<Modal title={modal.title}>
      <div style={{display:"flex",justifyContent:"center",marginBottom:12}}><Card id={modal.card}/></div>
      <div style={{display:"flex",gap:8,justifyContent:"center"}}><Btn label={modal.opt1} bg="#3498db" onClick={modal.on1}/><Btn label={modal.opt2} bg="#e67e22" onClick={modal.on2}/></div></Modal>}
    {modal?.type==="twoOptChoice"&&<Modal title={modal.title}>
      <div style={{display:"flex",gap:8,justifyContent:"center"}}><Btn label={modal.opt1} bg="#3498db" onClick={modal.on1}/><Btn label={modal.opt2} bg="#e74c3c" onClick={modal.on2}/></div></Modal>}
    {modal?.type==="brainstorm"&&<BrainstormModal hand={modal.hand} newCards={modal.newCards} onPick={modal.onPick}/>}
    {modal?.type==="rejuvenate"&&<RejuvenateModal hand={modal.hand} onPick={modal.onPick}/>}
    {modal?.type==="confirm"&&<Modal title={modal.title}>
      <div style={{display:"flex",justifyContent:"center",marginBottom:10}}><Card id={modal.card}/></div>
      <p style={{color:"#aaa",fontSize:12,marginBottom:10,textAlign:"center"}}>{modal.msg}</p>
      <div style={{display:"flex",gap:8,justifyContent:"center"}}><Btn label="Play It" bg="#2ecc71" onClick={modal.onYes}/><Btn label="Cancel" bg="#333" onClick={modal.onNo}/></div></Modal>}
    {modal?.type==="pickRank"&&<Modal title={modal.title}>
      {modal.showHand&&<div style={{marginBottom:8}}><div style={{fontSize:9,color:"#556",fontWeight:700,letterSpacing:1,marginBottom:3}}>YOUR SCORING HAND</div>
        <div style={{display:"flex",gap:4,marginBottom:4}}>{sortC(modal.showHand).map(id=><PreviewCard key={id} id={id}/>)}</div></div>}
      <div style={{display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center"}}>
        {modal.ranks.map(r=>(<button key={r} onClick={()=>modal.onPick(r)} style={{width:44,height:44,borderRadius:6,background:"#1a1a2e",border:"1px solid #f1c40f44",color:"#f1c40f",fontSize:18,fontWeight:900,cursor:"pointer",fontFamily:"Georgia,serif",display:"flex",alignItems:"center",justifyContent:"center"}}>{r}</button>))}</div>
      {modal.onCancel&&<div style={{display:"flex",justifyContent:"center",marginTop:10}}><Btn label="Cancel / Skip" bg="#333" onClick={modal.onCancel}/></div>}</Modal>}
    {modal?.type==="pickSuit"&&<Modal title={modal.title}>
      {modal.showHand&&<div style={{marginBottom:8}}><div style={{fontSize:9,color:"#556",fontWeight:700,letterSpacing:1,marginBottom:3}}>YOUR SCORING HAND</div>
        <div style={{display:"flex",gap:4,marginBottom:4}}>{sortC(modal.showHand).map(id=><PreviewCard key={id} id={id}/>)}</div></div>}
      <div style={{display:"flex",gap:12,justifyContent:"center"}}>
        {SO.map(s=>(<button key={s} onClick={()=>modal.onPick(s)} style={{width:56,height:56,borderRadius:8,background:"#1a1a2e",border:`2px solid ${SC[s]}44`,color:SC[s],fontSize:28,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{SUITS[s]}</button>))}</div>
      {modal.onCancel&&<div style={{display:"flex",justifyContent:"center",marginTop:10}}><Btn label="Cancel / Skip" bg="#333" onClick={modal.onCancel}/></div>}</Modal>}
    {modal?.type==="queen2"&&<Modal title={`${modal.pl}: Modify ${CM[modal.cardId].name}`}>
      {modal.showHand&&<div style={{marginBottom:8}}><div style={{fontSize:9,color:"#556",fontWeight:700,letterSpacing:1,marginBottom:3}}>YOUR SCORING HAND</div>
        <div style={{display:"flex",gap:4,marginBottom:4}}>{sortC(modal.showHand).map(id=><PreviewCard key={id} id={id}/>)}</div></div>}
      <div style={{display:"flex",justifyContent:"center",marginBottom:10}}><Card id={modal.cardId}/></div>
      <p style={{color:"#aaa",fontSize:11,textAlign:"center",marginBottom:10}}>Unmodified 2 — Queen effects available:</p>
      <div style={{display:"flex",gap:6,justifyContent:"center",flexWrap:"wrap"}}>
        {modal.misc&&modal.camo&&<Btn label="Rank + Suit" bg="#9b59b6" onClick={modal.onBoth}/>}
        {modal.misc&&<Btn label="Rank Only" bg="#e67e22" onClick={modal.onRank}/>}
        {modal.camo&&<Btn label="Suit Only" bg="#3498db" onClick={modal.onSuit}/>}
        <Btn label="Skip" bg="#333" onClick={modal.onSkip}/></div></Modal>}
    {modal?.type==="alert"&&<Modal title="Notice"><p style={{color:"#aaa",fontSize:13}}>{modal.msg}</p><Btn label="OK" bg="#333" onClick={modal.onOk}/></Modal>}
  </div>);
}
