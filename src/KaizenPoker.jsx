import { useState, useCallback, useRef } from "react";

// ============================================================
// DATA (unchanged)
// ============================================================
const SUITS={C:"♣",D:"♦",H:"♥",S:"♠"};
const SC={C:"#2ecc71",D:"#f39c12",H:"#e74c3c",S:"#3498db"};
const SO=["C","D","H","S"];
const RO=["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const RV=Object.fromEntries(RO.map((r,i)=>[r,i]));
const FACE=["J","Q","K","A"];
const TI={Enact:{bg:"#181d20",bd:"#636e72",lb:"Enact"},Modify:{bg:"#1f1c0e",bd:"#d4a017",lb:"Modify"},
  React:{bg:"#0e1f1f",bd:"#00b894",lb:"React"},Amend:{bg:"#1f0e0e",bd:"#d63031",lb:"Amend"},
  Remember:{bg:"#13102a",bd:"#6c5ce7",lb:"Remember"}};
const CARDS=[
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
{id:"9S",rank:"9",suit:"S",name:"Reap",type:"React",text:"Scrap a card matching another card in your discard's suit or rank."},
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
const CM=Object.fromEntries(CARDS.map(c=>[c.id,c]));
const TC=["#718096","#48bb78","#38b2ac","#4299e1","#667eea","#9f7aea","#ed64a6","#f56565","#ed8936","#f6e05e","#fefcbf","#fc8181","#fbb6ce","#fff5f5"];

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
function evalHand(cardIds,mods=[]){
  let eff=cardIds.map(id=>{const b=CM[id];const m=mods.find(x=>x.target===id);
    return m?{...b,rank:m.rank||b.rank,suit:m.suit||b.suit,mod:true}:{...b,mod:false}});
  const ranks=eff.map(c=>c.rank),suits=eff.map(c=>c.suit);
  const rv=ranks.map(r=>RV[r]).sort((a,b)=>b-a);
  const rc={};ranks.forEach(r=>{rc[r]=(rc[r]||0)+1});const sc={};suits.forEach(s=>{sc[s]=(sc[s]||0)+1});
  const rsc={};eff.forEach(c=>{const k=c.rank+c.suit;rsc[k]=(rsc[k]||0)+1});
  const maxId=Math.max(...Object.values(rsc));const isFlush=Object.values(sc).some(c=>c===5);
  const sv=[...new Set(rv)].sort((a,b)=>a-b);
  let isStr=sv.length===5&&(sv[4]-sv[0]===4||sv.join(",")==="0,1,2,3,12");
  const cnts=Object.values(rc).sort((a,b)=>b-a);let twins=Object.values(rsc).some(c=>c>=2);
  let hr=0,hn="High Card";
  if(maxId===5){hr=13;hn="Flush Five"}else if(cnts[0]===3&&cnts[1]===2&&isFlush){hr=12;hn="Flush House"}
  else if(cnts[0]===5){hr=11;hn="Five of a Kind"}else if(isStr&&isFlush&&sv.includes(12)&&sv.includes(11)){hr=10;hn="Royal Flush"}
  else if(isStr&&isFlush){hr=9;hn="Straight Flush"}else if(cnts[0]===4){hr=8;hn="Four of a Kind"}
  else if(cnts[0]===3&&cnts[1]===2){hr=7;hn="Full House"}else if(isFlush){hr=6;hn="Flush"}
  else if(isStr){hr=5;hn="Straight"}else if(cnts[0]===3){hr=4;hn="Three of a Kind"}
  else if(cnts[0]===2&&cnts[1]===2){const pr=Object.entries(rc).filter(([,c])=>c===2);hr=twins&&pr.length===1?2:3;hn=hr===2?"Twins":"Two Pair"}
  else if(cnts[0]===2){hr=twins?2:1;hn=hr===2?"Twins":"Pair"}
  return{handRank:hr,handName:hn,rankVals:rv,effective:eff};}
function compareHands(a,b,am=[],bm=[]){const ae=evalHand(a,am),be=evalHand(b,bm);
  if(ae.handRank!==be.handRank)return ae.handRank>be.handRank?"A":"B";
  for(let i=0;i<ae.rankVals.length;i++){if(ae.rankVals[i]>be.rankVals[i])return"A";if(ae.rankVals[i]<be.rankVals[i])return"B";}return"TIE";}
function initGame(){const all=shuf(CARDS.map(c=>c.id));
  return{aDeck:all.slice(7,26),bDeck:all.slice(33),aHand:sortC(all.slice(0,7)),bHand:sortC(all.slice(26,33)),
    aDiscard:[],bDiscard:[],aPlay:[],bPlay:[],scrap:[],aChips:0,bChips:0,round:1,firstPlayer:"A",
    phase:"action",currentPlayer:"A",regularActionsPlayed:0,actionsRequired:2,bonusActions:0,
    log:[],amends:{aFreeze:false,bFreeze:false,aNegate:false,bNegate:false},newCards:[],aMods:[],bMods:[],_aReq:2,_bReq:2};}
function cloneGs(gs){return JSON.parse(JSON.stringify(gs));}

// ============================================================
// SIMPLE UI COMPONENTS
// ============================================================
function Card({id,selected,onClick,dimmed,small,glow,isNew}){const c=CM[id];if(!c)return null;
  const w=small?68:120,h=small?95:168,ti=TI[c.type];
  return(<div onClick={onClick} style={{width:w,height:h,borderRadius:8,flexShrink:0,position:"relative",
    border:selected?`2px solid #f1c40f`:isNew?`2px solid #2ecc71`:glow?`2px solid ${glow}`:`1px solid ${ti.bd}44`,
    background:`linear-gradient(160deg,${ti.bg},#0a0d10)`,
    boxShadow:selected?"0 0 12px #f1c40f44":isNew?"0 0 14px #2ecc7155":glow?`0 0 12px ${glow}44`:"0 2px 6px #00000044",
    cursor:onClick?"pointer":"default",display:"flex",flexDirection:"column",
    padding:small?"4px 5px":"7px 9px",overflow:"hidden",opacity:dimmed?0.3:1,transition:"all 0.15s",
    transform:selected?"translateY(-4px)":isNew?"translateY(-3px)":"none"}}>
    {isNew&&<div style={{position:"absolute",top:small?2:4,right:small?3:6,fontSize:small?6:8,fontWeight:900,color:"#2ecc71",background:"#2ecc7122",borderRadius:3,padding:"0 4px"}}>NEW</div>}
    <div style={{display:"flex",alignItems:"center",gap:1}}>
      <span style={{fontSize:small?20:32,fontWeight:900,color:SC[c.suit],lineHeight:1,fontFamily:"Georgia,serif"}}>{c.rank}</span>
      <span style={{fontSize:small?14:20,color:SC[c.suit],marginTop:small?1:3}}>{SUITS[c.suit]}</span></div>
    <div style={{fontSize:small?8:14,fontWeight:700,color:"#eee",marginTop:1,fontFamily:"Georgia,serif",lineHeight:1.1}}>{c.name}</div>
    <div style={{fontSize:small?6:8,color:ti.bd,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginTop:2}}>{ti.lb}</div>
    {!small&&<div style={{fontSize:9,color:"#8899aa",marginTop:"auto",lineHeight:1.3,paddingTop:3}}>{c.text}</div>}
  </div>);}
function HandBadge({ids,mods}){if(!ids||ids.length!==5)return null;const r=evalHand(ids,mods);const c=TC[r.handRank];
  return <span style={{padding:"3px 10px",borderRadius:5,background:`${c}18`,border:`1px solid ${c}44`,color:c,fontWeight:700,fontSize:12,fontFamily:"Georgia,serif",whiteSpace:"nowrap"}}>{r.handName}</span>;}
function Btn({label,bg="#333",onClick,disabled}){return(<button onClick={onClick} disabled={disabled} style={{padding:"7px 15px",background:disabled?"#222":bg,color:bg==="#333"||disabled?"#888":"#000",border:"none",borderRadius:6,fontWeight:700,cursor:disabled?"default":"pointer",fontSize:12,opacity:disabled?0.5:1}}>{label}</button>);}

// Draggable Modal
function Modal({title,children}){const[pos,setPos]=useState({x:0,y:0});const dr=useRef(false),off=useRef({x:0,y:0});
  const onD=e=>{dr.current=true;off.current={x:e.clientX-pos.x,y:e.clientY-pos.y};
    const mv=e2=>{if(dr.current)setPos({x:e2.clientX-off.current.x,y:e2.clientY-off.current.y})};
    const up=()=>{dr.current=false;window.removeEventListener("mousemove",mv);window.removeEventListener("mouseup",up)};
    window.addEventListener("mousemove",mv);window.addEventListener("mouseup",up);};
  return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
    <div style={{background:"#111827",border:"1px solid #333",borderRadius:12,padding:20,maxWidth:620,width:"90%",maxHeight:"80vh",overflow:"auto",transform:`translate(${pos.x}px,${pos.y}px)`,position:"relative"}}>
      <div onMouseDown={onD} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,cursor:"grab",userSelect:"none",padding:"0 0 8px",borderBottom:"1px solid #222"}}>
        <div style={{fontSize:15,fontWeight:700,color:"#f1c40f",fontFamily:"Georgia,serif"}}>{title}</div>
        <span style={{fontSize:9,color:"#334"}}>drag to move</span></div>
      {children}</div></div>);}

// Multi-select modal (as proper component, not IIFE)
function MultiPickModal({title,cards,maxPick,onPick,btnLabel="Confirm"}){const[pk,setPk]=useState([]);
  return(<Modal title={title}><div style={{fontSize:11,color:"#667",marginBottom:6}}>Select up to {maxPick}</div>
    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
      {cards.map(id=>(<Card key={id} id={id} small selected={pk.includes(id)}
        onClick={()=>setPk(p=>p.includes(id)?p.filter(x=>x!==id):p.length<maxPick?[...p,id]:p)}/>))}</div>
    <Btn label={`${btnLabel} (${pk.length})`} bg={pk.length?"#f1c40f":"#333"} disabled={!pk.length} onClick={()=>pk.length&&onPick(pk)}/></Modal>);}

// Brainstorm: pick 3 in order
function BrainstormModal({hand,newCards,onPick}){const[pk,setPk]=useState([]);
  const toggle=id=>setPk(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  return(<Modal title="Brainstorm: Put 3 cards on top (tap in order, 1st = top)">
    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
      {hand.map(id=>{const idx=pk.indexOf(id);return(<div key={id} style={{position:"relative"}}>
        <Card id={id} small selected={idx>=0} isNew={(newCards||[]).includes(id)} onClick={()=>toggle(id)}/>
        {idx>=0&&<div style={{position:"absolute",top:2,left:2,background:"#f1c40f",color:"#000",borderRadius:10,width:18,height:18,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900}}>{idx+1}</div>}
      </div>);})}</div>
    {pk.length===3&&<div style={{fontSize:11,color:"#aaa",marginBottom:6}}>Top→Bottom: {pk.map(id=>CM[id].name).join(" → ")}</div>}
    <Btn label={`Put ${pk.length}/3 on top`} bg={pk.length===3?"#f1c40f":"#333"} disabled={pk.length!==3} onClick={()=>pk.length===3&&onPick(pk)}/></Modal>);}

// Rejuvenate: pick up to 3 to discard
function RejuvenateModal({hand,onPick}){const[pk,setPk]=useState([]);
  return(<Modal title="Rejuvenate: Discard up to 3, draw that many">
    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
      {hand.map(id=>(<Card key={id} id={id} small selected={pk.includes(id)}
        onClick={()=>setPk(p=>p.includes(id)?p.filter(x=>x!==id):p.length<3?[...p,id]:p)}/>))}</div>
    <Btn label={`Discard ${pk.length} → Draw ${pk.length}`} bg={pk.length?"#f1c40f":"#333"} disabled={!pk.length} onClick={()=>pk.length&&onPick(pk)}/></Modal>);}

// Deck knowledge tracker — shows cards player has seen (not in their deck)
function DeckStats({gs,player}){const[show,setShow]=useState(false);
  // "Seen" = hand + discard + play + scrap (all face-up public info + own hand)
  // Only count cards from THIS player's zones + shared scrap
  const hand=player==="A"?gs.aHand:gs.bHand;
  const disc=player==="A"?gs.aDiscard:gs.bDiscard;
  const myPlay=(player==="A"?gs.aPlay:gs.bPlay).map(a=>a.id);
  const oppPlay=(player==="A"?gs.bPlay:gs.aPlay).filter(a=>!a.faceDown).map(a=>a.id);
  const seen=[...hand,...disc,...myPlay,...oppPlay,...gs.scrap];
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
function PublicZones({gs}){const[exp,setExp]=useState(null);
  const zones=[{key:"scrap",label:"Scrap",cards:gs.scrap,color:"#9b59b6"},{key:"aDiscard",label:"A Discard",cards:gs.aDiscard,color:"#e74c3c"},{key:"bDiscard",label:"B Discard",cards:gs.bDiscard,color:"#3498db"}];
  return(<div><div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
    {zones.map(z=>(<button key={z.key} onClick={()=>setExp(exp===z.key?null:z.key)} style={{padding:"3px 8px",borderRadius:4,fontSize:10,fontWeight:700,cursor:"pointer",
      border:`1px solid ${exp===z.key?z.color:z.color+"44"}`,background:exp===z.key?z.color+"1a":"transparent",color:exp===z.key?z.color:z.color+"99"}}>{z.label} ({z.cards.length})</button>))}
    <span style={{fontSize:10,color:"#334"}}>A deck:{gs.aDeck.length} · B deck:{gs.bDeck.length}</span></div>
    {exp&&(()=>{const z=zones.find(x=>x.key===exp);if(!z||!z.cards.length)return <div style={{fontSize:10,color:"#445",marginTop:4,fontStyle:"italic"}}>Empty</div>;
      return(<div style={{marginTop:6,padding:6,background:"#0a0d1188",borderRadius:6,border:`1px solid ${z.color}22`}}>
        <div style={{display:"flex",flexWrap:"wrap",gap:4}}>{sortC(z.cards).map((id,i)=><Card key={id+i} id={id} small/>)}</div></div>);})()}</div>);}

// ============================================================
// MAIN APP
// ============================================================
export default function KaizenPoker(){
  const[gs,setGs]=useState(null);const[modal,setModal]=useState(null);const[fdMode,setFdMode]=useState(false);
  const[undoState,setUndoState]=useState(null); // snapshot before last action, for undo
  const logRef=useRef(null);

  const L=(gs,msg)=>({...gs,log:[...gs.log,msg]});
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
    return [effect.id];
  });

  const startGame=()=>{let g=initGame();g=L(g,`=== ROUND 1 === Player A acts first`);
    g=L(g,`A: ${g.aHand.map(id=>`${CM[id].rank}${SUITS[CM[id].suit]} ${CM[id].name}`).join(", ")}`);
    g=L(g,`B: ${g.bHand.map(id=>`${CM[id].rank}${SUITS[CM[id].suit]} ${CM[id].name}`).join(", ")}`);setGs(g);};

  // Actions that reveal new info (need confirmation, can't undo after)
  const REVEALS=new Set(["3C","3D","3S","4C","4D","4H","5C","8H","KC","KD","KH","AD","7H"]);

  const advance=(g)=>{let n={...g};
    if(n.bonusActions>0){n.bonusActions--;n=L(n,`${n.currentPlayer} has a bonus action!`);return n;}
    n.regularActionsPlayed++;if(n.regularActionsPlayed<n.actionsRequired)return n;
    setFdMode(false);setUndoState(null);
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
      const disc=getD(g,player);
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
    g2=L(g2,`${player} discards ${CM[cardId].name}`);setGs(g2);
    checkCap(g2,player,cardId,then);};

  const offerRefresh=(g,done)=>{const p=g.currentPlayer;if(!getH(g,p).length){done(g);return;}
    const opts=[{label:"Refresh (discard → draw)",key:"refresh"}];
    if(g.scrap.includes("QH"))opts.push({label:"Sift (draw → discard)",key:"sift"});
    if(g.scrap.includes("QS"))opts.push({label:"Declutter (scrap from discard)",key:"declutter"});
    opts.push({label:"Skip",key:"skip"});
    setModal({type:"refreshOpts",opts,onChoice:key=>{setModal(null);
      if(key==="skip"){done(g);return;}
      if(key==="refresh"){setModal({type:"pickDiscard",hand:getH(g,p),title:"Refresh: Discard (then draw)",
        onPick:id=>{setModal(null);
          discardFromHand(g,p,id,g2=>{
            g2=drawCards(g2,p,1);if(g2.drawn){g2=L(g2,`${p} draws ${CM[g2.drawn[0]].name}`);g2.newCards=g2.drawn;}
            done(g2);});}});return;}
      if(key==="sift"){let g2=drawCards(g,p,1);if(g2.drawn){g2=L(g2,`${p} draws ${CM[g2.drawn[0]].name} (Sift)`);g2.newCards=g2.drawn;}setGs(g2);
        setModal({type:"pickDiscard",hand:getH(g2,p),title:"Sift: Discard a card",newCards:g2.drawn||[],
          onPick:id=>{setModal(null);discardFromHand(g2,p,id,done);}});return;}
      if(key==="declutter"){const disc=getD(g,p);if(!disc.length){done(g);return;}
        setModal({type:"pickFromList",title:"Declutter: Scrap from discard",cards:disc,canCancel:true,
          onPick:id=>{setModal(null);let g2=cloneGs(g);g2=setZ(g2,p,"discard",[...getD(g2,p)].filter(x=>x!==id));
            g2.scrap=[...g2.scrap,id];g2=L(g2,`${p} scraps ${CM[id].name} (Declutter)`);done(g2);},
          onCancel:()=>{setModal(null);done(g);}});}}});};

  // --- UNDO ---
  const doUndo=()=>{if(undoState){setGs(undoState);setUndoState(null);setModal(null);setFdMode(false);}};

  // --- HANDLE PLAY ---
  const handlePlayCard=cid=>{if(!gs)return;if(gs.newCards.length)setGs(p=>({...p,newCards:[]}));
    const card=CM[cid],p=gs.currentPlayer;
    if(fdMode){setFdMode(false);const snap=cloneGs(gs);let g=playFD(gs,cid);
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
  const resolveAction=cid=>{const card=CM[cid],p=gs.currentPlayer;let g=cloneGs(gs);
    g=setZ(g,p,"hand",[...getH(g,p)].filter(id=>id!==cid));
    g=setZ(g,p,"play",[...getP(g,p),{id:cid,faceDown:false}]);
    if(card.type==="Modify"){g=L(g,`${p} plays ${card.name} (Modify)`);g=advance(g);setGs(g);return;}
    if(card.type==="React"){g=L(g,`${p} plays ${card.name} (React)`);g=advance(g);setGs(g);return;}
    if(card.type==="Remember"){g=L(g,`${p} plays ${card.name} (Remember)`);g=advance(g);setGs(g);return;}
    if(card.type==="Amend"){
      if(cid==="7C"){g.amends={...g.amends,[opp(p)==="A"?"aFreeze":"bFreeze"]:true};g=L(g,`${p} plays Freeze`);}
      else if(cid==="7D"){g.amends={...g.amends,[opp(p)==="A"?"aNegate":"bNegate"]:true};g=L(g,`${p} plays Negate`);}
      g=advance(g);setGs(g);return;}
    g=L(g,`${p} plays ${card.name}`);const frozen=isFroz(g,p);
    const scrapF=(g2,pl,id)=>{g2=setZ(g2,pl,"discard",[...getD(g2,pl)].filter(x=>x!==id));g2.scrap=[...g2.scrap,id];return g2;};
    const done=g2=>{setUndoState(null);g2=advance(g2);setGs(g2);};// Clear undo after info revealed
    const pick=(t,cards,filter,onP,onC)=>{setModal({type:"pickFromList",title:t,cards,filter,canCancel:!!onC,
      onPick:id=>{setModal(null);onP(id);},onCancel:onC?()=>{setModal(null);onC();}:undefined});};
    const resolveCopiedImmediate=(g2,effectId)=>{
      const effect=CM[effectId];
      if(!effect){done(L(g2,"...copied action missing. Fizzles."));return;}
      if(effect.type==="Modify"||effect.type==="React"||effect.type==="Remember"){done(g2);return;}
      if(effect.type==="Amend"){
        if(effectId==="7C"){g2.amends={...g2.amends,[opp(p)==="A"?"aFreeze":"bFreeze"]:true};g2=L(g2,`${p}: copied Freeze applies`);}
        else if(effectId==="7D"){g2.amends={...g2.amends,[opp(p)==="A"?"aNegate":"bNegate"]:true};g2=L(g2,`${p}: copied Negate applies`);}
        done(g2);return;
      }
      if(effectId==="AD"){g2=drawCards(g2,p,1);if(g2.drawn){g2=L(g2,`${p} draws ${CM[g2.drawn[0]].name}`);g2.bonusActions++;g2.newCards=g2.drawn;}done(g2);return;}
      if(effectId==="AC"){if(!g2.scrap.length){done(L(g2,"...copied Salvage fizzles (scrap empty)."));return;}
        pick("Copied Salvage: Take from scrap",g2.scrap,null,id=>{let g3=cloneGs(g2);g3.scrap=g3.scrap.filter(x=>x!==id);
          g3=setZ(g3,p,"hand",[...getH(g3,p),id]);g3.newCards=[id];g3.bonusActions++;g3=L(g3,`${p} salvages ${CM[id].name}`);done(g3);},
        ()=>done(L(g2,"...cancelled.")));return;}
      if(effectId==="AH"){const play=getP(g2,p).filter(a=>a.id!==cid);
        if(!play.length){done(L(g2,"...copied Retrieve fizzles (no actions)."));return;}
        pick("Copied Retrieve: Return any of your actions to hand",play.map(a=>a.id),null,id=>{let g3=cloneGs(g2);
          g3=setZ(g3,p,"play",[...getP(g3,p)].filter(a=>a.id!==id));g3=setZ(g3,p,"hand",[...getH(g3,p),id]);
          g3.newCards=[id];g3.bonusActions++;g3=L(g3,`${p} retrieves ${CM[id].name}`);done(g3);},
        ()=>done(L(g2,"...cancelled.")));return;}
      if(effectId==="AS"){const disc=getD(g2,p);if(!disc.length){done(L(g2,"...copied Reanimate fizzles (discard empty)."));return;}
        pick("Copied Reanimate: Return a card from your discard to hand",disc,null,id=>{let g3=cloneGs(g2);
          g3=setZ(g3,p,"discard",[...getD(g3,p)].filter(x=>x!==id));g3=setZ(g3,p,"hand",[...getH(g3,p),id]);
          g3.newCards=[id];g3.bonusActions++;g3=L(g3,`${p} reanimates ${CM[id].name}`);done(g3);},
        ()=>done(L(g2,"...cancelled.")));return;}
      done(L(g2,`(${effect.name} copy resolution not implemented)`));
    };

    // 2s
    if(card.scrapSuits){if(frozen){g=L(g,"...Frozen!");done(g);return;}
      const disc=getD(g,p),valid=disc.filter(id=>card.scrapSuits.includes(CM[id].suit));
      if(!valid.length){g=L(g,"...no valid targets. Fizzles.");done(g);return;}
      pick(`${card.name}: Scrap a ${card.scrapSuits.map(s=>SUITS[s]).join("/")}`,disc,id=>card.scrapSuits.includes(CM[id].suit),
        id=>{let g2=scrapF({...g},p,id);g2=L(g2,`${p} scraps ${CM[id].name}`);done(g2);},
        ()=>{g=L(g,"...cancelled.");done(g);});return;}
    // 3C Defer
    if(cid==="3C"){const dk=getDk(g,p);if(!dk.length){g=L(g,"...deck empty.");done(g);return;}
      setModal({type:"twoChoice",title:"Defer",card:dk[0],opt1:"Leave on Top",opt2:"Put on Bottom",
        on1:()=>{setModal(null);g=L(g,`${p} leaves ${CM[dk[0]].name} on top`);done(g);},
        on2:()=>{setModal(null);let g2={...g};let d=[...getDk(g2,p)];d.push(d.shift());g2=setZ(g2,p,"deck",d);
          g2=L(g2,`${p} puts ${CM[dk[0]].name} on bottom`);done(g2);}});return;}
    // 3D Loot
    if(cid==="3D"){g=drawCards(g,p,1);if(g.drawn){g=L(g,`${p} draws ${CM[g.drawn[0]].name}`);g.newCards=g.drawn;}setGs(g);
      setModal({type:"pickDiscard",hand:getH(g,p),title:"Loot: Discard a card",newCards:g.drawn||[],
        onPick:id=>{setModal(null);discardFromHand(g,p,id,g2=>done(g2));}});return;}
    // 3H Rummage
    if(cid==="3H"){setModal({type:"twoOptChoice",title:"Rummage: Who Refreshes?",opt1:"Yourself",opt2:"Opponent",
      on1:()=>{setModal(null);setModal({type:"pickDiscard",hand:getH(g,p),title:"Rummage: Discard (then draw)",
        onPick:id=>{setModal(null);discardFromHand(g,p,id,g2=>{
          g2=drawCards(g2,p,1);if(g2.drawn){g2=L(g2,`${p} draws ${CM[g2.drawn[0]].name}`);g2.newCards=g2.drawn;}done(g2);});}});},
      on2:()=>{setModal(null);const oh=getH(g,opp(p));
        setModal({type:"pickDiscard",hand:oh,title:`${opp(p)} must discard (then draws)`,
          onPick:id=>{setModal(null);discardFromHand(g,opp(p),id,g2=>{
            g2=drawCards(g2,opp(p),1);if(g2.drawn)g2=L(g2,`${opp(p)} draws`);done(g2);});}});}});return;}
    // 3S Consider
    if(cid==="3S"){const dk=getDk(g,p);if(!dk.length){g=L(g,"...deck empty.");done(g);return;}
      setModal({type:"twoChoice",title:"Consider",card:dk[0],opt1:"Keep on Top",opt2:"Discard It",
        on1:()=>{setModal(null);g=L(g,`${p} keeps ${CM[dk[0]].name}`);done(g);},
        on2:()=>{setModal(null);let g2={...g};let d=[...getDk(g2,p)];const c=d.shift();
          g2=setZ(g2,p,"deck",d);g2=setZ(g2,p,"discard",[...getD(g2,p),c]);g2=L(g2,`${p} discards ${CM[c].name}`);done(g2);}});return;}
    // 4C Entomb
    if(cid==="4C"){const dk=getDk(g,p);if(!dk.length){g=L(g,"...deck empty.");done(g);return;}
      pick("Entomb: Pick from deck → discard",sortC(dk),null,id=>{let g2={...g};
        g2=setZ(g2,p,"deck",shuf([...getDk(g2,p)].filter(x=>x!==id)));g2=setZ(g2,p,"discard",[...getD(g2,p),id]);
        g2=L(g2,`${p} entombs ${CM[id].name}`);done(g2);});return;}
    // 4D Gamble
    if(cid==="4D"){const dk=getDk(g,p);if(!dk.length){g=L(g,"...deck empty.");done(g);return;}
      pick("Gamble: Take from deck (random discard)",sortC(dk),null,id=>{let g2={...g};
        g2=setZ(g2,p,"deck",shuf([...getDk(g2,p)].filter(x=>x!==id)));let h=[...getH(g2,p),id];g2.newCards=[id];
        const ri=Math.floor(Math.random()*h.length);const disc=h[ri];h=h.filter((_,i)=>i!==ri);
        g2=setZ(g2,p,"hand",h);g2=setZ(g2,p,"discard",[...getD(g2,p),disc]);
        g2=L(g2,`${p} takes ${CM[id].name}, randomly discards ${CM[disc].name}`);done(g2);});return;}
    // 4H Cultivate
    if(cid==="4H"){const dk=getDk(g,p);if(!dk.length){g=L(g,"...deck empty.");done(g);return;}
      pick("Cultivate: Put on top of deck",sortC(dk),null,id=>{let g2={...g};
        let d=shuf([...getDk(g2,p)].filter(x=>x!==id));d.unshift(id);g2=setZ(g2,p,"deck",d);
        g2=L(g2,`${p} cultivates ${CM[id].name}`);done(g2);});return;}
    // 4S Unearth
    if(cid==="4S"){const disc=getD(g,p);if(!disc.length){g=L(g,"...discard empty.");done(g);return;}
      pick("Unearth: Return from discard",disc,null,id=>{let g2=cloneGs(g);
        g2=setZ(g2,p,"discard",[...getD(g2,p)].filter(x=>x!==id));let h=[...getH(g2,p),id];g2=setZ(g2,p,"hand",h);
        g2=L(g2,`${p} unearths ${CM[id].name}`);g2.newCards=[id];setGs(g2);
        setModal({type:"pickDiscard",hand:h,title:"Unearth: Discard a card",newCards:[id],
          onPick:did=>{setModal(null);discardFromHand(g2,p,did,g3=>done(g3));}});});return;}
    // 5C Mill
    if(cid==="5C"){let dk=[...getDk(g,p)],dc=[...getD(g,p)],m=[];
      for(let i=0;i<3&&dk.length;i++){const c=dk.shift();dc.push(c);m.push(c);}
      g=setZ(g,p,"deck",dk);g=setZ(g,p,"discard",dc);g=L(g,`${p} mills: ${m.map(id=>CM[id].name).join(", ")}`);done(g);return;}
    // 5H Recall
    if(cid==="5H"){const play=getP(g,p).filter(a=>!a.faceDown&&a.id!==cid);
      if(!play.length){g=L(g,"...no other actions.");done(g);return;}
      pick("Recall: Return action to hand",play.map(a=>a.id),null,id=>{let g2=cloneGs(g);
        g2=setZ(g2,p,"play",[...getP(g2,p)].filter(a=>a.id!==id));let h=[...getH(g2,p),id];g2=setZ(g2,p,"hand",h);
        g2=L(g2,`${p} recalls ${CM[id].name}`);g2.newCards=[id];setGs(g2);
        setModal({type:"pickDiscard",hand:h,title:"Recall: Discard",newCards:[id],
          onPick:did=>{setModal(null);discardFromHand(g2,p,did,g3=>done(g3));}});});return;}
    // 5S Reclaim
    if(cid==="5S"){const disc=getD(g,p);if(!disc.length){g=L(g,"...discard empty.");done(g);return;}
      pick("Reclaim: Put on top of deck",disc,null,id=>{let g2={...g};
        g2=setZ(g2,p,"discard",[...getD(g2,p)].filter(x=>x!==id));g2=setZ(g2,p,"deck",[id,...getDk(g2,p)]);
        g2=L(g2,`${p} reclaims ${CM[id].name}`);done(g2);});return;}
    // 6C Curse
    if(cid==="6C"){if(!g.scrap.length){g=L(g,"...scrap empty. Fizzles.");done(g);return;}
      pick("Curse: Move from scrap → opponent's discard",g.scrap,null,id=>{let g2={...g};
        g2.scrap=g2.scrap.filter(x=>x!==id);g2=setZ(g2,opp(p),"discard",[...getD(g2,opp(p)),id]);
        g2=L(g2,`${p} curses ${opp(p)} with ${CM[id].name}`);done(g2);},()=>{g=L(g,"...cancelled.");done(g);});return;}
    // 6D Abduct
    if(cid==="6D"){const oa=getP(g,opp(p)).filter(a=>!a.faceDown);
      if(!oa.length){g=L(g,"...no opponent actions. Fizzles.");done(g);return;}
      pick("Abduct: Steal opponent's action",oa.map(a=>a.id),null,id=>{let g2={...g};
        g2=setZ(g2,opp(p),"play",[...getP(g2,opp(p))].filter(a=>a.id!==id));
        g2=setZ(g2,p,"discard",[...getD(g2,p),id]);g2=setZ(g2,p,"play",[...getP(g2,p)].filter(a=>a.id!==cid));
        g2.scrap=[...g2.scrap,cid];g2=L(g2,`${p} abducts ${CM[id].name}!`);done(g2);},()=>{g=L(g,"...cancelled.");done(g);});return;}
    // 6H Exchange
    if(cid==="6H"){const od=getD(g,opp(p)),md=getD(g,p);
      if(!od.length||!md.length){g=L(g,"...need cards in both discards. Fizzles.");done(g);return;}
      pick("Exchange: Pick from opponent's discard",od,null,oid=>{
        pick("Exchange: Pick from YOUR discard to swap",getD(g,p),null,mid=>{let g2={...g};
          let o2=[...getD(g2,opp(p))].filter(x=>x!==oid);o2.push(mid);
          let m2=[...getD(g2,p)].filter(x=>x!==mid);m2.push(oid);
          g2=setZ(g2,opp(p),"discard",o2);g2=setZ(g2,p,"discard",m2);
          g2=L(g2,`${p} exchanges: gives ${CM[mid].name}, takes ${CM[oid].name}`);done(g2);},()=>{g=L(g,"...cancelled.");done(g);});
      },()=>{g=L(g,"...cancelled.");done(g);});return;}
    // 6S Banish
    if(cid==="6S"){const od=getD(g,opp(p));if(!od.length){g=L(g,"...opponent discard empty. Fizzles.");done(g);return;}
      pick("Banish: Move to scrap",od,null,id=>{let g2={...g};
        g2=setZ(g2,opp(p),"discard",[...getD(g2,opp(p))].filter(x=>x!==id));g2.scrap=[...g2.scrap,id];
        g2=L(g2,`${p} banishes ${CM[id].name}`);done(g2);},()=>{g=L(g,"...cancelled.");done(g);});return;}
    // 7H Abdicate
    if(cid==="7H"){const oh=getH(g,opp(p)),faces=oh.filter(id=>FACE.includes(CM[id].rank));
      if(!faces.length){g=L(g,`${opp(p)} has no face cards.`);g=drawCards(g,opp(p),1);if(g.drawn)g=L(g,`${opp(p)} draws`);done(g);return;}
      setModal({type:"pickDiscard",hand:oh,title:`${opp(p)} must discard a face card`,filter:id=>FACE.includes(CM[id].rank),
        onPick:id=>{setModal(null);let g2={...g};g2=setZ(g2,opp(p),"hand",[...getH(g2,opp(p))].filter(x=>x!==id));
          g2=setZ(g2,opp(p),"discard",[...getD(g2,opp(p)),id]);g2=L(g2,`${opp(p)} discards ${CM[id].name} (Abdicate)`);
          g2=drawCards(g2,opp(p),1);if(g2.drawn)g2=L(g2,`${opp(p)} draws`);done(g2);}});return;}
    // 7S Nullify
    if(cid==="7S"){const allM=[...getP(g,"A").filter(a=>CM[a.id].type==="Modify"&&!a.faceDown).map(a=>({...a,ow:"A"})),
      ...getP(g,"B").filter(a=>CM[a.id].type==="Modify"&&!a.faceDown).map(a=>({...a,ow:"B"}))];
      if(!allM.length){g=L(g,"...no Modifies. Fizzles.");done(g);return;}
      pick("Nullify: Remove a Modify",allM.map(m=>m.id),null,id=>{let g2={...g};const ow=allM.find(m=>m.id===id).ow;
        g2=setZ(g2,ow,"play",[...getP(g2,ow)].filter(a=>a.id!==id));g2=setZ(g2,ow,"discard",[...getD(g2,ow),id]);
        g2=L(g2,`${p} nullifies ${CM[id].name}`);done(g2);});return;}
    // 8H Reject
    if(cid==="8H"){const dk=getDk(g,p);if(!dk.length){g=L(g,"...deck empty.");done(g);return;}
      setModal({type:"twoChoice",title:"Reject",card:dk[0],opt1:"Leave It",opt2:"Scrap It",
        on1:()=>{setModal(null);g=L(g,`${p} keeps ${CM[dk[0]].name}`);done(g);},
        on2:()=>{setModal(null);if(frozen){g=L(g,"...Frozen!");done(g);return;}
          let g2={...g};let d=[...getDk(g2,p)];d.shift();g2=setZ(g2,p,"deck",d);g2.scrap=[...g2.scrap,dk[0]];
          g2=L(g2,`${p} rejects ${CM[dk[0]].name}`);done(g2);}});return;}
    // 9C Terminate
    if(cid==="9C"){if(frozen){g=L(g,"...Frozen!");done(g);return;}const disc=getD(g,p);
      const valid=disc.filter(id=>!FACE.includes(CM[id].rank));if(!valid.length){g=L(g,"...no non-face cards. Fizzles.");done(g);return;}
      pick("Terminate: Scrap a non-face card",disc,id=>!FACE.includes(CM[id].rank),
        id=>{done(L(scrapF({...g},p,id),`${p} scraps ${CM[id].name}`));},()=>{done(L(g,"...cancelled."));});return;}
    // 9D Impeach
    if(cid==="9D"){if(frozen){g=L(g,"...Frozen!");done(g);return;}const disc=getD(g,p);
      const valid=disc.filter(id=>FACE.includes(CM[id].rank));if(!valid.length){g=L(g,"...no face cards. Fizzles.");done(g);return;}
      pick("Impeach: Scrap a face card",disc,id=>FACE.includes(CM[id].rank),
        id=>{done(L(scrapF({...g},p,id),`${p} scraps ${CM[id].name}`));},()=>{done(L(g,"...cancelled."));});return;}
    // 9H Accumulate
    if(cid==="9H"){if(frozen){g=L(g,"...Frozen!");done(g);return;}const disc=getD(g,p);
      const ss=new Set(g.scrap.map(id=>CM[id].suit)),sr=new Set(g.scrap.map(id=>CM[id].rank));
      const valid=disc.filter(id=>ss.has(CM[id].suit)||sr.has(CM[id].rank));
      if(!valid.length){g=L(g,"...no matching cards. Fizzles.");done(g);return;}
      pick("Accumulate: Scrap matching scrapped card",disc,id=>ss.has(CM[id].suit)||sr.has(CM[id].rank),
        id=>{done(L(scrapF({...g},p,id),`${p} accumulates ${CM[id].name}`));},()=>{done(L(g,"...cancelled."));});return;}
    // JD Duplicate — immediately copies another of your Actions in play
    if(cid==="JD"){const myActions=getP(g,p).filter(a=>a.id!==cid&&!a.faceDown);
      if(!myActions.length){g=L(g,"...no other actions to copy. Fizzles.");done(g);return;}
      pick("Duplicate: Pick one of YOUR actions to copy",myActions.map(a=>a.id),null,id=>{
        let g2=cloneGs(g);// Mark Duplicate as copying that action
        const pl=getP(g2,p).map(a=>a.id===cid?{...a,copiedFrom:id,resolvedImmediate:CM[id]?.type==="Enact"||CM[id]?.type==="Amend"}:a);
        g2=setZ(g2,p,"play",pl);g2=L(g2,`${p} duplicates ${CM[id].name}`);
        if(["Enact","Amend"].includes(CM[id]?.type))resolveCopiedImmediate(g2,id);else done(g2);},
      ()=>{g=L(g,"...cancelled. Fizzles.");done(g);});return;}
    // JH Reflect — copies an opponent's Action in play
    if(cid==="JH"){const oppActions=getP(g,opp(p)).filter(a=>!a.faceDown);
      if(!oppActions.length){g=L(g,"...no opponent actions to copy. Fizzles.");done(g);return;}
      pick("Reflect: Pick an OPPONENT'S action to copy",oppActions.map(a=>a.id),null,id=>{
        let g2=cloneGs(g);const pl=getP(g2,p).map(a=>a.id===cid?{...a,copiedFrom:id,resolvedImmediate:CM[id]?.type==="Enact"||CM[id]?.type==="Amend"}:a);
        g2=setZ(g2,p,"play",pl);g2=L(g2,`${p} reflects ${CM[id].name}`);
        if(["Enact","Amend"].includes(CM[id]?.type))resolveCopiedImmediate(g2,id);else done(g2);},
      ()=>{g=L(g,"...cancelled. Fizzles.");done(g);});return;}
    // AD Explore
    if(cid==="AD"){g=drawCards(g,p,1);if(g.drawn){g=L(g,`${p} draws ${CM[g.drawn[0]].name}`);g.bonusActions++;g.newCards=g.drawn;}done(g);return;}
    // AC Salvage
    if(cid==="AC"){if(!g.scrap.length){g=L(g,"...scrap empty.");done(g);return;}
      pick("Salvage: Take from scrap",g.scrap,null,id=>{let g2=cloneGs(g);g2.scrap=g2.scrap.filter(x=>x!==id);
        g2=setZ(g2,p,"hand",[...getH(g2,p),id]);g2.newCards=[id];g2=L(g2,`${p} salvages ${CM[id].name}`);g2.bonusActions++;done(g2);},
      ()=>{g=L(g,"...cancelled.");done(g);});return;}
    // AH Retrieve — can retrieve ANY action in play (including face-down)
    if(cid==="AH"){const play=getP(g,p).filter(a=>a.id!==cid);
      if(!play.length){g=L(g,"...no actions to retrieve.");done(g);return;}
      pick("Retrieve: Return any of your actions to hand",play.map(a=>a.id),null,id=>{let g2=cloneGs(g);
        g2=setZ(g2,p,"play",[...getP(g2,p)].filter(a=>a.id!==id));g2=setZ(g2,p,"hand",[...getH(g2,p),id]);
        g2.newCards=[id];g2=L(g2,`${p} retrieves ${CM[id].name}`);g2.bonusActions++;done(g2);},
      ()=>{g=L(g,"...cancelled.");done(g);});return;}
    // AS Reanimate — return card from discard to hand
    if(cid==="AS"){const disc=getD(g,p);if(!disc.length){g=L(g,"...discard empty.");done(g);return;}
      pick("Reanimate: Return a card from your discard to hand",disc,null,id=>{let g2=cloneGs(g);
        g2=setZ(g2,p,"discard",[...getD(g2,p)].filter(x=>x!==id));g2=setZ(g2,p,"hand",[...getH(g2,p),id]);
        g2.newCards=[id];g2=L(g2,`${p} reanimates ${CM[id].name}`);g2.bonusActions++;done(g2);},
      ()=>{g=L(g,"...cancelled.");done(g);});return;}
    // KC Brainstorm
    if(cid==="KC"){g=drawCards(g,p,3);const dr=g.drawn||[];g=L(g,`${p} draws: ${dr.map(id=>CM[id].name).join(", ")}`);g.newCards=dr;setGs(g);
      setModal({type:"brainstorm",hand:getH(g,p),newCards:dr,onPick:ids=>{setModal(null);let g2={...g};
        g2=setZ(g2,p,"hand",[...getH(g2,p)].filter(x=>!ids.includes(x)));g2=setZ(g2,p,"deck",[...ids,...getDk(g2,p)]);
        g2=L(g2,`${p} puts back: ${ids.map(id=>CM[id].name).join(" → ")}`);g2.newCards=[];done(g2);}});return;}
    // KD Improvise
    if(cid==="KD"){let dk=[...getDk(g,p)],dc=[...getD(g,p)],m=[];
      for(let i=0;i<3&&dk.length;i++){const c=dk.shift();dc.push(c);m.push(c);}
      g=setZ(g,p,"deck",dk);g=setZ(g,p,"discard",dc);g=L(g,`${p} mills: ${m.map(id=>CM[id].name).join(", ")}`);setGs(g);
      pick("Improvise: Take from discard",[...getD(g,p)],null,id=>{let g2=cloneGs(g);
        g2=setZ(g2,p,"discard",[...getD(g2,p)].filter(x=>x!==id));let h=[...getH(g2,p),id];g2=setZ(g2,p,"hand",h);
        g2=L(g2,`${p} takes ${CM[id].name}`);g2.newCards=[id];setGs(g2);
        setModal({type:"pickDiscard",hand:h,title:"Improvise: Discard",newCards:[id],
          onPick:did=>{setModal(null);discardFromHand(g2,p,did,g3=>done(g3));}});});return;}
    // KH Rejuvenate
    if(cid==="KH"){setModal({type:"rejuvenate",hand:getH(g,p),onPick:ids=>{setModal(null);let g2=cloneGs(g);
      g2=setZ(g2,p,"hand",[...getH(g2,p)].filter(x=>!ids.includes(x)));g2=setZ(g2,p,"discard",[...getD(g2,p),...ids]);
      g2=L(g2,`${p} discards: ${ids.map(id=>CM[id].name).join(", ")}`);
      // Check Capitalize for each discarded card (only 8S matters)
      const capCheck=(g3,ci)=>{if(ci>=ids.length){
        g3=drawCards(g3,p,ids.length);const dr=g3.drawn||[];
        g3=L(g3,`${p} draws: ${dr.map(id=>CM[id].name).join(", ")}`);g3.newCards=dr;done(g3);return;}
        checkCap(g3,p,ids[ci],g4=>capCheck(g4,ci+1));};
      capCheck(g2,0);}});return;}
    // KS Bury
    if(cid==="KS"){if(frozen){g=L(g,"...Frozen!");done(g);return;}const disc=getD(g,p);
      if(!disc.length){g=L(g,"...nothing to scrap.");done(g);return;}
      setModal({type:"pickMulti",cards:disc,maxPick:3,title:"Bury: Scrap up to 3",onPick:ids=>{setModal(null);let g2={...g};
        g2=setZ(g2,p,"discard",[...getD(g2,p)].filter(x=>!ids.includes(x)));g2.scrap=[...g2.scrap,...ids];
        g2=L(g2,`${p} buries: ${ids.map(id=>CM[id].name).join(", ")}`);done(g2);}});return;}
    g=L(g,`(${card.name} not implemented)`);done(g);};

  // ============================================================
  // SCORING WITH MODIFY RESOLUTION
  // ============================================================
  const doScore=()=>{if(!gs)return;let g=cloneGs(gs);
    const aM=getModifyEntries(g,"A");
    const bM=getModifyEntries(g,"B");
    g.aMods=g.aMods||[];g.bMods=g.bMods||[];g=L(g,"Resolving modifications...");setGs(g);
    resolveMods(g,"A",aM,0);};

  const resolveMods=(g,pl,mods,i)=>{
    if(i>=mods.length){resolveQ2s(g,pl,g2=>{
      if(pl==="A"){const bM=getModifyEntries(g2,"B");resolveMods(g2,"B",bM,0);}
      else finalScore(g2);});return;}
    const mid=mods[i],mc=CM[mid],hand=getH(g,pl),mk=pl==="A"?"aMods":"bMods";
    const next=(g2)=>resolveMods(g2||g,pl,mods,i+1);
    const skip=()=>{let g2=L(g,`${pl}: ${mc.name} — skipped`);setGs(g2);next(g2);};
    // Forecast/Vanish: defer
    if(mid==="5D"||mid==="8D"){let g2=L(g,`${pl}: ${mc.name} — after scoring`);setGs(g2);next(g2);return;}
    // Buff
    if(mid==="10H"){setModal({type:"pickFromList",title:`${pl}: Buff — pick scoring card to increase rank`,cards:hand,showHand:hand,canCancel:true,
      onPick:tid=>{setModal(null);const ci=RV[CM[tid].rank];const hr=RO.filter((_,i)=>i>ci);
        setModal({type:"pickRank",title:`Buff ${CM[tid].name}: New rank`,ranks:hr,showHand:hand,
          onPick:r=>{setModal(null);let g2=cloneGs(g);g2[mk]=[...g2[mk],{target:tid,rank:r,suit:null}];g2=L(g2,`${pl}: Buff ${CM[tid].name} → ${r}`);setGs(g2);next(g2);}});},
      onCancel:()=>{setModal(null);skip();}});return;}
    // Nerf
    if(mid==="10S"){setModal({type:"pickFromList",title:`${pl}: Nerf — pick scoring card to decrease rank`,cards:hand,showHand:hand,canCancel:true,
      onPick:tid=>{setModal(null);const ci=RV[CM[tid].rank];const lr=RO.filter((_,i)=>i<ci);
        setModal({type:"pickRank",title:`Nerf ${CM[tid].name}: New rank`,ranks:lr,showHand:hand,
          onPick:r=>{setModal(null);let g2=cloneGs(g);g2[mk]=[...g2[mk],{target:tid,rank:r,suit:null}];g2=L(g2,`${pl}: Nerf ${CM[tid].name} → ${r}`);setGs(g2);next(g2);}});},
      onCancel:()=>{setModal(null);skip();}});return;}
    // Nudge
    if(mid==="10C"){setModal({type:"pickFromList",title:`${pl}: Nudge — pick scoring card (±1 rank)`,cards:hand,showHand:hand,canCancel:true,
      onPick:tid=>{setModal(null);const ci=RV[CM[tid].rank];const opts=[];if(ci>0)opts.push(RO[ci-1]);if(ci<12)opts.push(RO[ci+1]);
        setModal({type:"pickRank",title:`Nudge ${CM[tid].name}: ±1`,ranks:opts,showHand:hand,
          onPick:r=>{setModal(null);let g2=cloneGs(g);g2[mk]=[...g2[mk],{target:tid,rank:r,suit:null}];g2=L(g2,`${pl}: Nudge ${CM[tid].name} → ${r}`);setGs(g2);next(g2);}});},
      onCancel:()=>{setModal(null);skip();}});return;}
    // Disguise
    if(mid==="10D"){setModal({type:"pickFromList",title:`${pl}: Disguise — pick scoring card to change suit`,cards:hand,showHand:hand,canCancel:true,
      onPick:tid=>{setModal(null);
        setModal({type:"pickSuit",title:`Disguise ${CM[tid].name}: New suit`,showHand:hand,
          onPick:s=>{setModal(null);let g2=cloneGs(g);g2[mk]=[...g2[mk],{target:tid,rank:null,suit:s}];g2=L(g2,`${pl}: Disguise ${CM[tid].name} → ${SUITS[s]}`);setGs(g2);next(g2);}});},
      onCancel:()=>{setModal(null);skip();}});return;}
    // Clone — one SCORING card becomes copy of another SCORING card
    if(mid==="JC"){
      setModal({type:"pickFromList",title:`${pl}: Clone — pick a scoring card to OVERWRITE`,cards:hand,showHand:hand,canCancel:true,
        onPick:tid=>{setModal(null);const others=hand.filter(x=>x!==tid);
          setModal({type:"pickFromList",title:`Clone: Pick scoring card to COPY onto ${CM[tid].name}`,cards:others,showHand:hand,canCancel:false,
            onPick:sid=>{setModal(null);let g2=cloneGs(g);g2[mk]=[...g2[mk],{target:tid,rank:CM[sid].rank,suit:CM[sid].suit}];
              g2=L(g2,`${pl}: Clone ${CM[tid].name} → copy of ${CM[sid].name}`);setGs(g2);next(g2);}});},
        onCancel:()=>{setModal(null);skip();}});return;}
    // Reminisce — one SCORING card becomes copy of a DISCARD card
    if(mid==="JS"){const disc=getD(g,pl);if(!disc.length){let g2=L(g,`${pl}: Reminisce — discard empty`);setGs(g2);next(g2);return;}
      setModal({type:"pickFromList",title:`${pl}: Reminisce — pick scoring card to OVERWRITE`,cards:hand,showHand:hand,canCancel:true,
        onPick:tid=>{setModal(null);
          setModal({type:"pickFromList",title:`Reminisce: Pick from DISCARD to copy onto ${CM[tid].name}`,cards:disc,showHand:hand,canCancel:false,
            onPick:sid=>{setModal(null);let g2=cloneGs(g);g2[mk]=[...g2[mk],{target:tid,rank:CM[sid].rank,suit:CM[sid].suit}];
              g2=L(g2,`${pl}: Reminisce ${CM[tid].name} → copy of ${CM[sid].name}`);setGs(g2);next(g2);}});},
        onCancel:()=>{setModal(null);skip();}});return;}
    let g2=L(g,`${pl}: ${mc.name} — not implemented`);setGs(g2);next(g2);};

  // Queen Remember on 2s
  const resolveQ2s=(g,pl,done)=>{
    const mk=pl==="A"?"aMods":"bMods";const modded=new Set((g[mk]||[]).map(m=>m.target));
    const hand=getH(g,pl);
    const twos=hand.filter(id=>CM[id].rank==="2"&&!modded.has(id));
    const misc=g.scrap.includes("QC"),camo=g.scrap.includes("QD");
    if(!twos.length||(!misc&&!camo)){done(g);return;}
    const proc=(g2,ti)=>{if(ti>=twos.length){done(g2);return;}const tid=twos[ti];
      setModal({type:"queen2",pl,cardId:tid,misc,camo,showHand:hand,
        onRank:()=>{setModal(null);
          setModal({type:"pickRank",title:`Miscalculate: ${CM[tid].name} → any rank`,ranks:RO,showHand:hand,
            onPick:r=>{setModal(null);
              if(camo){setModal({type:"twoOptChoice",title:`Also change suit of ${CM[tid].name}? (rank → ${r})`,opt1:"Yes",opt2:"No",
                on1:()=>{setModal(null);setModal({type:"pickSuit",title:"Pick suit",showHand:hand,
                  onPick:s=>{setModal(null);let g3=cloneGs(g2);g3[mk]=[...g3[mk],{target:tid,rank:r,suit:s}];g3=L(g3,`${pl}: ${CM[tid].name} → ${r}${SUITS[s]}`);setGs(g3);proc(g3,ti+1);}});},
                on2:()=>{setModal(null);let g3=cloneGs(g2);g3[mk]=[...g3[mk],{target:tid,rank:r,suit:null}];g3=L(g3,`${pl}: ${CM[tid].name} → ${r}`);setGs(g3);proc(g3,ti+1);}});}
              else{let g3=cloneGs(g2);g3[mk]=[...g3[mk],{target:tid,rank:r,suit:null}];g3=L(g3,`${pl}: ${CM[tid].name} → ${r}`);setGs(g3);proc(g3,ti+1);}}});},
        onSuit:()=>{setModal(null);
          setModal({type:"pickSuit",title:`Camouflage: ${CM[tid].name} → any suit`,showHand:hand,
            onPick:s=>{setModal(null);let g3=cloneGs(g2);g3[mk]=[...g3[mk],{target:tid,rank:null,suit:s}];g3=L(g3,`${pl}: ${CM[tid].name} → ${SUITS[s]}`);setGs(g3);proc(g3,ti+1);}});},
        onBoth:()=>{setModal(null);
          setModal({type:"pickRank",title:`${CM[tid].name}: Pick rank`,ranks:RO,showHand:hand,
            onPick:r=>{setModal(null);setModal({type:"pickSuit",title:`${CM[tid].name}: Pick suit`,showHand:hand,
              onPick:s=>{setModal(null);let g3=cloneGs(g2);g3[mk]=[...g3[mk],{target:tid,rank:r,suit:s}];g3=L(g3,`${pl}: ${CM[tid].name} → ${r}${SUITS[s]}`);setGs(g3);proc(g3,ti+1);}});}});},
        onSkip:()=>{setModal(null);proc(g2,ti+1);}});};
    proc(g,0);};

  // Finalize scoring — show reveal
  const finalScore=(g)=>{const aH=getH(g,"A"),bH=getH(g,"B");
    const aE=evalHand(aH,g.aMods||[]),bE=evalHand(bH,g.bMods||[]);
    const winner=compareHands(aH,bH,g.aMods||[],g.bMods||[]);
    g=L(g,`A: ${aE.handName}`);g=L(g,`B: ${bE.handName}`);
    if(winner==="A"){g.aChips++;g=L(g,`Player A wins the chip! (${g.aChips}-${g.bChips})`);}
    else if(winner==="B"){g.bChips++;g=L(g,`Player B wins the chip! (${g.aChips}-${g.bChips})`);}
    else g=L(g,"Tie — no chip awarded.");
    g.phase="reveal";g._revealWinner=winner;g._revealAE=aE;g._revealBE=bE;setGs(g);};

  // After reveal, process post-score effects and advance
  const advanceFromReveal=()=>{if(!gs)return;let g={...gs};const winner=g._revealWinner;
    // Post-score effects
    const effs=[];
    for(const pl of["A","B"]){for(const a of getP(g,pl)){
      const effect=getActionCard(a);
      if(a.faceDown||!effect)continue;
      if(effect.id==="5D")effs.push({t:"forecast",pl});
      if(effect.id==="8D")effs.push({t:"vanish",pl});
      if(effect.id==="8C"&&((pl==="A"&&winner==="B")||(pl==="B"&&winner==="A")))effs.push({t:"capitulate",pl});}}
    procPost(g,effs,0);};

  const procRoundEndReaps=(g,reaps,i,done)=>{
    if(i>=reaps.length){done(g);return;}
    const pl=reaps[i];
    if(isFroz(g,pl)){procRoundEndReaps(L(g,`${pl}: Reap - Frozen!`),reaps,i+1,done);return;}
    const disc=getD(g,pl);
    const valid=disc.filter((id,idx)=>disc.some((other,j)=>j!==idx&&(CM[other].rank===CM[id].rank||CM[other].suit===CM[id].suit)));
    if(!valid.length){procRoundEndReaps(L(g,`${pl}: Reap - no matching discard card`),reaps,i+1,done);return;}
    setModal({type:"pickFromList",title:`${pl}: Reap - scrap a matching discard card?`,cards:disc,filter:id=>valid.includes(id),canCancel:true,
      onPick:id=>{setModal(null);let g2=cloneGs(g);g2=setZ(g2,pl,"discard",[...getD(g2,pl)].filter(x=>x!==id));g2.scrap=[...g2.scrap,id];
        g2=L(g2,`${pl}: Reap scraps ${CM[id].name}`);setGs(g2);procRoundEndReaps(g2,reaps,i+1,done);},
      onCancel:()=>{setModal(null);procRoundEndReaps(g,reaps,i+1,done);}});
  };

  const startNextRound=(g)=>{
    if(g.aChips>=7||g.bChips>=7){g.phase="gameOver";g=L(g,`🏆 Player ${g.aChips>=7?"A":"B"} wins the game!`);setGs(g);return;}
    g.aHand=[];g.bHand=[];g.aPlay=[];g.bPlay=[];g.newCards=[];g.aMods=[];g.bMods=[];
    g.amends={aFreeze:false,bFreeze:false,aNegate:false,bNegate:false};
    g.round++;g.firstPlayer=g.firstPlayer==="A"?"B":"A";g.currentPlayer=g.firstPlayer;g.regularActionsPlayed=0;g.bonusActions=0;
    g=L(g,`=== ROUND ${g.round} === Player ${g.firstPlayer} acts first`);
    let aR=2,bR=2,aD=7,bD=7;const aCW=g.aChips===6,bCW=g.bChips===6;
    if(aCW&&!bCW){bD=8;bR=3;}if(bCW&&!aCW){aD=8;aR=3;}if(aCW||bCW)g=L(g,"⚡ SUDDEN DEATH!");
    g._aReq=aR;g._bReq=bR;g.actionsRequired=g.currentPlayer==="A"?aR:bR;
    g=drawCards(g,"A",aD);if(g.error){g.phase="gameOver";g=L(g,"A can't draw!");setGs(g);return;}g.aHand=sortC(g.aHand);
    g=drawCards(g,"B",bD);if(g.error){g.phase="gameOver";g=L(g,"B can't draw!");setGs(g);return;}g.bHand=sortC(g.bHand);
    g.phase="action";g=L(g,`A: ${g.aHand.map(id=>`${CM[id].rank}${SUITS[CM[id].suit]}`).join(", ")}`);
    g=L(g,`B: ${g.bHand.map(id=>`${CM[id].rank}${SUITS[CM[id].suit]}`).join(", ")}`);setGs(g);
  };

  const procPost=(g,effs,i)=>{if(i>=effs.length){
    if(g.aChips>=7||g.bChips>=7){g.phase="gameOver";g=L(g,`🏆 Player ${g.aChips>=7?"A":"B"} wins the game!`);setGs(g);return;}
    const aH=getH(g,"A"),bH=getH(g,"B");
    const aReaps=[...aH.filter(id=>id==="9S"),...getP(g,"A").filter(a=>!a.faceDown&&getActionCard(a)?.id==="9S").map(a=>a.id)];
    const bReaps=[...bH.filter(id=>id==="9S"),...getP(g,"B").filter(a=>!a.faceDown&&getActionCard(a)?.id==="9S").map(a=>a.id)];
    g.aDiscard=[...g.aDiscard,...g.aPlay.map(a=>a.id),...aH];g.bDiscard=[...g.bDiscard,...g.bPlay.map(a=>a.id),...bH];
    const reapQueue=[...aReaps.map(()=>"A"),...bReaps.map(()=>"B")];
    setGs(g);procRoundEndReaps(g,reapQueue,0,startNextRound);return;
    g.aDiscard=[...g.aDiscard,...g.aPlay.map(a=>a.id),...aH];g.bDiscard=[...g.bDiscard,...g.bPlay.map(a=>a.id),...bH];
    g.aHand=[];g.bHand=[];g.aPlay=[];g.bPlay=[];g.newCards=[];g.aMods=[];g.bMods=[];
    g.amends={aFreeze:false,bFreeze:false,aNegate:false,bNegate:false};
    g.round++;g.firstPlayer=g.firstPlayer==="A"?"B":"A";g.currentPlayer=g.firstPlayer;g.regularActionsPlayed=0;g.bonusActions=0;
    g=L(g,`=== ROUND ${g.round} === Player ${g.firstPlayer} acts first`);
    let aR=2,bR=2,aD=7,bD=7;const aCW=g.aChips===6,bCW=g.bChips===6;
    if(aCW&&!bCW){bD=8;bR=3;}if(bCW&&!aCW){aD=8;aR=3;}if(aCW||bCW)g=L(g,"⚡ SUDDEN DEATH!");
    g._aReq=aR;g._bReq=bR;g.actionsRequired=g.currentPlayer==="A"?aR:bR;
    g=drawCards(g,"A",aD);if(g.error){g.phase="gameOver";g=L(g,"A can't draw!");setGs(g);return;}g.aHand=sortC(g.aHand);
    g=drawCards(g,"B",bD);if(g.error){g.phase="gameOver";g=L(g,"B can't draw!");setGs(g);return;}g.bHand=sortC(g.bHand);
    g.phase="action";g=L(g,`A: ${g.aHand.map(id=>`${CM[id].rank}${SUITS[CM[id].suit]}`).join(", ")}`);
    g=L(g,`B: ${g.bHand.map(id=>`${CM[id].rank}${SUITS[CM[id].suit]}`).join(", ")}`);setGs(g);return;}
    const e=effs[i];
    if(e.t==="forecast"){setModal({type:"pickFromList",title:`${e.pl}: Forecast — save to top of deck`,cards:getH(g,e.pl),canCancel:true,
      onPick:id=>{setModal(null);let g2={...g};g2=setZ(g2,e.pl,"hand",[...getH(g2,e.pl)].filter(x=>x!==id));
        g2=setZ(g2,e.pl,"deck",[id,...getDk(g2,e.pl)]);g2=L(g2,`${e.pl}: Forecast saves ${CM[id].name}`);setGs(g2);procPost(g2,effs,i+1);},
      onCancel:()=>{setModal(null);procPost(g,effs,i+1);}});return;}
    if(e.t==="vanish"){if(isFroz(g,e.pl)){g=L(g,`${e.pl}: Vanish — Frozen!`);procPost(g,effs,i+1);return;}
      const mk=e.pl==="A"?"aMods":"bMods";const effS=new Set(getH(g,e.pl).map(id=>{const m=g[mk].find(x=>x.target===id);return m?.suit||CM[id].suit;}));
      const disc=getD(g,e.pl);const valid=disc.filter(id=>effS.has(CM[id].suit));
      if(!valid.length){procPost(g,effs,i+1);return;}
      setModal({type:"pickFromList",title:`${e.pl}: Vanish — scrap matching suit`,cards:disc,filter:id=>effS.has(CM[id].suit),canCancel:true,
        onPick:id=>{setModal(null);let g2={...g};g2=setZ(g2,e.pl,"discard",[...getD(g2,e.pl)].filter(x=>x!==id));g2.scrap=[...g2.scrap,id];
          g2=L(g2,`${e.pl}: Vanish scraps ${CM[id].name}`);setGs(g2);procPost(g2,effs,i+1);},
        onCancel:()=>{setModal(null);procPost(g,effs,i+1);}});return;}
    if(e.t==="capitulate"){if(isFroz(g,e.pl)){procPost(g,effs,i+1);return;}
      const disc=getD(g,e.pl);if(!disc.length){procPost(g,effs,i+1);return;}
      setModal({type:"pickFromList",title:`${e.pl}: Capitulate — you lost! Scrap a card?`,cards:disc,canCancel:true,
        onPick:id=>{setModal(null);let g2={...g};g2=setZ(g2,e.pl,"discard",[...getD(g2,e.pl)].filter(x=>x!==id));g2.scrap=[...g2.scrap,id];
          g2=L(g2,`${e.pl}: Capitulate scraps ${CM[id].name}`);setGs(g2);procPost(g2,effs,i+1);},
        onCancel:()=>{setModal(null);procPost(g,effs,i+1);}});return;}
    procPost(g,effs,i+1);};

  // ============================================================
  // RENDER
  // ============================================================
  if(!gs)return(<div style={{minHeight:"100vh",background:"radial-gradient(ellipse at 50% 0%,#0f1923,#070b10 70%)",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:20}}>
    <h1 style={{fontSize:32,fontWeight:900,fontFamily:"Georgia,serif",background:"linear-gradient(135deg,#f1c40f,#e67e22)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",letterSpacing:4}}>KAIZEN POKER</h1>
    <p style={{color:"#556",fontSize:13,maxWidth:400,textAlign:"center",lineHeight:1.5}}>A two-player deckbuilding poker game. Draw 7, play 2 as actions, score the best 5-card hand.</p>
    <Btn label="START GAME" bg="linear-gradient(135deg,#f1c40f,#e67e22)" onClick={startGame}/></div>);

  const p=gs.currentPlayer,hand=getH(gs,p),oppHand=getH(gs,opp(p));
  const actionsLeft=gs.actionsRequired-gs.regularActionsPlayed+gs.bonusActions;
  const canAct=gs.phase==="action"&&actionsLeft>0;

  const isSuddenDeath=gs.aChips===6||gs.bChips===6;
  const sdPlayer=gs.aChips===6?"A":gs.bChips===6?"B":null;// who could win

  const pClr=p==="A"?"#e74c3c":"#3498db";

  return(<div style={{minHeight:"100vh",background:"radial-gradient(ellipse at 50% 0%,#0f1923,#070b10 70%)",color:"#e2e8f0",fontFamily:"'Courier New',monospace",display:"flex",flexDirection:"column"}}>
    <div style={{padding:"8px 16px",borderBottom:isSuddenDeath?"2px solid #e74c3c":"1px solid #151c25",display:"flex",alignItems:"center",gap:12,background:isSuddenDeath?"#e74c3c15":"#0008",fontSize:12}}>
      <span style={{fontFamily:"Georgia,serif",fontWeight:900,color:"#f1c40f",letterSpacing:2}}>KAIZEN POKER</span>
      <span style={{color:"#445"}}>Round {gs.round}</span>
      {isSuddenDeath&&<span style={{color:"#e74c3c",fontWeight:700,fontSize:10,animation:"pulse 1.5s infinite",letterSpacing:1}}>⚡ SUDDEN DEATH</span>}
      <div style={{marginLeft:"auto",display:"flex",gap:16}}>
        <span style={{color:"#e74c3c",fontWeight:700,background:sdPlayer==="A"?"#e74c3c22":"transparent",padding:"0 6px",borderRadius:4}}>A: {gs.aChips}</span>
        <span style={{color:"#3498db",fontWeight:700,background:sdPlayer==="B"?"#e74c3c22":"transparent",padding:"0 6px",borderRadius:4}}>B: {gs.bChips}</span></div></div>
    <div style={{display:"flex",flex:1,overflow:"hidden",height:0}}>
      <div style={{flex:1,padding:16,display:"flex",flexDirection:"column",gap:10,overflow:"auto"}}>
        {/* Remember */}
        {(()=>{const aq=gs.scrap.filter(id=>CM[id].type==="Remember");if(!aq.length)return null;
          return(<div style={{background:"#6c5ce711",border:"1px solid #6c5ce733",borderRadius:6,padding:"5px 10px",display:"flex",flexWrap:"wrap",gap:8,alignItems:"center"}}>
            <span style={{fontSize:8,fontWeight:700,color:"#6c5ce7",letterSpacing:1,textTransform:"uppercase"}}>Active</span>
            {aq.map(id=>(<span key={id} style={{fontSize:10,color:"#b8b0f0"}}><strong style={{color:"#6c5ce7"}}>{CM[id].name}</strong>{" — "}{CM[id].text.replace("As long as this card is scrapped, ","")}</span>))}</div>)})()}
        {/* Opp hand */}
        <div><div style={{fontSize:10,color:"#445",fontWeight:700,letterSpacing:1,marginBottom:3}}>PLAYER {opp(p)} — {oppHand.length} cards</div>
          <div style={{display:"flex",gap:3}}>{oppHand.map((_,i)=>(<div key={i} style={{width:36,height:50,borderRadius:4,background:"repeating-linear-gradient(45deg,#1a1a2e,#1a1a2e 3px,#16213e 3px,#16213e 6px)",border:"1px solid #222"}}/>))}</div></div>
        {/* Play areas */}
        <div style={{display:"flex",gap:16}}>{[opp(p),p].map(pl=>(<div key={pl} style={{flex:1}}>
          <div style={{fontSize:9,color:"#445",fontWeight:700,letterSpacing:1,marginBottom:3}}>{pl}'s ACTIONS</div>
          <div style={{display:"flex",gap:4,minHeight:95,flexWrap:"wrap"}}>
            {getP(gs,pl).map((a,i)=>a.faceDown?<div key={i} style={{width:68,height:95,borderRadius:6,background:"#1a1a2e",border:"1px solid #333",display:"flex",alignItems:"center",justifyContent:"center",color:"#334",fontSize:10}}>Face down</div>
              :<Card key={i} id={a.id} small/>)}</div></div>))}</div>
        <PublicZones gs={gs}/>
        <div style={{display:"flex",gap:6}}><DeckStats gs={gs} player="A"/><DeckStats gs={gs} player="B"/></div>
        {/* Hand */}
        <div>
          <div style={{fontSize:11,color:p==="A"?"#e74c3c":"#3498db",fontWeight:700,letterSpacing:1,marginBottom:5,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            YOUR HAND (Player {p})
            {canAct&&<span style={{color:pClr,fontSize:10}}>— {actionsLeft} action{actionsLeft!==1?"s":""} left</span>}
            {canAct&&!fdMode&&<Btn label="Play Face-Down ▼" bg="#555" onClick={()=>setFdMode(true)}/>}
            {canAct&&fdMode&&<><span style={{color:"#aaa",fontSize:10}}>← pick a card</span><Btn label="Cancel" bg="#333" onClick={()=>setFdMode(false)}/></>}
            {canAct&&undoState&&<Btn label="↩ Undo" bg="#e67e22" onClick={doUndo}/>}
            {gs.phase==="score"&&<HandBadge ids={hand}/>}</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {sortC(hand).map(id=>(<Card key={id} id={id} onClick={canAct?()=>handlePlayCard(id):undefined}
              glow={canAct?(fdMode?"#888":pClr):undefined} isNew={gs.newCards.includes(id)}/>))}</div></div>
        {gs.phase==="score"&&<Btn label="REVEAL & SCORE" bg="linear-gradient(135deg,#f1c40f,#e67e22)" onClick={doScore}/>}

        {/* REVEAL PHASE — show both hands */}
        {gs.phase==="reveal"&&(()=>{
          const w=gs._revealWinner,aE=gs._revealAE,bE=gs._revealBE;
          const aH=getH(gs,"A"),bH=getH(gs,"B");
          const wClr=w==="A"?"#e74c3c":w==="B"?"#3498db":"#718096";
          const wText=w==="A"?"Player A wins the chip!":w==="B"?"Player B wins the chip!":"Tie — no chip awarded";
          return(<div style={{padding:16,background:"#0d111799",borderRadius:12,border:`2px solid ${wClr}44`}}>
            {/* Winner banner */}
            <div style={{textAlign:"center",marginBottom:16}}>
              <div style={{fontSize:22,fontWeight:900,color:wClr,fontFamily:"Georgia,serif",marginBottom:4}}>{wText}</div>
              <div style={{fontSize:13,color:"#667"}}>{gs.aChips} — {gs.bChips}</div>
            </div>
            {/* Both hands side by side */}
            <div style={{display:"flex",gap:20,justifyContent:"center",flexWrap:"wrap"}}>
              {[{pl:"A",hand:aH,ev:aE,clr:"#e74c3c",mods:gs.aMods},{pl:"B",hand:bH,ev:bE,clr:"#3498db",mods:gs.bMods}].map(({pl,hand:h,ev,clr,mods})=>{
                const isWinner=w===pl;const isTie=w==="TIE";
                return(<div key={pl} style={{opacity:!isWinner&&!isTie?0.5:1,transition:"all 0.3s"}}>
                  <div style={{fontSize:12,fontWeight:700,color:clr,marginBottom:4,textAlign:"center",letterSpacing:1}}>
                    PLAYER {pl} {isWinner&&"👑"}</div>
                  <div style={{display:"flex",gap:5,marginBottom:6}}>
                    {sortC(h).map(id=>{
                      const mod=mods.find(m=>m.target===id);
                      return(<div key={id} style={{position:"relative"}}>
                        <Card id={id} small glow={isWinner?clr:undefined}/>
                        {mod&&<div style={{position:"absolute",bottom:2,left:2,right:2,background:"#f1c40fdd",color:"#000",
                          borderRadius:3,fontSize:7,fontWeight:700,textAlign:"center",padding:"1px 2px"}}>
                          {mod.rank&&`→${mod.rank}`}{mod.suit&&`→${SUITS[mod.suit]}`}</div>}
                      </div>);})}
                  </div>
                  <div style={{textAlign:"center"}}><HandBadge ids={h} mods={mods}/></div>
                </div>);})}
            </div>
            {/* Next round button */}
            <div style={{textAlign:"center",marginTop:16}}>
              {gs.aChips>=7||gs.bChips>=7
                ?<div><div style={{fontSize:20,fontWeight:900,color:"#f1c40f",fontFamily:"Georgia,serif",marginBottom:8}}>
                    🏆 Player {gs.aChips>=7?"A":"B"} wins the game!</div>
                  <Btn label="New Game" bg="#333" onClick={()=>setGs(null)}/></div>
                :<Btn label="Next Round →" bg="#f1c40f" onClick={advanceFromReveal}/>}
            </div>
          </div>);
        })()}

        {gs.phase==="gameOver"&&<div style={{textAlign:"center",padding:20}}>
          <div style={{fontSize:24,fontWeight:900,color:"#f1c40f",fontFamily:"Georgia,serif"}}>Game Over — Player {gs.aChips>=7?"A":"B"} Wins!</div>
          <Btn label="New Game" bg="#333" onClick={()=>setGs(null)}/></div>}
      </div>
      {/* Log */}
      <div style={{width:240,borderLeft:"1px solid #151c25",background:"#0a0d1199",display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{fontSize:9,fontWeight:700,color:"#334",letterSpacing:1,padding:"10px 10px 4px"}}>LOG</div>
        <div ref={el=>{if(el)el.scrollTop=el.scrollHeight;}} style={{flex:1,overflow:"auto",padding:"0 10px 10px",fontSize:10,color:"#667",lineHeight:1.5}}>
          {gs.log.map((m,i)=>(<div key={i} style={{color:m.startsWith("===")?"#f1c40f":m.startsWith("🏆")?"#2ecc71":m.includes("wins")?"#e67e22":m.includes("Fizzle")||m.includes("Frozen")?"#e74c3c":"#667",fontWeight:m.startsWith("===")?700:400}}>{m}</div>))}</div></div>
    </div>
    {/* MODALS */}
    {modal?.type==="refreshOpts"&&<Modal title="Face-Down Options">
      <p style={{color:"#aaa",fontSize:12,marginBottom:10}}>Choose:</p>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"center"}}>
        {modal.opts.map(o=>(<Btn key={o.key} label={o.label} bg={o.key==="skip"?"#333":o.key==="refresh"?"#3498db":o.key==="sift"?"#2ecc71":"#6c5ce7"} onClick={()=>modal.onChoice(o.key)}/>))}</div></Modal>}
    {modal?.type==="pickDiscard"&&<Modal title={modal.title||"Discard a card"}>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
        {(modal.hand||getH(gs,gs.currentPlayer)).map(id=>{const v=!modal.filter||modal.filter(id);
          return <Card key={id} id={id} small dimmed={!v} onClick={v?()=>modal.onPick(id):undefined} glow={v?"#e74c3c":undefined} isNew={(modal.newCards||gs.newCards||[]).includes(id)}/>;})}</div></Modal>}
    {modal?.type==="pickFromList"&&<Modal title={modal.title}>
      {modal.showHand&&<div style={{marginBottom:8}}>
        <div style={{fontSize:9,color:"#556",fontWeight:700,letterSpacing:1,marginBottom:3}}>YOUR SCORING HAND</div>
        <div style={{display:"flex",gap:4,marginBottom:6}}>{sortC(modal.showHand).map(id=><Card key={id} id={id} small/>)}</div></div>}
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
        {modal.cards.map(id=>{const v=!modal.filter||modal.filter(id);
          return <Card key={id} id={id} small dimmed={!v} onClick={v?()=>modal.onPick(id):undefined} glow={v?"#f1c40f":undefined}/>;})}</div>
      {modal.canCancel&&<Btn label="Cancel / Skip" bg="#333" onClick={modal.onCancel}/>}</Modal>}
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
        <div style={{display:"flex",gap:4,marginBottom:4}}>{sortC(modal.showHand).map(id=><Card key={id} id={id} small/>)}</div></div>}
      <div style={{display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center"}}>
        {modal.ranks.map(r=>(<button key={r} onClick={()=>modal.onPick(r)} style={{width:44,height:44,borderRadius:6,background:"#1a1a2e",border:"1px solid #f1c40f44",color:"#f1c40f",fontSize:18,fontWeight:900,cursor:"pointer",fontFamily:"Georgia,serif",display:"flex",alignItems:"center",justifyContent:"center"}}>{r}</button>))}</div></Modal>}
    {modal?.type==="pickSuit"&&<Modal title={modal.title}>
      {modal.showHand&&<div style={{marginBottom:8}}><div style={{fontSize:9,color:"#556",fontWeight:700,letterSpacing:1,marginBottom:3}}>YOUR SCORING HAND</div>
        <div style={{display:"flex",gap:4,marginBottom:4}}>{sortC(modal.showHand).map(id=><Card key={id} id={id} small/>)}</div></div>}
      <div style={{display:"flex",gap:12,justifyContent:"center"}}>
        {SO.map(s=>(<button key={s} onClick={()=>modal.onPick(s)} style={{width:56,height:56,borderRadius:8,background:"#1a1a2e",border:`2px solid ${SC[s]}44`,color:SC[s],fontSize:28,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{SUITS[s]}</button>))}</div></Modal>}
    {modal?.type==="queen2"&&<Modal title={`${modal.pl}: Modify ${CM[modal.cardId].name}`}>
      {modal.showHand&&<div style={{marginBottom:8}}><div style={{fontSize:9,color:"#556",fontWeight:700,letterSpacing:1,marginBottom:3}}>YOUR SCORING HAND</div>
        <div style={{display:"flex",gap:4,marginBottom:4}}>{sortC(modal.showHand).map(id=><Card key={id} id={id} small/>)}</div></div>}
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
