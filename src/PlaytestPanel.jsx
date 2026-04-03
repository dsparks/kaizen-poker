import { useState } from "react";
import { runSelfTests } from "./gameSelfTest.js";

const CHECKLIST=[
  "Straight and straight flush comparisons",
  "Ace-low rules: wheel, Nerf, Nudge",
  "Duplicate and Reflect copied effects",
  "Queen effects on unmodified 2s only",
  "Post-score effects: Forecast, Vanish, Capitulate",
  "Sudden Death draw/action counts",
  "Face-down play plus Refresh/Sift/Declutter",
  "Discard and scrap targeting edge cases"
];

export default function PlaytestPanel(){
  const [open,setOpen]=useState(false);
  const [checks,setChecks]=useState(()=>Object.fromEntries(CHECKLIST.map(item=>[item,false])));
  const [report,setReport]=useState(null);
  const completed=Object.values(checks).filter(Boolean).length;

  return(
    <div style={{background:"#0a0d1188",border:"1px solid #1f2937",borderRadius:8,padding:8}}>
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <button onClick={()=>setOpen(v=>!v)} style={{padding:"4px 10px",borderRadius:6,background:"#111827",border:"1px solid #334155",color:"#cbd5e1",cursor:"pointer",fontSize:10,fontWeight:700,letterSpacing:1}}>
          {open?"Hide":"Show"} Playtest
        </button>
        <span style={{fontSize:10,color:"#64748b"}}>{completed}/{CHECKLIST.length} checklist items marked</span>
        <button onClick={()=>setReport(runSelfTests())} style={{padding:"4px 10px",borderRadius:6,background:"#f1c40f",border:"none",color:"#111",cursor:"pointer",fontSize:10,fontWeight:800}}>
          Run Logic Checks
        </button>
      </div>
      {open&&<div style={{marginTop:8,display:"grid",gap:10}}>
        <div>
          <div style={{fontSize:9,color:"#94a3b8",fontWeight:700,letterSpacing:1,marginBottom:6}}>MANUAL CHECKLIST</div>
          <div style={{display:"grid",gap:5}}>
            {CHECKLIST.map(item=><label key={item} style={{display:"flex",alignItems:"center",gap:8,fontSize:11,color:"#cbd5e1",cursor:"pointer"}}>
              <input type="checkbox" checked={checks[item]} onChange={()=>setChecks(s=>({...s,[item]:!s[item]}))}/>
              <span>{item}</span>
            </label>)}
          </div>
        </div>
        {report&&<div>
          <div style={{fontSize:9,color:"#94a3b8",fontWeight:700,letterSpacing:1,marginBottom:6}}>LOGIC CHECKS</div>
          <div style={{fontSize:11,color:report.passed===report.total?"#2ecc71":"#f1c40f",marginBottom:6}}>
            {report.passed}/{report.total} checks passed
          </div>
          <div style={{display:"grid",gap:5}}>
            {report.results.map(result=><div key={result.name} style={{padding:"6px 8px",borderRadius:6,background:result.pass?"#052e1c":"#3b0d0d",border:`1px solid ${result.pass?"#14532d":"#7f1d1d"}`}}>
              <div style={{fontSize:11,color:result.pass?"#86efac":"#fca5a5",fontWeight:700}}>{result.pass?"PASS":"FAIL"} - {result.name}</div>
              <div style={{fontSize:10,color:"#cbd5e1",marginTop:2}}>{result.detail}</div>
            </div>)}
          </div>
        </div>}
      </div>}
    </div>
  );
}

