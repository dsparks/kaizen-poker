import Chippy from "./Chippy.jsx";
import { CHIPPY_COPY } from "./chippyCopy.jsx";
import GalleryGlass from "./GalleryGlass.jsx";
import rulesPdfUrl from "../Kaizen Poker rules.pdf";
import { FONT_BODY, FeltBackdrop, CardRenderContext } from "./components.jsx";

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

// Card Gallery: "The Viewing Glass" (GalleryGlass.jsx). Table cards follow the
// player's chosen aesthetic; the glass shows each card's printed version.
export function GalleryScreen({setHoverId,chippyDismissed,setChippyDismissed,onBack,isCompact,cardAesthetic="graphic"}){
  return <CardRenderContext.Provider value={cardAesthetic==="illustrated"?"image":"graphic"}><div className="kp-passive-screen" style={{height:"100dvh",color:"#f5f1e8",fontFamily:FONT_BODY,display:"flex",flexDirection:"column",position:"relative",overflow:"hidden"}}>
    <FeltBackdrop/>
    <header className="kp-passive-header">
      <button onClick={onBack} className="kp-pill kp-touch-control">Back</button>
      <span style={{color:"#8d89a8",fontWeight:800}}>Card Gallery</span>
    </header>
    <main className="kp-glass-main"><GalleryGlass compact={isCompact} onCardShown={id=>setHoverId?.(id)}/></main>
    {!chippyDismissed&&<Chippy title={CHIPPY_COPY.gallery.title} message={CHIPPY_COPY.gallery.message} visible actionLabel="OK" onAction={()=>setChippyDismissed(true)} initialPos={{x:40,y:9999}} draggable={!isCompact}/>}
  </div></CardRenderContext.Provider>;
}
export default function PassiveScreens({mode,...props}){
  return mode==="rules"?<RulesScreen {...props}/>:<GalleryScreen {...props}/>;
}
