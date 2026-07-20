// Pure rules engine: hand evaluation, comparison, game-state constructors and
// round bookkeeping. No React, no DOM.
import { CARDS, CM, RV, SO, CHALLENGER_LOOKUP, SOLO_TARGET_CHIPS, SOLO_DIFFICULTIES, isSoloMode } from "./gameData.js";
import { TUTORIAL_INITIAL_DECKS } from "./tutorialScript.js";

function shuf(a){const r=[...a];for(let i=r.length-1;i>0;i--){const j=0|Math.random()*(i+1);[r[i],r[j]]=[r[j],r[i]]}return r}
function sortC(ids){return[...ids].sort((a,b)=>{const ca=CM[a],cb=CM[b];return(RV[ca.rank]-RV[cb.rank])||SO.indexOf(ca.suit)-SO.indexOf(cb.suit)})}
function drawCards(gs,player,n){
  // Strip results of any prior draw: a stale `error` would falsely end the
  // game at the next `if(g.error)` check, and stale `drawn` would replay logs.
  const st={...gs};delete st.error;delete st.drawn;
  const dk=player==="A"?[...st.aDeck]:[...st.bDeck];
  const dc=player==="A"?[...st.aDiscard]:[...st.bDiscard];
  const hand=player==="A"?[...st.aHand]:[...st.bHand];const drawn=[];
  let reshuffled=false;
  for(let i=0;i<n;i++){if(!dk.length){if(!dc.length)return{...st,error:"DECK_EXHAUSTED"};dk.push(...shuf(dc));dc.length=0;reshuffled=true;}
    drawn.push(dk.shift());hand.push(drawn[drawn.length-1]);}
  if(player==="A"){st.aDeck=dk;st.aDiscard=dc;st.aHand=hand}else{st.bDeck=dk;st.bDiscard=dc;st.bHand=hand}
  if(reshuffled)st._lastReshuffleAt=`${Date.now()}-${player}-${Math.random().toString(16).slice(2,8)}`;
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
function displayOrder(cardIds,mods=[]){
  const scored=evalHand(cardIds,mods);
  const effById=Object.fromEntries(scored.effective.map(c=>[c.id,c]));
  if((scored.handRank===5||scored.handRank===9||scored.handRank===10)&&scored.rankVals[0]===3){
    return [...cardIds].sort((a,b)=>{
      const av=effById[a]?.rank==="A"?-1:RV[effById[a]?.rank??CM[a].rank];
      const bv=effById[b]?.rank==="A"?-1:RV[effById[b]?.rank??CM[b].rank];
      return av-bv||SO.indexOf((effById[a]?.suit??CM[a].suit))-SO.indexOf((effById[b]?.suit??CM[b].suit));
    });
  }
  return sortC(cardIds);
}
function evalChallenger(cardId){
  const card=CM[cardId];
  const lookup=card?CHALLENGER_LOOKUP[card.rank]:null;
  if(!card||!lookup)return {card:null,handRank:13,handName:"Flush Five",description:"No Challenger card available"};
  return {card,rank:card.rank,...lookup};
}
function isMatchOver(gs){
  if(gs.mode==="tutorial")return false;
  return isSoloMode(gs.mode) ? (gs.aChips>=SOLO_TARGET_CHIPS||gs.bChips>=SOLO_TARGET_CHIPS) : (gs.aChips>=7||gs.bChips>=7);
}
function getMatchWinner(gs){
  if(gs.mode==="tutorial")return gs.aChips>=gs.bChips?"A":"B";
  return isSoloMode(gs.mode) ? (gs.aChips>=SOLO_TARGET_CHIPS?"A":"B") : (gs.aChips>=7?"A":"B");
}
function getRoundRequirements(gs){
  if(isSoloMode(gs.mode)){
    const aClose=gs.aChips===6,bClose=gs.bChips===6;
    let aActions=2,bActions=2,aDraw=7,bDraw=0;
    if(aClose&&!bClose){bActions=3;}
    if(bClose&&!aClose){aDraw=8;aActions=3;}
    return {aActions,bActions,aDraw,bDraw,suddenDeath:aClose||bClose};
  }
  const aClose=gs.aChips===6,bClose=gs.bChips===6;
  let aActions=2,bActions=2,aDraw=7,bDraw=7;
  if(aClose&&!bClose){bDraw=8;bActions=3;}
  if(bClose&&!aClose){aDraw=8;aActions=3;}
  return {aActions,bActions,aDraw,bDraw,suddenDeath:aClose||bClose};
}
function initGame(mode="hotseat",options={}){const all=shuf(CARDS.map(c=>c.id));
  const startedAt=new Date().toISOString();
  const gameId=(typeof crypto!=="undefined"&&crypto.randomUUID)?crypto.randomUUID():`kp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const aInitialDeck=all.slice(0,26),bInitialDeck=all.slice(26),aInitialHand=aInitialDeck.slice(0,7),bInitialHand=isSoloMode(mode)?[]:bInitialDeck.slice(0,7);
  const soloDifficulty=isSoloMode(mode)?(options.soloDifficulty||SOLO_DIFFICULTIES.difficult):null;
  return{mode,aDeck:all.slice(7,26),bDeck:isSoloMode(mode)?bInitialDeck:bInitialDeck.slice(7),aHand:sortC(all.slice(0,7)),bHand:isSoloMode(mode)?[]:sortC(all.slice(26,33)),
    aDiscard:[],bDiscard:[],aPlay:[],bPlay:[],scrap:[],aChips:0,bChips:0,round:1,firstPlayer:"A",
    phase:"action",currentPlayer:"A",regularActionsPlayed:0,actionsRequired:2,bonusActions:0,
    log:[],amends:{aFreeze:false,bFreeze:false,aNegate:false,bNegate:false},newCards:[],aMods:[],bMods:[],aForecast:[],bForecast:[],_aReq:2,_bReq:2,_remotePrompt:null,
    _soloTarget:SOLO_TARGET_CHIPS,_soloReveal:null,_soloRevealedCards:[],_soloDifficulty:soloDifficulty,_gameId:gameId,_createdAt:startedAt,_aInitialDeck:aInitialDeck,_bInitialDeck:bInitialDeck,_aInitialHand:sortC(aInitialHand),_bInitialHand:sortC(bInitialHand)};}
function cloneGs(gs){return JSON.parse(JSON.stringify(gs));}
function tutorialRoundState(roundNumber,baseState=null){
  const seed=baseState?cloneGs(baseState):initGame("tutorial");
  return {
    ...seed,
    mode:"tutorial",
    round:roundNumber,
    firstPlayer:"A",
    currentPlayer:"A",
    phase:"action",
    regularActionsPlayed:0,
    actionsRequired:2,
    bonusActions:0,
    aHand:sortC([...TUTORIAL_INITIAL_DECKS.A.slice(0,7)]),
    bHand:sortC([...TUTORIAL_INITIAL_DECKS.B.slice(0,7)]),
    aDeck:[...TUTORIAL_INITIAL_DECKS.A.slice(7)],
    bDeck:[...TUTORIAL_INITIAL_DECKS.B.slice(7)],
    aDiscard:[],
    bDiscard:[],
    scrap:[],
    aPlay:[],
    bPlay:[],
    aMods:[],
    bMods:[],
    aForecast:[],
    bForecast:[],
    newCards:[],
    amends:{aFreeze:false,bFreeze:false,aNegate:false,bNegate:false},
    _aReq:2,
    _bReq:2,
    _remotePrompt:null,
    _scoreFlow:null,
    _revealAE:null,
    _revealBE:null,
    _revealWinner:null,
    _soloReveal:null,
    _tutorialRound:roundNumber,
    _tutorialAck:null,
    _tutorialComplete:false,
    _aInitialDeck:[...TUTORIAL_INITIAL_DECKS.A],
    _bInitialDeck:[...TUTORIAL_INITIAL_DECKS.B],
    _aInitialHand:[...TUTORIAL_INITIAL_DECKS.A.slice(0,7)],
    _bInitialHand:[...TUTORIAL_INITIAL_DECKS.B.slice(0,7)],
  };
}
export { shuf, sortC, drawCards, displayOrder, evalChallenger, isMatchOver, getMatchWinner, getRoundRequirements, initGame, cloneGs, tutorialRoundState };
