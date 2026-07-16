import Chippy from "./Chippy.jsx";
import { CHIPPY_COPY } from "./chippyCopy.jsx";
import { CARDS, CM, RO, SO } from "./gameData.js";
import { getRenderedCardSrc } from "./renderedCardImageMap.js";
import rulesPdfUrl from "../Kaizen Poker rules.pdf";
import { FONT_BODY, FeltBackdrop, GalleryThumbCard } from "./components.jsx";

export function RulesScreen({onBack}){
  return <div className="kp-passive-screen" style={{height:"100dvh",color:"#f5f1e8",fontFamily:FONT_BODY,display:"flex",flexDirection:"column",position:"relative",overflow:"hidden"}}>
    <FeltBackdrop/>
    <header className="kp-passive-header">
      <button onClick={onBack} className="kp-pill kp-touch-control">Back</button>
      <span style={{color:"#8d89a8",fontWeight:800}}>Rules</span>
      <a href={rulesPdfUrl} target="_blank" rel="noreferrer" className="kp-pill kp-touch-control" style={{textDecoration:"none"}}>Open PDF</a>
    </header>
    <main className="kp-rules-body">
      <div className="kp-rules-frame">
        <object data={rulesPdfUrl} type="application/pdf" width="100%" height="100%">
          <div className="kp-rules-fallback">
            <div>Inline PDF viewing is not available in this browser.</div>
            <a href={rulesPdfUrl} target="_blank" rel="noreferrer" className="kp-pill kp-touch-control" style={{textDecoration:"none"}}>Open the rulebook</a>
          </div>
        </object>
      </div>
    </main>
  </div>;
}

export function GalleryScreen({hoverId,setHoverId,chippyDismissed,setChippyDismissed,onBack,isCompact}){
  const previewCard=hoverId?CM[hoverId]:null;
  const previewSrc=previewCard?getRenderedCardSrc(previewCard.name):null;
  return <div className="kp-passive-screen" style={{minHeight:"100dvh",color:"#f5f1e8",fontFamily:FONT_BODY,display:"flex",flexDirection:"column",position:"relative",overflow:"hidden"}}>
    <FeltBackdrop/>
    <header className="kp-passive-header">
      <button onClick={onBack} className="kp-pill kp-touch-control">Back</button>
      <span style={{color:"#8d89a8",fontWeight:800}}>Card Image Gallery</span>
    </header>
    <main className="kp-gallery-body">
      {isCompact&&previewCard&&previewSrc&&<button className="kp-gallery-preview-mobile" onClick={()=>setHoverId(null)} aria-label="Close card preview">
        <img src={previewSrc} alt={previewCard.name}/>
        <span>Tap to close</span>
      </button>}
      <div className="kp-gallery-grid">
        {SO.flatMap(suit=>RO.map(rank=>CARDS.find(card=>card.rank===rank&&card.suit===suit))).filter(Boolean).map(card=><div key={card.id} className="kp-gallery-cell">
          <GalleryThumbCard id={card.id} scale={isCompact?.58:.72} active={hoverId===card.id}
            onHover={()=>setHoverId(card.id)} onClick={()=>setHoverId(card.id)} onLeave={()=>!isCompact&&setHoverId(current=>current===card.id?null:current)}/>
        </div>)}
      </div>
      {!isCompact&&previewCard&&previewSrc&&<aside className="kp-gallery-preview-desktop">
        <img src={previewSrc} alt={previewCard.name}/>
      </aside>}
    </main>
    {!chippyDismissed&&<Chippy title={CHIPPY_COPY.gallery.title} message={CHIPPY_COPY.gallery.message} visible actionLabel="OK" onAction={()=>setChippyDismissed(true)} initialPos={{x:760,y:240}} draggable={!isCompact}/>} 
  </div>;
}

export default function PassiveScreens({mode,...props}){
  return mode==="rules"?<RulesScreen {...props}/>:<GalleryScreen {...props}/>;
}
