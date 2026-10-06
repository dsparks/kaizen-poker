import Chippy from "./Chippy.jsx";
import { CHIPPY_COPY } from "./chippyCopy.jsx";
import { CARDS, CM, RO, SO } from "./gameData.js";
import { getRenderedCardSrc } from "./renderedCardImageMap.js";
import rulesPdfUrl from "../Kaizen Poker rules.pdf";
import { FONT_BODY, FeltBackdrop, GalleryThumbCard, Card, CardRenderContext } from "./components.jsx";

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

// The gallery shows cards in the player's chosen aesthetic: graphic faces by
// default; the illustrated print images only when Illustrated is selected.
export function GalleryScreen({hoverId,setHoverId,chippyDismissed,setChippyDismissed,onBack,isCompact,cardAesthetic="graphic"}){
  const illustrated=cardAesthetic==="illustrated";
  const previewCard=hoverId?CM[hoverId]:null;
  const previewSrc=previewCard&&illustrated?getRenderedCardSrc(previewCard.name):null;
  const preview=previewCard&&(illustrated
    ?(previewSrc?<img src={previewSrc} alt={previewCard.name}/>:null)
    :<div className="kp-gallery-graphic-preview"><Card id={previewCard.id}/></div>);
  const chippy=illustrated?CHIPPY_COPY.gallery:CHIPPY_COPY.galleryGraphic;
  return <CardRenderContext.Provider value={illustrated?"image":"graphic"}><div className="kp-passive-screen" style={{minHeight:"100dvh",color:"#f5f1e8",fontFamily:FONT_BODY,display:"flex",flexDirection:"column",position:"relative",overflow:"hidden"}}>
    <FeltBackdrop/>
    <header className="kp-passive-header">
      <button onClick={onBack} className="kp-pill kp-touch-control">Back</button>
      <span style={{color:"#8d89a8",fontWeight:800}}>Card Gallery</span>
    </header>
    <main className="kp-gallery-body">
      {isCompact&&preview&&<button className="kp-gallery-preview-mobile" onClick={()=>setHoverId(null)} aria-label="Close card preview">
        {preview}
        <span>Tap to close</span>
      </button>}
      <div className="kp-gallery-grid">
        {SO.flatMap(suit=>RO.map(rank=>CARDS.find(card=>card.rank===rank&&card.suit===suit))).filter(Boolean).map(card=><div key={card.id} className="kp-gallery-cell">
          <GalleryThumbCard id={card.id} scale={isCompact?.58:.72} active={hoverId===card.id}
            onHover={()=>setHoverId(card.id)} onClick={()=>setHoverId(card.id)} onLeave={()=>!isCompact&&setHoverId(current=>current===card.id?null:current)}/>
        </div>)}
      </div>
      {!isCompact&&preview&&<aside className="kp-gallery-preview-desktop">
        {preview}
      </aside>}
    </main>
    {!chippyDismissed&&<Chippy title={chippy.title} message={chippy.message} visible actionLabel="OK" onAction={()=>setChippyDismissed(true)} initialPos={{x:760,y:240}} draggable={!isCompact}/>}
  </div></CardRenderContext.Provider>;
}

export default function PassiveScreens({mode,...props}){
  return mode==="rules"?<RulesScreen {...props}/>:<GalleryScreen {...props}/>;
}
