// Shared presentational components: cards, card back, buttons, modals, the
// flight-ghost layer, victory overlays, and board widgets. Game logic lives in
// engine.js; the stateful app shell is KaizenPoker.jsx.
import { Fragment, createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CARD_BACK_IMAGE_SRC } from "./cardBackImage.js";
import { getCardIllustrationSrc } from "./cardImageMap.js";
import { SUITS, SC, SO, RO, CARDS, CM, TI, TC, isSoloMode, SOLO_DIFFICULTIES } from "./gameData.js";
import { evalHand, shuf, sortC } from "./engine.js";
import { playSfx } from "./sfx.js";

// Visual theme: set to false to roll back to the HTML-first card faces.
// The solo test mode (mode key "solo_art") always shows the opposite style of
// this default, so there is always one place to preview the other card face.
const USE_ILLUSTRATED_CARDS=true;
const FONT_DISPLAY="'Lilita One','Arial Black',sans-serif";
const FONT_BODY="'Nunito','Segoe UI',sans-serif";
function FeltBackdrop(){
  return(<>
    <div className="kp-felt" aria-hidden="true"/>
    <div className="kp-felt-vignette" aria-hidden="true"/>
  </>);
}
const CardRenderContext=createContext("html");
const ART_SOURCE_WIDTH=1049;
const ART_SOURCE_HEIGHT=1499;
const ART_CROP_X=36;
const ART_CROP_Y=36;
const ART_CROP_WIDTH=ART_SOURCE_WIDTH-(ART_CROP_X*2);
const ART_CROP_HEIGHT=ART_SOURCE_HEIGHT-(ART_CROP_Y*2);
const ART_IMAGE_WIDTH_SCALE=ART_SOURCE_WIDTH/ART_CROP_WIDTH;
const ART_IMAGE_HEIGHT_SCALE=ART_SOURCE_HEIGHT/ART_CROP_HEIGHT;
const ART_IMAGE_OFFSET_X=`-${(ART_CROP_X/ART_CROP_WIDTH)*100}%`;
const ART_IMAGE_OFFSET_Y=`-${(ART_CROP_Y/ART_CROP_HEIGHT)*100}%`;
function Card({id,selected,onClick,dimmed,small,glow,isNew,onMouseEnter,onMouseLeave,onMouseMove,onDoubleClick,onInspect,rankSticker,suitSticker,copySticker}){const c=CM[id];if(!c)return null;
  const renderStyle=useContext(CardRenderContext);
  const artMode=renderStyle==="image";
  const w=artMode&&!small?180:(small?68:120),h=artMode&&!small?252:(small?95:168),ti=TI[c.type];
  const baseTransform=selected?"translateY(-4px)":isNew?"translateY(-3px)":"translateY(0)";
  const paperBg=small?`linear-gradient(180deg,${ti.bg},#e7dcc6)`:`linear-gradient(180deg,#fbf7ef 0%,${ti.bg} 22%,#e6dcc8 100%)`;
  const artSrc=artMode?getCardIllustrationSrc(c.name):null;
  const artCornerColor=c.suit==="S"||c.suit==="C"?"#05070a":"#ffffff";
  const artCornerStroke=c.suit==="S"||c.suit==="C"?"#ffffff":"#05070a";
  const artCornerShadow=c.suit==="S"||c.suit==="C"
    ?[
      `.75px 0 0 ${artCornerStroke}`,
      `-.75px 0 0 ${artCornerStroke}`,
      `0 .75px 0 ${artCornerStroke}`,
      `0 -.75px 0 ${artCornerStroke}`,
      ".5px .5px 0 #ffffffd8",
      "-.5px .5px 0 #ffffffd8",
      ".5px -.5px 0 #ffffffd8",
      "-.5px -.5px 0 #ffffffd8",
      "0 2px 4px rgba(0,0,0,.35)"
    ].join(",")
    :[
      `1px 0 0 ${artCornerStroke}`,
      `-1px 0 0 ${artCornerStroke}`,
      `0 1px 0 ${artCornerStroke}`,
      `0 -1px 0 ${artCornerStroke}`,
      `1px 1px 0 ${artCornerStroke}`,
      `-1px 1px 0 ${artCornerStroke}`,
      `1px -1px 0 ${artCornerStroke}`,
      `-1px -1px 0 ${artCornerStroke}`,
      "0 2px 4px rgba(0,0,0,.5)"
    ].join(",");
  // Heavier outline for the vertical card name so it stays legible over busy
  // art. Halo is suit-aware (white behind black text, dark behind white text),
  // matching the corner rank's coloring; corner rank keeps its thinner stroke.
  const stroke=small?1:1.5;
  const artNameShadow=[
    `${stroke}px 0 0 ${artCornerStroke}`,
    `-${stroke}px 0 0 ${artCornerStroke}`,
    `0 ${stroke}px 0 ${artCornerStroke}`,
    `0 -${stroke}px 0 ${artCornerStroke}`,
    `${stroke}px ${stroke}px 0 ${artCornerStroke}`,
    `-${stroke}px ${stroke}px 0 ${artCornerStroke}`,
    `${stroke}px -${stroke}px 0 ${artCornerStroke}`,
    `-${stroke}px -${stroke}px 0 ${artCornerStroke}`,
    "0 2px 5px rgba(0,0,0,.5)"
  ].join(",");
  return(<div className={`kp-card${small?" kp-card-small":""}${onClick?" kp-card-clickable":""}${selected?" kp-card-selected":""}${isNew?" kp-card-new":""}`}
    data-card-id={id}
    onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onMouseMove={onMouseMove} onDoubleClick={onDoubleClick}
    title={small?"Hover to preview, use View to pin":undefined} style={{width:w,height:h,borderRadius:small?8:11,flexShrink:0,position:"relative",
    border:selected?`${small?2:3}px solid #f5b942`:isNew?`${small?2:3}px solid #3bbf7c`:glow?`${small?2:3}px solid ${glow}`:`${small?2:3}px solid ${artMode?"#f4e9d8":"#e8dcc4"}`,
    background:paperBg,
    boxShadow:selected?"0 5px 0 rgba(0,0,0,.35), 0 0 20px #f5b94266":isNew?"0 5px 0 rgba(0,0,0,.35), 0 0 18px #3bbf7c66":glow?`0 5px 0 rgba(0,0,0,.35), 0 0 16px ${glow}55`:"0 5px 0 rgba(0,0,0,.32), 0 9px 18px rgba(0,0,0,.28)",
    cursor:onClick?"pointer":"default",display:"flex",flexDirection:"column",
    padding:artMode?0:(small?"4px 5px":"7px 9px"),overflow:"hidden",opacity:dimmed?0.3:1,
    transform:baseTransform}}>
    {artMode&&artSrc
      ?<>
        <img src={artSrc} alt="" draggable={false} style={{position:"absolute",left:ART_IMAGE_OFFSET_X,top:ART_IMAGE_OFFSET_Y,width:`${ART_IMAGE_WIDTH_SCALE*100}%`,height:`${ART_IMAGE_HEIGHT_SCALE*100}%`,objectFit:"cover",objectPosition:"50% 42%",borderRadius:"inherit",userSelect:"none",pointerEvents:"none",filter:"saturate(1.04) contrast(.98)"}}/>
        <div style={{position:"absolute",inset:0,borderRadius:"inherit",background:"linear-gradient(90deg,rgba(0,0,0,.68) 0%,rgba(0,0,0,.34) 22%,rgba(0,0,0,0) 48%)",pointerEvents:"none"}}/>
        <div style={{position:"absolute",top:small?5:8,left:small?5:7,zIndex:1,display:"flex",alignItems:"center",gap:small?1:2,textShadow:"0 1px 3px #000,0 0 2px #000"}}>
          <span style={{fontSize:small?18:42,fontWeight:900,color:artCornerColor,lineHeight:1,fontFamily:FONT_DISPLAY,textShadow:artCornerShadow}}>{c.rank}</span>
          <span style={{fontSize:small?12:26,color:artCornerColor,lineHeight:1,textShadow:artCornerShadow}}>{SUITS[c.suit]}</span>
        </div>
        <div style={{position:"absolute",left:small?3:7,top:small?32:70,bottom:small?8:12,zIndex:1,writingMode:"vertical-rl",transform:"rotate(180deg)",fontSize:small?10:21,fontWeight:900,color:artCornerColor,fontFamily:FONT_DISPLAY,letterSpacing:small?.3:.6,lineHeight:1,textShadow:artNameShadow,display:"flex",alignItems:"center",justifyContent:"flex-end",whiteSpace:"nowrap",overflow:"hidden"}}>
          {c.name}
        </div>
        <div style={{position:"absolute",right:small?4:9,bottom:small?5:9,zIndex:1,fontSize:small?26:52,opacity:.18,color:SC[c.suit],fontFamily:FONT_DISPLAY,fontWeight:900,lineHeight:1,textShadow:"0 1px 0 #fff"}}>
          {SUITS[c.suit]}
        </div>
        {!small&&<div style={{position:"absolute",left:36,right:9,bottom:9,zIndex:1,minHeight:62,borderRadius:8,background:"rgba(252,246,232,.94)",border:"1px solid rgba(40,30,60,.35)",boxShadow:"0 4px 13px rgba(0,0,0,.24), inset 0 1px 0 rgba(255,255,255,.72)",padding:"6px 7px",fontSize:10,color:"#26203a",lineHeight:1.22,fontFamily:FONT_BODY,fontWeight:600}}>
          <span style={{fontFamily:FONT_DISPLAY,fontWeight:400,color:ti.bd,textTransform:"uppercase",letterSpacing:.7}}>{ti.lb}</span>
          <span>{" "}{c.text}</span>
        </div>}
        {small&&<div style={{position:"absolute",left:17,right:4,bottom:5,zIndex:1,borderRadius:5,background:"rgba(255,247,228,.86)",border:"1px solid rgba(84,60,33,.18)",padding:"2px 3px",fontSize:6,color:ti.bd,fontWeight:900,textTransform:"uppercase",letterSpacing:.7,textAlign:"center",lineHeight:1}}>
          {ti.lb}
        </div>}
      </>
      :<>
        <div style={{position:"absolute",right:small?5:10,bottom:small?18:24,fontSize:small?28:54,opacity:small?0.08:0.09,color:SC[c.suit],fontFamily:FONT_DISPLAY,fontWeight:700,transform:"rotate(-8deg)",pointerEvents:"none"}}>
          {SUITS[c.suit]}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:1}}>
          <span style={{fontSize:small?20:32,fontWeight:900,color:SC[c.suit],lineHeight:1,fontFamily:FONT_DISPLAY}}>{c.rank}</span>
          <span style={{fontSize:small?14:20,color:SC[c.suit],marginTop:small?1:3}}>{SUITS[c.suit]}</span></div>
        <div style={{fontSize:small?8:14,fontWeight:700,color:ti.ink,marginTop:1,fontFamily:FONT_DISPLAY,lineHeight:1.1,textShadow:"0 1px 0 rgba(255,255,255,.35)"}}>{c.name}</div>
        <div style={{fontSize:small?6:8,color:ti.bd,fontWeight:800,textTransform:"uppercase",letterSpacing:1,marginTop:2,alignSelf:"flex-start",background:ti.tagBg,padding:small?"1px 4px":"2px 6px",borderRadius:999,border:`1px solid ${ti.bd}33`}}>{ti.lb}</div>
        {!small&&<div style={{fontSize:9,color:"#3e3a35",marginTop:"auto",lineHeight:1.3,paddingTop:5,fontFamily:FONT_BODY,fontWeight:600}}>{c.text}</div>}
      </>}
    {isNew&&<div style={{position:"absolute",top:small?2:4,right:small?3:6,fontSize:small?6:8,fontWeight:900,color:"#3bbf7c",background:"#3bbf7c22",borderRadius:3,padding:"0 4px",zIndex:3}}>NEW</div>}
    {small&&onInspect&&<button onClick={e=>{e.stopPropagation();onInspect();}} aria-label="Inspect card" title="Pin card preview" style={{position:"absolute",top:2,right:2,width:16,height:16,padding:0,borderRadius:"50%",border:"1px solid #00000018",background:"#f6efe0dd",color:"#3b3228",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2,boxShadow:"0 1px 2px #00000022"}}>
      <svg width="9" height="9" viewBox="0 0 12 12" aria-hidden="true">
        <circle cx="5" cy="5" r="3.2" fill="none" stroke="#3b3228" strokeWidth="1.4"/>
        <path d="M7.6 7.6L10.5 10.5" stroke="#3b3228" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    </button>}
    {copySticker&&<div style={{position:"absolute",top:small?18:22,right:small?1:4,transform:"rotate(8deg)",background:"linear-gradient(180deg,#fff4a8,#f6dd69)",color:"#5a4618",border:"1px solid #d4bb5a",borderRadius:small?3:4,padding:small?"4px 5px 5px":"6px 8px 7px",fontSize:small?7:8,fontWeight:900,letterSpacing:.3,boxShadow:"0 3px 8px #00000024, inset 0 1px 0 #fff9cc",zIndex:3,textTransform:"uppercase",lineHeight:1.05,minWidth:small?38:48,textAlign:"center"}}>
      <div style={{position:"absolute",top:0,left:"18%",right:"18%",height:small?3:4,borderRadius:"0 0 3px 3px",background:"#fff8d0aa"}}/>
      <div>COPY OF</div>
      <div style={{marginTop:2,fontSize:small?6:7,letterSpacing:.05,textTransform:"none",fontWeight:800,lineHeight:1.05}}>{copySticker}</div>
    </div>}
    {rankSticker&&<div style={{position:"absolute",top:small?18:26,left:small?3:5,transform:"rotate(-7deg)",background:"linear-gradient(180deg,#fee089,#f7bf4f)",color:"#4a3412",border:"1px solid #bf8d30",borderRadius:small?6:8,padding:small?"1px 4px":"2px 8px",fontSize:small?9:14,fontWeight:900,fontFamily:FONT_DISPLAY,boxShadow:"0 2px 6px #00000022",zIndex:3,lineHeight:1}}>
      {rankSticker}
    </div>}
    {suitSticker&&<div style={{position:"absolute",top:small?18:26,left:small?18:30,transform:"rotate(9deg)",background:"linear-gradient(180deg,#fffaf0,#f1e0be)",color:SC[suitSticker]||"#3b3228",border:"1px solid #bda274",borderRadius:"50%",width:small?13:20,height:small?13:20,fontSize:small?9:14,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 6px #00000020",zIndex:3}}>
      {SUITS[suitSticker]||suitSticker}
    </div>}
  </div>);}
function PreviewCard(props){const[hover,setHover]=useState(false);const[pinned,setPinned]=useState(false);const[pos,setPos]=useState({x:0,y:0});
  const renderStyle=useContext(CardRenderContext);
  const previewW=renderStyle==="image"?220:160;
  const previewH=renderStyle==="image"?292:220;
  const previewX=Math.min((typeof window!=="undefined"?window.innerWidth:1280)-previewW,Math.max(16,pos.x+20));
  const previewY=Math.min((typeof window!=="undefined"?window.innerHeight:900)-previewH,Math.max(16,pos.y-30));
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
function FaceDownActionSlot({id,canPeek=false,copySticker}){const[hover,setHover]=useState(false);const[pos,setPos]=useState({x:0,y:0});
  const renderStyle=useContext(CardRenderContext);
  const previewW=renderStyle==="image"?220:160;
  const previewH=renderStyle==="image"?292:220;
  const previewX=Math.min((typeof window!=="undefined"?window.innerWidth:1280)-previewW,Math.max(8,pos.x+14));
  const previewY=Math.min((typeof window!=="undefined"?window.innerHeight:900)-previewH,Math.max(8,pos.y-previewH-12));
  return(<>
    <div className="kp-action-slot"
      data-card-id={id} data-facedown="1"
      onMouseEnter={canPeek?e=>{setPos({x:e.clientX,y:e.clientY});setHover(true);}:undefined}
      onMouseLeave={canPeek?()=>setHover(false):undefined}
      onMouseMove={canPeek?e=>setPos({x:e.clientX,y:e.clientY}):undefined}
      style={{position:"relative",width:68,height:95,cursor:canPeek?"help":"default"}}>
      <CardBack/>
      <div style={{position:"absolute",left:4,right:4,bottom:4,textAlign:"center",fontSize:7,fontWeight:800,letterSpacing:.5,textTransform:"uppercase",color:"#f4e9d8cc",background:"#2a0d18c0",borderRadius:5,padding:"2px 0",pointerEvents:"none"}}>{canPeek?"Hover to peek":"Face-down"}</div>
    </div>
    {canPeek&&hover&&<div style={{position:"fixed",left:previewX,top:previewY,zIndex:1200,pointerEvents:"none",animation:"inspectPop 0.12s ease-out"}}>
      <Card id={id} copySticker={copySticker}/>
    </div>}
  </>);}
// ---- Card back: bonsai emblem whose leaves are the four suits ----
// Hand-built SVG so it stays crisp at every size and uses the theme palette.
const CARD_BACK_SHAPES={
  spade:<path d="M12 2C9 8 4 10.5 4 14.5C4 17 6 19 8.5 19C9.8 19 11 18.5 11.8 17.6C11.3 19.6 10.4 21 9 22L15 22C13.6 21 12.7 19.6 12.2 17.6C13 18.5 14.2 19 15.5 19C18 19 20 17 20 14.5C20 10.5 15 8 12 2Z"/>,
  heart:<path d="M12 21C7 16.5 3 13.5 3 9.5C3 6.5 5.2 4.5 7.8 4.5C9.6 4.5 11.1 5.4 12 6.9C12.9 5.4 14.4 4.5 16.2 4.5C18.8 4.5 21 6.5 21 9.5C21 13.5 17 16.5 12 21Z"/>,
  diamond:<path d="M12 2C13.5 6 17 9.5 20 12C17 14.5 13.5 18 12 22C10.5 18 7 14.5 4 12C7 9.5 10.5 6 12 2Z"/>,
  club:<g><circle cx="12" cy="7.2" r="4.6"/><circle cx="6.8" cy="14" r="4.6"/><circle cx="17.2" cy="14" r="4.6"/><path d="M12 13C11.2 17 10.2 19.5 8.6 21.5L15.4 21.5C13.8 19.5 12.8 17 12 13Z"/></g>,
  leaf:<path d="M12 3C16 7 16 15 12 21C8 15 8 7 12 3Z"/>,
};
// Suit shapes punched into the canopy pads as negative space.
const CARD_BACK_CUTOUTS=[
  {x:38,y:44,s:.36,r:-10,t:"spade"},
  {x:50,y:45,s:.36,r:8,t:"heart"},
  {x:31,y:51,s:.30,r:-20,t:"diamond"},
  {x:57,y:51,s:.32,r:15,t:"club"},
  {x:44,y:54,s:.28,r:-30,t:"diamond"},
  {x:77,y:65,s:.30,r:-8,t:"heart"},
  {x:85,y:69,s:.28,r:12,t:"spade"},
  {x:24,y:78,s:.28,r:-15,t:"diamond"},
  {x:31,y:80,s:.26,r:20,t:"club"},
];
// Loose leaves drawn on top: the apex breaking the enso, gold accents,
// and the pruned leaf falling away (a scrapped card).
const CARD_BACK_LEAVES=[
  {x:44,y:31,s:.40,r:-6,t:"spade"},
  {x:63,y:45,s:.34,r:25,t:"heart",gold:true},
  {x:76,y:58,s:.30,r:10,t:"diamond",gold:true},
  {x:20,y:88,s:.26,r:-30,t:"leaf",o:.8},
  {x:87,y:95,s:.28,r:48,t:"heart",gold:true,o:.95},
];
function CardBack({width=68,height=95,style}){
  return(<div className="kp-cardback" style={{width,height,borderRadius:6,flexShrink:0,background:"radial-gradient(circle at 50% 32%,#8d2433 0%,#5c1626 55%,#3a0f1d 100%)",border:"2px solid #f4e9d866",boxShadow:"0 4px 0 rgba(0,0,0,.35), 0 8px 18px #00000033",overflow:"hidden",position:"relative",...style}}>
    {CARD_BACK_IMAGE_SRC
      ?<img src={CARD_BACK_IMAGE_SRC} alt="" draggable={false} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",borderRadius:"inherit",userSelect:"none",pointerEvents:"none"}}/>
      :<svg viewBox="0 0 120 168" width="100%" height="100%" style={{display:"block"}} aria-hidden="true">
      <defs>
        <mask id="kpBonsaiPads">
          <g fill="#fff">
            <ellipse cx="45" cy="47" rx="17" ry="10"/>
            <ellipse cx="35" cy="53" rx="10.5" ry="6.5"/>
            <ellipse cx="55" cy="52" rx="10.5" ry="6.5"/>
            <ellipse cx="80" cy="67" rx="12" ry="7"/>
            <ellipse cx="88" cy="70" rx="6.5" ry="4.5"/>
            <ellipse cx="27" cy="79" rx="10.5" ry="6.5"/>
          </g>
          <g fill="#000">
            {CARD_BACK_CUTOUTS.map((L,i)=>(
              <g key={i} transform={`translate(${L.x} ${L.y}) rotate(${L.r}) scale(${L.s}) translate(-12 -12)`}>
                {CARD_BACK_SHAPES[L.t]}
              </g>
            ))}
          </g>
        </mask>
      </defs>
      <rect x="4.5" y="4.5" width="111" height="159" rx="8" fill="none" stroke="#f4e9d8" strokeOpacity=".5" strokeWidth="1.5"/>
      <rect x="8" y="8" width="104" height="152" rx="6" fill="none" stroke="#f5b942" strokeOpacity=".38" strokeWidth=".75"/>
      <circle cx="60" cy="82" r="45" fill="none" stroke="#f4e9d8" strokeOpacity=".85" strokeWidth="4" strokeLinecap="round" strokeDasharray="252 31" transform="rotate(-65 60 82)"/>
      <path d="M42 108 H78 L74 118 Q60 121.5 46 118 Z" fill="#f4e9d8"/>
      <path d="M45.5 112 H74.5" stroke="#f5b942" strokeWidth="1.6" strokeOpacity=".9" fill="none"/>
      <path d="M57 109 C52 98 47 92 50 83 C52 75 48 69 46 60" fill="none" stroke="#f4e9d8" strokeWidth="4.4" strokeLinecap="round"/>
      <path d="M51 86 C60 82 68 78 76 71" fill="none" stroke="#f4e9d8" strokeWidth="3" strokeLinecap="round"/>
      <path d="M50 93 C42 91 35 88 30 82" fill="none" stroke="#f4e9d8" strokeWidth="2.6" strokeLinecap="round"/>
      <rect x="6" y="26" width="108" height="66" fill="#f4e9d8" mask="url(#kpBonsaiPads)"/>
      {CARD_BACK_LEAVES.map((L,i)=>(
        <g key={i} transform={`translate(${L.x} ${L.y}) rotate(${L.r}) scale(${L.s}) translate(-12 -12)`} fill={L.gold?"#f5b942":"#f4e9d8"} opacity={L.o??.9}>
          {CARD_BACK_SHAPES[L.t]}
        </g>
      ))}
      <circle cx="68" cy="42" r="1.3" fill="#f5b942" opacity=".75"/>
      <circle cx="76" cy="46" r="1" fill="#f5b942" opacity=".6"/>
      <circle cx="26" cy="64" r="1" fill="#f4e9d8" opacity=".55"/>
    </svg>}
  </div>);
}

// ---- Card flight layer: FLIP-style ghosts for cards moving between zones ----
const FLIGHT_MS=230;
const prefersReducedMotion=()=>{
  if(typeof window==="undefined"||!window.matchMedia)return false;
  try{return window.matchMedia("(prefers-reduced-motion: reduce)").matches;}catch{return false;}
};
function flightZoneMap(g){
  const m=new Map();
  if(!g)return m;
  const put=(items,zone)=>{(items||[]).forEach(x=>{const id=typeof x==="string"?x:x?.id;if(id&&!m.has(id))m.set(id,zone);});};
  put(g.aHand,"aHand");put(g.bHand,"bHand");
  put(g.aPlay,"aPlay");put(g.bPlay,"bPlay");
  put(g.aDiscard,"aDiscard");put(g.bDiscard,"bDiscard");
  put(g.scrap,"scrap");put(g.aDeck,"aDeck");put(g.bDeck,"bDeck");
  return m;
}
function FlightGhost({flight,onDone}){
  const ref=useRef(null);
  useLayoutEffect(()=>{
    const el=ref.current;if(!el||typeof el.animate!=="function"){onDone(flight.key);return undefined;}
    const {from,to,fadeOut}=flight;
    const anim=el.animate([
      {transform:`translate(${from.left}px,${from.top}px) scale(${from.width/68},${from.height/95})`,opacity:1},
      {transform:`translate(${to.left}px,${to.top}px) scale(${to.width/68},${to.height/95}) rotate(${fadeOut?-5:0}deg)`,opacity:fadeOut?0.1:1}
    ],{duration:FLIGHT_MS,easing:"cubic-bezier(.3,.7,.3,1)",fill:"forwards"});
    anim.onfinish=()=>onDone(flight.key);
    return()=>{try{anim.cancel();}catch{}};
  },[]);
  return(<div ref={ref} data-flight-ghost="1" className="kp-flight" style={{position:"fixed",left:0,top:0,zIndex:1300,pointerEvents:"none",transformOrigin:"top left",willChange:"transform,opacity",filter:"drop-shadow(0 8px 14px rgba(0,0,0,.4))",transform:`translate(${flight.from.left}px,${flight.from.top}px) scale(${flight.from.width/68},${flight.from.height/95})`}}>
    {flight.back
      ?<CardBack style={{boxShadow:"0 4px 0 rgba(0,0,0,.3)"}}/>
      :<Card id={flight.id} small/>}
  </div>);
}

// Stamped token for a Remember card that is active from the scrap pile.
// Hovering shows the full card so players can re-read the exact text.
function RememberChip({id}){const[hover,setHover]=useState(false);const[pos,setPos]=useState({x:0,y:0});
  const c=CM[id];if(!c)return null;
  const renderStyle=useContext(CardRenderContext);
  const previewW=renderStyle==="image"?220:160;
  const previewH=renderStyle==="image"?292:220;
  const previewX=Math.min((typeof window!=="undefined"?window.innerWidth:1280)-previewW,Math.max(8,pos.x+14));
  const previewY=Math.min((typeof window!=="undefined"?window.innerHeight:900)-previewH,Math.max(8,pos.y+18));
  const shortText=c.text.replace("As long as this card is scrapped, ","");
  return(<>
    <span
      onMouseEnter={e=>{setPos({x:e.clientX,y:e.clientY});setHover(true);}}
      onMouseLeave={()=>setHover(false)}
      onMouseMove={e=>setPos({x:e.clientX,y:e.clientY})}
      style={{display:"inline-flex",alignItems:"center",gap:8,cursor:"help",maxWidth:"100%",minWidth:0}}>
      <span style={{fontFamily:FONT_DISPLAY,fontSize:11,color:"#fff",background:"linear-gradient(180deg,#b07ef5,#7a44c4)",padding:"4px 11px 5px",borderRadius:8,boxShadow:"0 3px 0 rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.3)",textShadow:"0 1px 0 rgba(0,0,0,.35)",letterSpacing:.4,whiteSpace:"nowrap",flexShrink:0}}>
        {c.rank}{SUITS[c.suit]} {c.name}
      </span>
      <span style={{fontSize:11,color:"#efeafc",fontWeight:600,lineHeight:1.35,minWidth:0}}>{shortText.charAt(0).toUpperCase()+shortText.slice(1)}</span>
    </span>
    {hover&&<div style={{position:"fixed",left:previewX,top:previewY,zIndex:1200,pointerEvents:"none",animation:"inspectPop 0.12s ease-out"}}>
      <Card id={id}/>
    </div>}
  </>);}
function getCascadeCardPool(gs){
  if(!gs)return [];
  const playIds=zone=>(zone||[]).map(card=>typeof card==="string"?card:card?.id).filter(Boolean);
  const ids=[
    ...(gs.aHand||[]),
    ...(gs.bHand||[]),
    ...(gs.aDeck||[]),
    ...(gs.bDeck||[]),
    ...(gs.aDiscard||[]),
    ...(gs.bDiscard||[]),
    ...playIds(gs.aPlay),
    ...playIds(gs.bPlay),
    ...(gs.scrap||[]),
    ...(gs._soloRevealedCards||[]),
    gs._soloReveal?.cardId,
  ].filter(Boolean);
  return [...new Set(ids)];
}
function VictorySolitaireCanvas({winner,cards=[]}){if(!winner||winner==="TIE")return null;
  const rafRef=useRef(null);
  const spriteRefs=useRef([]);
  const spritesRef=useRef([]);
  const cardsKey=(cards||[]).join("|");
  const idsRef=useRef([]);
  if(!idsRef.current.length||idsRef.current._key!==cardsKey){
    const pool=(cards.length?cards:CARDS.map(c=>c.id)).filter(Boolean);
    const shuffled=shuf(pool);
    const fallback=CARDS.map(c=>c.id);
    const targetCount=52;
    const sampled=Array.from({length:targetCount},(_,i)=>shuffled[i%Math.max(1,shuffled.length)]||fallback[i%fallback.length]);
    idsRef.current=sampled;
    idsRef.current._key=cardsKey;
  }
  const spriteIds=idsRef.current;
  useEffect(()=>{
    if(!spriteIds.length)return;
    const sprites=spriteIds.map((id,i)=>({
      key:`${id}-${i}`,
      id,
      x:0,y:0,vx:0,vy:0,rot:0,vr:0,
      width:68,height:95,
      bounce:0.76,
      restFor:0,
      active:false,
      queued:true,
      hasDropped:false,
    }));
    spritesRef.current=sprites;
    const spawnSprite=s=>{
      s.x=Math.random()*Math.max(100,window.innerWidth-140);
      s.y=-(Math.random()*220)-120;
      s.vx=(Math.random()*180)-90;
      s.vy=40+(Math.random()*120);
      s.rot=((Math.random()*26)-13)*Math.PI/180;
      s.vr=((Math.random()*1.5)-0.75);
      s.bounce=0.72+(Math.random()*0.08);
      s.restFor=0;
      s.active=true;
      s.queued=false;
      s.hasDropped=true;
    };
    const syncNode=s=>{
      const node=spriteRefs.current.find(entry=>entry?.dataset?.spriteKey===s.key);
      if(!node)return;
      node.style.transform=`translate3d(${s.x}px, ${s.y}px, 0) rotate(${s.rot}rad)`;
      node.style.opacity=s.active?"1":"0";
    };
    sprites.forEach(syncNode);
    let lastTs=0;
    let spawnAccumulator=0;
    const spawnInterval=0.2;
    const floorPad=8;
    const gravity=1180;
    const step=ts=>{
      if(!lastTs)lastTs=ts;
      const dt=Math.min((ts-lastTs)/1000,0.033);
      lastTs=ts;
      spawnAccumulator+=dt;
      while(spawnAccumulator>=spawnInterval){
        spawnAccumulator-=spawnInterval;
        const nextQueued=sprites.find(sprite=>sprite.queued);
        if(nextQueued)spawnSprite(nextQueued);
        else break;
      }
      for(const s of sprites){
        if(s.active){
          s.vy+=gravity*dt;
          s.x+=s.vx*dt;
          s.y+=s.vy*dt;
          s.rot+=s.vr*dt;
          s.vx*=0.999;
          s.vr*=0.996;
          if(s.x<=-10){
            s.x=-10;
            s.vx=Math.abs(s.vx)*0.9;
            s.vr*=-0.92;
          }else if(s.x+s.width>=window.innerWidth+10){
            s.x=window.innerWidth-s.width+10;
            s.vx=-Math.abs(s.vx)*0.9;
            s.vr*=-0.92;
          }
          const floorY=window.innerHeight-s.height-floorPad;
          if(s.y>=floorY){
            s.y=floorY;
            if(Math.abs(s.vy)>70){
              s.vy=-Math.abs(s.vy)*s.bounce;
              s.vx*=0.985;
              s.vr*=0.94;
            }else{
              s.vy=0;
              s.vx*=0.94;
              s.vr*=0.9;
              if(Math.abs(s.vx)<8&&Math.abs(s.vr)<0.08){
                s.vx=0;
                s.vr=0;
                s.active=false;
                s.restFor=0;
              }
            }
          }
        }else{
          if(s.hasDropped){
            s.restFor+=dt;
            if(s.restFor>1.2){
              s.queued=true;
              s.hasDropped=false;
              s.x=-220;
              s.y=-220;
              s.restFor=0;
            }
          }
        }
        syncNode(s);
      }
      rafRef.current=requestAnimationFrame(step);
    };
    rafRef.current=requestAnimationFrame(step);
    return()=>{
      if(rafRef.current)cancelAnimationFrame(rafRef.current);
    };
  },[cardsKey,winner,spriteIds.length]);
  const glowColor=winner==="A"?"#ff5a4e":"#34a3ff";
  return <div aria-hidden="true" style={{position:"fixed",inset:0,zIndex:31,pointerEvents:"none",overflow:"hidden"}}>
    {spriteIds.map((id,i)=><div
      key={`${id}-${i}`}
      data-sprite-key={`${id}-${i}`}
      ref={node=>{if(node)spriteRefs.current[i]=node;}}
      style={{position:"absolute",top:0,left:0,transform:"translate3d(-200px,-200px,0)",opacity:0,willChange:"transform, opacity",transition:"opacity 0.12s linear",filter:`drop-shadow(0 10px 18px #0008) drop-shadow(0 0 12px ${glowColor}66)`}}
    >
      <Card id={id} small glow={glowColor}/>
    </div>)}
  </div>;
}
function KonamiCelebrationOverlay({open,onClose,onReplay,cards=[]}) {
  useEffect(()=>{
    if(!open)return undefined;
    const onKey=e=>{
      if(e.key==="Escape")onClose?.();
    };
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[open,onClose]);
  if(!open)return null;
  return(
    <div style={{position:"fixed",inset:0,zIndex:40,display:"flex",alignItems:"center",justifyContent:"center",padding:"28px 20px",background:"radial-gradient(circle at 50% 20%,rgba(241,196,15,.14) 0%,rgba(10,15,22,.84) 38%,rgba(5,8,12,.96) 100%)",backdropFilter:"blur(8px)"}}>
      <VictorySolitaireCanvas winner="A" cards={cards}/>
      <div style={{position:"relative",padding:"22px 24px",background:"linear-gradient(180deg,#262b4cf6,#191c36fa)",borderRadius:20,border:"3px solid #f5b942",boxShadow:"0 8px 0 rgba(0,0,0,.4), 0 40px 100px #00000055, inset 0 2px 0 rgba(255,255,255,.08)",maxWidth:460,width:"min(460px,calc(100vw - 36px))",textAlign:"center",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(120deg,transparent 0%,rgba(255,255,255,.05) 22%,transparent 46%)",backgroundSize:"240px 100%",animation:"brassShine 5.5s linear infinite",pointerEvents:"none",opacity:.55}}/>
        <div style={{position:"relative",fontSize:11,fontWeight:800,color:"#9b97b2",letterSpacing:4,textTransform:"uppercase",marginBottom:8}}>Secret Unlocked</div>
        <div style={{position:"relative",fontSize:34,fontWeight:900,color:"#f3d7a4",fontFamily:FONT_DISPLAY,lineHeight:1.05,marginBottom:10,textShadow:"0 0 24px #f5b94244"}}>Victory Lap</div>
        <div style={{position:"relative",fontSize:13,color:"#dbe5ee",lineHeight:1.55,marginBottom:16}}>
          The old code still works. Enjoy the cardfall.
        </div>
        <div style={{position:"relative",display:"flex",justifyContent:"center",gap:10,flexWrap:"wrap"}}>
          <Btn label="Again" bg="linear-gradient(135deg,#f5b942,#ff9d2e)" onClick={onReplay}/>
          <Btn label="Close" bg="#333" onClick={onClose}/>
        </div>
      </div>
    </div>
  );
}
function GalleryThumbCard({id,onHover,onLeave,onClick,active=false,scale=1}){return <div
  onMouseEnter={onHover}
  onMouseLeave={onLeave}
  onClick={onClick||onHover}
  role="button"
  tabIndex={0}
  onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();(onClick||onHover)?.();}}}
  style={{
    width:120*scale,
    height:168*scale,
    transform:`scale(${scale}) translateY(${active?-4:0}px)`,
    transformOrigin:"top left",
    transition:"transform .18s ease,filter .18s ease",
    filter:active?"drop-shadow(0 12px 22px rgba(0,0,0,.34)) brightness(1.04)":"drop-shadow(0 8px 16px rgba(0,0,0,.22))",
    cursor:"pointer"
  }}>
  <Card id={id}/>
</div>;}
function HandBadge({ids,mods,delay}){if(!ids||ids.length!==5)return null;const r=evalHand(ids,mods);const c=TC[r.handRank];
  return <span key={r.handName} style={{display:"inline-block",padding:"4px 14px",borderRadius:9,background:"#12142a",border:`2px solid ${c}`,color:c,fontWeight:400,fontSize:13,fontFamily:FONT_DISPLAY,letterSpacing:.6,whiteSpace:"nowrap",boxShadow:`0 3px 0 rgba(0,0,0,.4), 0 0 14px ${c}33`,animation:`scorePunch .42s cubic-bezier(.26,1.5,.42,1) ${delay||"0s"} backwards`}}>{r.handName}</span>;}
function Btn({label,bg="#333",onClick,disabled,silent=false}){
  // Normalize legacy bg values (gradients, "#333" secondaries) into flat stamped fills.
  const flatBg=(()=>{
    if(bg==="#333"||bg==="#555")return "#41477a";
    const m=typeof bg==="string"?bg.match(/#[0-9a-fA-F]{6}/):null;
    return m?m[0]:bg;
  })();
  return(<button className="kp-btn" onClick={e=>{if(disabled)return;if(!silent)playSfx("confirm",{volume:.28});onClick?.(e);}} disabled={disabled}
    style={{padding:"9px 18px",background:disabled?"#23264a":flatBg,fontSize:13,opacity:disabled?0.65:1}}>{label}</button>);}
function SfxToggle({enabled,onToggle}){return(<button className="kp-pill" onClick={()=>{playSfx(enabled?"error":"confirm",{volume:.24});onToggle();}} style={{padding:"4px 12px",fontSize:10,color:enabled?"#a9f0c8":"#c8c4d8",borderColor:enabled?"#3bbf7c88":undefined,background:enabled?"#1a3a2e":undefined}}>SFX {enabled?"On":"Off"}</button>);}
function Chip({filled,color,label,active}){return <div style={{width:22,height:22,borderRadius:"50%",display:"grid",placeItems:"center",position:"relative",
  background:filled?`radial-gradient(circle at 35% 30%,#fff8,${color} 25%,${color}dd 58%,#0008 100%)`:"radial-gradient(circle at 35% 30%,#32404d,#18202a 68%,#081018 100%)",
  border:`2px solid ${filled?`${color}aa`:"#445262"}`,boxShadow:filled?`0 0 14px ${color}55, inset 0 1px 0 #fff8, 0 6px 12px #0005`:"inset 0 1px 0 #ffffff14, 0 4px 10px #0004",
  transform:active?"translateY(-2px) scale(1.06)":"none",transition:"transform .18s, box-shadow .18s"}}>
  <div style={{position:"absolute",inset:3,borderRadius:"50%",border:`2px dashed ${filled?"#fff8":"#73839655"}`}}/>
  <span style={{fontSize:9,fontWeight:900,color:filled?"#fff7e8":"#a8a4c0",fontFamily:FONT_DISPLAY,textShadow:"0 1px 2px #0008"}}>{label}</span>
</div>;}

// Draggable Modal
function Modal({title,children}){const[pos,setPos]=useState({x:0,y:0});const dr=useRef(false),off=useRef({x:0,y:0});
  const onD=e=>{dr.current=true;off.current={x:e.clientX-pos.x,y:e.clientY-pos.y};
    const mv=e2=>{if(dr.current)setPos({x:e2.clientX-off.current.x,y:e2.clientY-off.current.y})};
    const up=()=>{dr.current=false;window.removeEventListener("mousemove",mv);window.removeEventListener("mouseup",up)};
    window.addEventListener("mousemove",mv);window.addEventListener("mouseup",up);};
  return(<div style={{position:"fixed",inset:0,background:"rgba(14,5,14,0.66)",backdropFilter:"blur(3px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
    <div className="kp-modal-shell kp-panel" style={{padding:20,maxWidth:620,width:"90%",maxHeight:"80vh",overflowX:"hidden",overflowY:"auto",left:pos.x,top:pos.y,position:"relative",animation:"revealRise .26s cubic-bezier(.26,1.36,.42,1)"}}>
      <div onMouseDown={onD} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,cursor:"grab",userSelect:"none",padding:"0 0 8px",borderBottom:"2px solid #00000044"}}>
        <div style={{fontSize:17,color:"#f5b942",fontFamily:FONT_DISPLAY,letterSpacing:.5,textShadow:"0 2px 0 rgba(0,0,0,.4)"}}>{title}</div>
        <span style={{fontSize:9,color:"#8d89a8"}}>drag to move</span></div>
      {children}</div></div>);}

// Multi-select modal (as proper component, not IIFE)
function MultiPickModal({title,cards,maxPick,onPick,btnLabel="Confirm",statsPlayer,gs,viewerPlayer,hint}){const[pk,setPk]=useState([]);
  return(<Modal title={title}><div style={{fontSize:11,color:"#8d89a8",marginBottom:6}}>{hint||`Select up to ${maxPick}`}</div>
    {statsPlayer&&gs&&<div style={{marginBottom:8,display:"flex",justifyContent:"flex-start"}}><DeckStats gs={gs} player={statsPlayer} viewerPlayer={viewerPlayer}/></div>}
    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
      {cards.map(id=>(<PreviewCard key={id} id={id} selected={pk.includes(id)}
        onClick={()=>setPk(p=>p.includes(id)?p.filter(x=>x!==id):p.length<maxPick?[...p,id]:p)}/>))}</div>
    <Btn label={`${btnLabel} (${pk.length})`} bg="#f5b942" onClick={()=>onPick(pk)}/></Modal>);}

// Brainstorm: pick 3 in order
function BrainstormModal({hand,newCards,onPick}){const[pk,setPk]=useState([]);
  const toggle=id=>setPk(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  return(<Modal title="Brainstorm: Put 3 cards on top (tap in order, 1st = top)">
    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
      {hand.map(id=>{const idx=pk.indexOf(id);return(<div key={id} style={{position:"relative"}}>
        <PreviewCard id={id} selected={idx>=0} isNew={(newCards||[]).includes(id)} onClick={()=>toggle(id)}/>
        {idx>=0&&<div style={{position:"absolute",top:2,left:2,background:"#f5b942",color:"#000",borderRadius:10,width:18,height:18,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900}}>{idx+1}</div>}
      </div>);})}</div>
    {pk.length===3&&<div style={{fontSize:11,color:"#aaa",marginBottom:6}}>Top to bottom: {pk.map(id=>CM[id].name).join(", ")}</div>}
    <Btn label={`Put ${pk.length}/3 on top`} bg={pk.length===3?"#f5b942":"#333"} disabled={pk.length!==3} onClick={()=>pk.length===3&&onPick(pk)}/></Modal>);}

// Rejuvenate: pick up to 3 to discard
function RejuvenateModal({hand,onPick}){const[pk,setPk]=useState([]);
  return(<Modal title="Rejuvenate: Discard up to 3, draw that many">
    <div style={{fontSize:11,color:"#8d89a8",marginBottom:6}}>Choose any number from 0 to 3.</div>
    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
      {hand.map(id=>(<PreviewCard key={id} id={id} selected={pk.includes(id)}
        onClick={()=>setPk(p=>p.includes(id)?p.filter(x=>x!==id):p.length<3?[...p,id]:p)}/>))}</div>
    <Btn label={`Discard ${pk.length}, then draw ${pk.length}`} bg="#f5b942" onClick={()=>onPick(pk)}/></Modal>);}

// Deck memory tracker — shows cards whose current location the player can reasonably know
function DeckStats({gs,player,viewerPlayer}){const[show,setShow]=useState(false);
  const canView=player===viewerPlayer||(isSoloMode(gs.mode)&&player==="B");
  if(!canView)return null;
  const initialDeck=(player==="A"?gs._aInitialDeck:gs._bInitialDeck)||[];
  const currentDeck=player==="A"?gs.aDeck:gs.bDeck;
  const currentHand=player==="A"?gs.aHand:gs.bHand;
  const currentPlay=player==="A"?gs.aPlay:gs.bPlay;
  const currentDiscard=player==="A"?gs.aDiscard:gs.bDiscard;
  const easySoloTopId=isSoloMode(gs.mode)&&player==="B"&&gs._soloDifficulty===SOLO_DIFFICULTIES.easy&&gs.phase==="action"
    ?(gs.bDeck[0]||null)
    :null;
  const revealedSoloSet=isSoloMode(gs.mode)&&player==="B"
    ?new Set(gs._soloRevealedCards||[])
    :new Set();
  const zoneMeta={
    H:{label:"Hand",color:"#f5d38f",background:"#f5d38f24",border:"#f5d38f55"},
    P:{label:"In Play",color:"#7ce7bc",background:"#7ce7bc1f",border:"#7ce7bc55"},
    D:{label:"Deck",color:"#74b7ff",background:"#74b7ff22",border:"#74b7ff55"},
    d:{label:"Discard",color:"#ff9f8d",background:"#ff9f8d20",border:"#ff9f8d55"},
    S:{label:"Scrap",color:"#d4a6ff",background:"#d4a6ff22",border:"#d4a6ff55"},
    R:{label:"Revealed",color:"#96e6ff",background:"#96e6ff1d",border:"#96e6ff55"},
  };
  const getMemoryZone=id=>{
    if(currentHand.includes(id))return"H";
    if(currentPlay.some(a=>a?.id===id))return"P";
    if(currentDiscard.includes(id))return"d";
    if(gs.scrap.includes(id))return"S";
    if(easySoloTopId===id)return"D";
    if(revealedSoloSet.has(id))return"R";
    return null;
  };
  const knownCards=initialDeck.filter(id=>getMemoryZone(id));
  const memoryCounts={
    H:knownCards.filter(id=>getMemoryZone(id)==="H").length,
    P:knownCards.filter(id=>getMemoryZone(id)==="P").length,
    D:currentDeck.length,
    d:knownCards.filter(id=>getMemoryZone(id)==="d").length,
    S:knownCards.filter(id=>getMemoryZone(id)==="S").length,
    R:knownCards.filter(id=>getMemoryZone(id)==="R").length,
  };
  const clr=player==="A"?"#ff5a4e":"#34a3ff";
  if(!show)return(<button onClick={()=>setShow(true)} style={{padding:"5px 12px 6px",borderRadius:9,fontSize:11,fontFamily:FONT_DISPLAY,letterSpacing:.4,
    border:`2px solid ${clr}aa`,background:"#12142a",color:clr,cursor:"pointer",boxShadow:"0 3px 0 rgba(0,0,0,.35)",transition:"background .12s, color .12s"}}>{player} Memory</button>);
  return(<div style={{background:"linear-gradient(180deg,#1d2140f8,#15172efa)",border:`2px solid ${clr}55`,borderRadius:10,padding:8,fontSize:9,boxShadow:"0 4px 0 rgba(0,0,0,.35), 0 10px 24px #00000033, inset 0 2px 0 rgba(255,255,255,.06)",maxWidth:"100%",overflowX:"auto"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:8}}>
      <div style={{display:"grid",gap:2}}>
        <span style={{color:clr,fontWeight:800,letterSpacing:.8,textTransform:"uppercase"}}>{player} Memory</span>
        <span style={{fontSize:9,color:"#8d89a8"}}>{knownCards.length} card{knownCards.length!==1?"s":""} currently tracked</span>
      </div>
      <button onClick={()=>setShow(false)} style={{background:"none",border:"none",color:"#8d89a8",cursor:"pointer",fontSize:12}}>x</button></div>
    <div style={{display:"grid",gap:8}}>
      <div style={{display:"grid",gridTemplateColumns:"18px repeat(13, minmax(18px, 1fr))",gap:3,alignItems:"center",minWidth:320}}>
        <div/>
        {RO.map(rank=><div key={`head-${rank}`} style={{fontSize:10,color:"#a8a4c0",textAlign:"center",fontWeight:700}}>{rank}</div>)}
        {SO.map(suit=><Fragment key={`row-${suit}`}>
          <div style={{fontSize:12,color:SC[suit],textAlign:"center",fontWeight:900,textShadow:`0 0 10px ${SC[suit]}44`}}>{SUITS[suit]}</div>
          {RO.map(rank=>{const card=CARDS.find(c=>c.rank===rank&&c.suit===suit);const inDeck=initialDeck.includes(card.id);const zone=inDeck?getMemoryZone(card.id):null;const meta=zone?zoneMeta[zone]:null;
            return <div
              key={card.id}
              title={!inDeck
                ?`${card.rank}${SUITS[card.suit]} is not part of ${player}'s deck`
                :zone
                  ?`${card.name} (${card.rank}${SUITS[card.suit]}) - ${meta.label}`
                  :`${card.name} (${card.rank}${SUITS[card.suit]}) - Unknown`}
              style={{
                height:18,
                borderRadius:4,
                border:zone?`1px solid ${meta.border}`:"1px solid #2c3152",
                background:zone?meta.background:"#12142a",
                display:"grid",
                placeItems:"center",
                color:zone?meta.color:"#3a3f63",
                fontSize:10,
                fontWeight:800,
                boxShadow:zone?`inset 0 1px 0 #ffffff10, 0 0 0 1px ${meta.border}22`:"inset 0 1px 0 #ffffff05",
                opacity:inDeck?1:.18,
                letterSpacing:.2,
                userSelect:"none"
              }}
            >{zone||""}</div>;})}
        </Fragment>)}
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
        {["H","P","D","d","S",...(memoryCounts.R?["R"]:[])].map(key=><div key={key} title={zoneMeta[key].label} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 7px",borderRadius:999,border:`1px solid ${zoneMeta[key].border}`,background:zoneMeta[key].background,boxShadow:"inset 0 1px 0 #ffffff10"}}>
          <span style={{minWidth:12,textAlign:"center",fontSize:10,fontWeight:900,color:zoneMeta[key].color}}>{key}</span>
          <span style={{fontSize:9,color:"#c2d0dc"}}>{zoneMeta[key].label}</span>
          <span style={{fontSize:9,color:"#8d89a8"}}>{memoryCounts[key]||0}</span>
        </div>)}
      </div>
    </div></div>);}

// Public zones
function PublicZones({gs,extraControls,onToggleZone,canToggleZone,spotlightZone}){const[exp,setExp]=useState(null);
  const zones=[{key:"scrap",label:"Scrap",cards:gs.scrap,color:"#a86ef0"},{key:"aDiscard",label:"A Discard",cards:gs.aDiscard,color:"#ff5a4e"},{key:"bDiscard",label:"B Discard",cards:gs.bDiscard,color:"#34a3ff"}];
  return(<div><div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
    {zones.map(z=>{const enabled=canToggleZone?canToggleZone(z.key):true;const spotlight=spotlightZone===z.key;const open=exp===z.key;return(<button key={z.key} data-zone={z.key} onClick={()=>{if(!enabled)return;const next=open?null:z.key;setExp(next);if(next)onToggleZone?.(z.key);}} style={{padding:"5px 12px 6px",borderRadius:9,fontSize:11,fontFamily:FONT_DISPLAY,letterSpacing:.4,cursor:enabled?"pointer":"default",
      border:`2px solid ${open||spotlight?z.color:z.color+"aa"}`,background:open?z.color:spotlight?z.color+"33":"#12142a",color:open?"#fff":z.color,textShadow:open?"0 1px 0 rgba(0,0,0,.4)":"none",opacity:enabled?1:0.45,
      boxShadow:spotlight?`0 3px 0 rgba(0,0,0,.35), 0 0 16px ${z.color}66`:"0 3px 0 rgba(0,0,0,.35)",animation:spotlight?"pulse 1.4s infinite":"none",transition:"background .12s, color .12s, transform .08s"}}>{z.label} <span style={{opacity:.8}}>({z.cards.length})</span></button>);})}
    {extraControls}
    <span className="kp-pill" data-zone="deck" style={{padding:"5px 12px",fontSize:10,marginLeft:"auto"}}>A deck: {gs.aDeck.length} · B deck: {gs.bDeck.length}</span></div>
    {exp&&(()=>{const z=zones.find(x=>x.key===exp);if(!z||!z.cards.length)return <div style={{fontSize:10,color:"#8d89a8",marginTop:4,fontStyle:"italic"}}>Empty</div>;
      return(<div style={{marginTop:6,padding:8,background:"#12142acc",borderRadius:10,border:`2px solid ${z.color}44`,boxShadow:"inset 0 3px 8px rgba(0,0,0,.4)"}}>
        <div style={{display:"flex",flexWrap:"wrap",gap:4}}>{sortC(z.cards).map((id,i)=><PreviewCard key={id+i} id={id}/>)}</div></div>);})()}</div>);}
export { FONT_DISPLAY, FONT_BODY, USE_ILLUSTRATED_CARDS, FeltBackdrop, CardRenderContext, Card, PreviewCard, FaceDownActionSlot, CardBack, FLIGHT_MS, prefersReducedMotion, flightZoneMap, FlightGhost, RememberChip, getCascadeCardPool, VictorySolitaireCanvas, KonamiCelebrationOverlay, GalleryThumbCard, HandBadge, Btn, SfxToggle, Chip, Modal, MultiPickModal, BrainstormModal, RejuvenateModal, DeckStats, PublicZones };
